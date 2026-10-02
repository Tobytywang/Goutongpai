'use strict';

/**
 * 端到端冒烟测试：`npm run smoke`
 *
 * 会在临时目录起一个独立实例（不碰正式数据），把「建赛季 → 登记玩家 →
 * 传头像 → 录一局 → 校验计分与账目 → 记高光 → 删除」整条链路跑一遍，
 * 全部通过后自动清理。
 */

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert');

const PORT = Number(process.env.SMOKE_PORT || 5199);
const BASE = `http://127.0.0.1:${PORT}`;
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'gtp-smoke-'));

const ONE_PX_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

let passed = 0;
let failed = 0;

function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`  ✗ ${name}\n      ${err.message}`);
  }
}

async function call(method, apiPath, body) {
  const options = { method, headers: {} };
  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  const res = await fetch(BASE + apiPath, options);
  const json = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, body: json };
}

/** 期待成功的请求 */
async function must(method, apiPath, body) {
  const r = await call(method, apiPath, body);
  if (!r.ok || r.body.ok === false) {
    throw new Error(`${method} ${apiPath} 失败：${r.body.error || r.status}`);
  }
  return r.body.data;
}

/** 期待被拒绝的请求，返回错误文案 */
async function mustFail(method, apiPath, body) {
  const r = await call(method, apiPath, body);
  if (r.ok && r.body.ok !== false) {
    throw new Error(`${method} ${apiPath} 本应被拒绝，却成功了`);
  }
  return r.body.error || `HTTP ${r.status}`;
}

async function waitForServer(timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${BASE}/api/health`);
      if (r.ok) return true;
    } catch (_) {
      /* 还没起来，继续等 */
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error('服务器在超时时间内没有就绪');
}

async function main() {
  console.log(`\n沟通牌计分平台 · 冒烟测试\n临时数据目录：${DATA_DIR}\n`);

  const child = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', GTP_DATA_DIR: DATA_DIR },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', () => {});
  child.stderr.on('data', (d) => process.stderr.write(`[server] ${d}`));

  try {
    await waitForServer();

    /* ------------------------------------------------ 赛季 */
    console.log('赛季');
    const season = await must('POST', '/api/seasons', {
      name: '冒烟测试赛季',
      deck_count: 2,
      started_on: '2026-09-01',
    });
    check('创建赛季', () => {
      assert.strictEqual(season.name, '冒烟测试赛季');
      assert.strictEqual(season.deck_count, 2);
      assert.strictEqual(season.status, 'active');
    });

    const emptyNameErr = await mustFail('POST', '/api/seasons', { name: '   ' });
    check('名称为空被拒绝', () => assert.match(emptyNameErr, /不能为空/));

    /* ------------------------------------------------ 玩家 */
    console.log('\n玩家');
    const names = ['张三', '李四', '王五', '赵六'];
    const players = [];
    for (const n of names) {
      players.push(await must('POST', '/api/players', { name: n, player_code: `GT-${players.length + 1}` }));
    }
    check('创建 4 名玩家', () => assert.strictEqual(players.length, 4));

    const dupErr = await mustFail('POST', '/api/players', { name: '张三' });
    check('重名玩家被拒绝', () => assert.match(dupErr, /已存在同名玩家/));

    const uploaded = await must('POST', `/api/players/${players[0].id}/avatar`, {
      dataUrl: `data:image/png;base64,${ONE_PX_PNG}`,
    });
    check('上传头像并落盘', () => {
      assert.ok(uploaded.avatar, '应返回 avatar 文件名');
      assert.ok(fs.existsSync(path.join(DATA_DIR, 'uploads', uploaded.avatar)), '头像文件应存在于 uploads 目录');
    });

    const badImageErr = await mustFail('POST', `/api/players/${players[0].id}/avatar`, {
      dataUrl: 'data:text/plain;base64,aGVsbG8=',
    });
    check('非图片格式被拒绝', () => assert.match(badImageErr, /不支持的文件类型/));

    /* ------------------------------------------------ 对局与计分 */
    console.log('\n对局与计分（2 副牌 = 200 分，获胜线 100 分，需严格超过）');

    const match = await must('POST', '/api/matches', {
      season_id: season.id,
      deck_count: 2,
      table_name: '1 号桌',
      played_at: '2026-09-29 21:00:00',
      camps: [
        {
          name: '红队',
          color: '#d64545',
          players: [
            { player_id: players[0].id, score: 60, finished: true },
            { player_id: players[1].id, score: 41, finished: true },
          ],
        },
        {
          name: '蓝队',
          color: '#3b7dd8',
          players: [
            { player_id: players[2].id, score: 30, finished: true },
            { player_id: players[3].id, score: 20, finished: false }, // 没出完，分数作废
          ],
        },
      ],
    });

    const red = match.camps.find((c) => c.name === '红队');
    const blue = match.camps.find((c) => c.name === '蓝队');

    check('牌库总分 = 副数 × 100 = 200', () => assert.strictEqual(match.deck_total, 200));
    check('获胜线 = 一半 = 100', () => assert.strictEqual(match.win_line, 100));
    check('红队 60+41=101 分', () => assert.strictEqual(red.total_score, 101));
    check('红队超过 100 分判获胜', () => assert.strictEqual(red.is_winner, true));
    check('蓝队只算已出完的 30 分（20 分作废）', () => {
      assert.strictEqual(blue.total_score, 30);
      assert.strictEqual(blue.is_winner, false);
    });
    check('获胜阵营被记录在对局上', () => assert.strictEqual(match.winner_camp_id, red.id));
    check('未出完牌的状态被保存', () => {
      const zhao = blue.players.find((p) => p.player_id === players[3].id);
      assert.strictEqual(zhao.finished, false);
      assert.strictEqual(zhao.score, 20);
    });

    // 边界：正好 100 分不算赢
    const tieMatch = await must('POST', '/api/matches', {
      season_id: season.id,
      deck_count: 2,
      played_at: '2026-09-29 21:30:00',
      camps: [
        { name: '红队', players: [{ player_id: players[0].id, score: 100, finished: true }] },
        { name: '蓝队', players: [{ player_id: players[2].id, score: 10, finished: true }] },
      ],
    });
    check('正好 100 分（正好一半）不算获胜', () => {
      const r = tieMatch.camps.find((c) => c.name === '红队');
      assert.strictEqual(r.total_score, 100);
      assert.strictEqual(r.is_winner, false);
      assert.strictEqual(tieMatch.winner_camp_id, null);
    });

    // 字段校验
    const oneCampErr = await mustFail('POST', '/api/matches', {
      season_id: season.id,
      camps: [{ name: '独苗队', players: [{ player_id: players[0].id, score: 10, finished: true }] }],
    });
    check('只有 1 个阵营被拒绝', () => assert.match(oneCampErr, /至少需要 2 个阵营/));

    const dupPlayerErr = await mustFail('POST', '/api/matches', {
      season_id: season.id,
      camps: [
        { name: 'A', players: [{ player_id: players[0].id, score: 10, finished: true }] },
        { name: 'B', players: [{ player_id: players[0].id, score: 10, finished: true }] },
      ],
    });
    check('同一玩家出现在两个阵营被拒绝', () => assert.match(dupPlayerErr, /不能同时出现在两个阵营/));

    const badSeasonErr = await mustFail('POST', '/api/matches', {
      season_id: 99999,
      camps: [
        { name: 'A', players: [{ player_id: players[0].id, score: 10, finished: true }] },
        { name: 'B', players: [{ player_id: players[1].id, score: 10, finished: true }] },
      ],
    });
    check('不存在的赛季被拒绝', () => assert.match(badSeasonErr, /赛季不存在/));

    /* ------------------------------------------------ 高光 */
    console.log('\n高光时刻');
    const hl = await must('POST', '/api/highlights', {
      season_id: season.id,
      match_id: match.id,
      player_id: players[0].id,
      title: '最后一轮连抓两张大分翻盘',
      kind: '逆风翻盘',
      content: '红队在落后 30 分的情况下连收两张 K，最终 101:30 拿下。',
      image: `data:image/png;base64,${ONE_PX_PNG}`,
    });
    check('创建高光并落盘配图', () => {
      assert.strictEqual(hl.title, '最后一轮连抓两张大分翻盘');
      assert.ok(hl.image && fs.existsSync(path.join(DATA_DIR, 'uploads', hl.image)), '配图应存在于 uploads 目录');
      assert.strictEqual(hl.season_id, season.id);
    });

    /* ------------------------------------------------ 全量数据 */
    console.log('\n全量数据与统计');
    const boot = await must('GET', '/api/bootstrap');
    check('bootstrap 返回全部实体', () => {
      assert.strictEqual(boot.seasons.length, 1);
      assert.strictEqual(boot.players.length, 4);
      assert.strictEqual(boot.matches.length, 2);
      assert.strictEqual(boot.highlights.length, 1);
    });
    check('计分口径随数据一起下发', () => {
      assert.strictEqual(boot.meta.pointsPerDeck, 100);
      const sum = boot.meta.deckBreakdown.reduce((s, c) => s + c.subtotal, 0);
      assert.strictEqual(sum, 100);
    });
    check('对局按时间倒序返回', () => {
      assert.strictEqual(boot.matches[0].id, tieMatch.id);
    });

    /* ------------------------------------------------ 删除保护 */
    console.log('\n删除保护');
    const delPlayerErr = await mustFail('DELETE', `/api/players/${players[0].id}`);
    check('有对局记录的玩家不允许直接删除', () => assert.match(delPlayerErr, /已有 \d+ 条对局记录/));

    const delMatch = await must('DELETE', `/api/matches/${match.id}`);
    check('删除对局并解绑高光', () => {
      assert.strictEqual(delMatch.deleted, true);
      assert.strictEqual(delMatch.unlinkedHighlights, 1);
    });

    const boot2 = await must('GET', '/api/bootstrap');
    check('删除后剩余 1 局，高光仍在（已解绑）', () => {
      assert.strictEqual(boot2.matches.length, 1);
      assert.strictEqual(boot2.highlights.length, 1);
      assert.strictEqual(boot2.highlights[0].match_id, null);
    });

    /* ------------------------------------------------ 赛季级联删除 */
    const delSeason = await must('DELETE', `/api/seasons/${season.id}`);
    check('删除赛季级联清理对局', () => assert.strictEqual(delSeason.removedMatches, 1));

    const boot3 = await must('GET', '/api/bootstrap');
    check('赛季删完后对局清空、玩家保留', () => {
      assert.strictEqual(boot3.seasons.length, 0);
      assert.strictEqual(boot3.matches.length, 0);
      assert.strictEqual(boot3.players.length, 4);
    });

    /* ------------------------------------------------ 静态资源 */
    console.log('\n静态资源');
    const page = await fetch(`${BASE}/`);
    const html = await page.text();
    check('首页可访问', () => {
      assert.strictEqual(page.status, 200);
      assert.match(html, /沟通牌/);
    });

    const asset = await fetch(`${BASE}/js/app.js`);
    check('前端模块可访问', () => assert.strictEqual(asset.status, 200));

    const notFound = await call('GET', '/api/不存在');
    check('未知接口返回 404', () => assert.strictEqual(notFound.status, 404));
  } finally {
    child.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 350));
    try {
      fs.rmSync(DATA_DIR, { recursive: true, force: true });
    } catch (_) {
      /* Windows 上文件可能还被占用，忽略 */
    }
  }

  console.log(`\n────────────────────────────────`);
  console.log(`  通过 ${passed} 项，失败 ${failed} 项`);
  console.log(`────────────────────────────────\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('\n冒烟测试异常终止：', err.message);
  process.exit(1);
});
