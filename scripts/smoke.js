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
      // 赛季已不再持有 deck_count（牌副数归属于每一局）
      assert.strictEqual(season.status, 'active');
      assert.ok(season.id > 0);
    });

    const emptyNameErr = await mustFail('POST', '/api/seasons', { name: '   ' });
    check('名称为空被拒绝', () => assert.match(emptyNameErr, /不能为空/));

    /* ------------------------------------------------ 玩家 */
    console.log('\n玩家');
    const names = ['张三', '李四', '王五', '赵六'];
    const players = [];
    for (const n of names) {
      players.push(await must('POST', '/api/players', {
        name: n,
        player_code: `GT-${String(players.length + 1).padStart(3, '0')}`,
      }));
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

    /* ------------------------------------------------ 技能字典（我的 → 设置 → 技能） */
    console.log('\n技能字典（我的 → 设置 → 技能）');
    const skillNames = ['记牌', '算牌', '心理战', '备用'];
    const skills = [];
    for (const n of skillNames) {
      skills.push(await must('POST', '/api/skills', { name: n }));
    }
    check('创建 4 个技能并返回引用数', () => {
      assert.strictEqual(skills.length, 4);
      assert.deepStrictEqual(skills.map((s) => s.name), skillNames);
      assert.ok(skills.every((s) => s.usageCount === 0));
      assert.ok(skills.every((s) => s.id > 0));
    });

    const dupSkillErr = await mustFail('POST', '/api/skills', { name: '记牌' });
    check('重名技能被拒绝', () => assert.match(dupSkillErr, /已存在同名技能/));

    const emptySkillErr = await mustFail('POST', '/api/skills', { name: '   ' });
    check('空技能名被拒绝', () => assert.match(emptySkillErr, /不能为空/));

    const longSkillErr = await mustFail('POST', '/api/skills', { name: '一二三四五六七八九' });
    check('技能名超 8 字被拒绝', () => assert.match(longSkillErr, /最多8个字符/));

    const renamed = await must('PUT', `/api/skills/${skills[1].id}`, { name: '读牌' });
    check('技能可改名（历史引用通过外键自动跟随）', () => assert.strictEqual(renamed.name, '读牌'));

    const skillList = await must('GET', '/api/skills');
    check('GET /api/skills 返回全量列表与引用数', () => {
      assert.strictEqual(skillList.length, 4);
      assert.ok(skillList.every((s) => typeof s.usageCount === 'number'));
      assert.strictEqual(skillList.find((s) => s.id === skills[1].id).name, '读牌');
    });

    /* ------------------------------------------------ 对局与计分 */
    console.log('\n对局与计分（2 副牌 = 200 分，获胜线 100 分，需严格超过）');

    const match = await must('POST', '/api/matches', {
      season_id: season.id,
      deck_count: 2,
      table_name: '1 号桌',
      played_at: '2026-09-29 21:00:00',
      type: 'normal',
      // 故意绕过前端 wx:if 门控：普通赛即使带上 skill_id，服务端也必须强制置空
      camps: [
        {
          name: '红队',
          color: '#d64545',
          players: [
            { player_id: players[0].id, score: 60, finished: true, skill_id: skills[0].id },
            { player_id: players[1].id, score: 45, finished: true, skill_id: skills[1].id },
          ],
        },
        {
          name: '蓝队',
          color: '#3b7dd8',
          players: [
            { player_id: players[2].id, score: 30, finished: true, skill_id: skills[2].id },
            { player_id: players[3].id, score: 20, finished: false, skill_id: skills[0].id }, // 没出完，分数不计入
          ],
        },
      ],
    });

    const red = match.camps.find((c) => c.name === '红队');
    const blue = match.camps.find((c) => c.name === '蓝队');

    check('牌库总分 = 副数 × 100 = 200', () => assert.strictEqual(match.deck_total, 200));
    check('获胜线 = 一半 = 100', () => assert.strictEqual(match.win_line, 100));
    check('红队 60+45=105 分（分数按 5 的倍数归一）', () => assert.strictEqual(red.total_score, 105));
    check('红队超过 100 分判获胜', () => assert.strictEqual(red.is_winner, true));
    check('蓝队只算已出完的 30 分（20 分未出完）', () => {
      assert.strictEqual(blue.total_score, 30);
      assert.strictEqual(blue.is_winner, false);
    });
    check('获胜阵营被记录在对局上', () => assert.strictEqual(match.winner_camp_id, red.id));
    check('普通赛服务端硬门控：type=normal 且所有 skill_id 被强制置空', () => {
      assert.strictEqual(match.type, 'normal');
      const all = match.camps.flatMap((c) => c.players);
      assert.strictEqual(all.length, 4);
      assert.ok(all.every((p) => p.skill_id === null), '绕过前端 wx:if 也不能写入技能');
    });
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
      type: 'skill',
      camps: [
        {
          name: '红队',
          players: [
            { player_id: players[0].id, score: 60, finished: true, skill_id: skills[0].id },
            { player_id: players[1].id, score: 40, finished: true, skill_id: skills[1].id },
          ],
        },
        {
          name: '蓝队',
          players: [
            { player_id: players[2].id, score: 10, finished: true, skill_id: skills[2].id },
            { player_id: players[3].id, score: 0, finished: true, skill_id: skills[0].id },
          ],
        },
      ],
    });
    check('技能赛创建：type=skill 且每位玩家技能落库、名称回填', () => {
      assert.strictEqual(tieMatch.type, 'skill');
      const all = tieMatch.camps.flatMap((c) => c.players);
      assert.strictEqual(all.length, 4);
      assert.ok(all.every((p) => p.skill_id != null && p.skill_name));
      assert.strictEqual(all.find((p) => p.player_id === players[1].id).skill_name, '读牌');
    });
    const refSkillErr = await mustFail('DELETE', `/api/skills/${skills[0].id}`);
    check('被对局引用的技能禁止删除', () => assert.match(refSkillErr, /条对局记录引用/));
    const unusedDel = await must('DELETE', `/api/skills/${skills[3].id}`);
    check('未被任何对局引用的技能可以删除', () => assert.strictEqual(unusedDel.deleted, true));
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
        { name: 'A', players: [
          { player_id: players[0].id, score: 10, finished: true },
          { player_id: players[1].id, score: 10, finished: true },
        ] },
        { name: 'B', players: [
          { player_id: players[0].id, score: 10, finished: true },
          { player_id: players[3].id, score: 10, finished: true },
        ] },
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

    /* ------------------------------------------------ 编辑对局（PUT /api/matches/:id）：比分 + 对局类型 + 技能 */
    console.log('\n编辑对局（比分 / 类型 / 技能）');
    const editPayload = {
      camps: [
        {
          id: red.id,
          players: [
            { player_id: players[0].id, score: 65, finished: true, is_mvp: false },
            { player_id: players[3].id, score: 45, finished: true, is_mvp: false },
          ],
        },
        {
          id: blue.id,
          players: [
            { player_id: players[2].id, score: 25, finished: true, is_mvp: true },
            { player_id: players[1].id, score: 15, finished: false, is_mvp: false },
          ],
        },
      ],
    };
    const edited = await must('PUT', `/api/matches/${match.id}`, editPayload);
    const editedRed = edited.camps.find((c) => c.id === red.id);
    const editedBlue = edited.camps.find((c) => c.id === blue.id);

    check('编辑后重算阵营总分与胜负', () => {
      assert.strictEqual(editedRed.total_score, 110);
      assert.strictEqual(editedRed.is_winner, true);
      assert.strictEqual(editedBlue.total_score, 25); // 15 分玩家未出完，不计入
      assert.strictEqual(editedBlue.is_winner, false);
      assert.strictEqual(edited.winner_camp_id, red.id);
    });
    check('编辑支持换人、MVP 与已出完状态', () => {
      assert.ok(editedRed.players.some((p) => p.player_id === players[3].id), '红队应换成赵六');
      assert.ok(editedBlue.players.some((p) => p.player_id === players[1].id), '蓝队应换成李四');
      assert.strictEqual(editedBlue.players.find((p) => p.player_id === players[2].id).is_mvp, true);
      assert.strictEqual(editedBlue.players.find((p) => p.player_id === players[1].id).finished, false);
    });
    check('编辑不传 type 时主表字段、阵营 id、桌号/备注与对局类型保持不变', () => {
      assert.strictEqual(edited.type, match.type); // 类型现在可编辑，但不传就保持原值
      assert.strictEqual(edited.id, match.id);
      assert.strictEqual(edited.season_id, match.season_id);
      assert.strictEqual(edited.played_at, match.played_at);
      assert.strictEqual(edited.seq, match.seq);
      assert.strictEqual(edited.deck_count, match.deck_count);
      assert.strictEqual(edited.deck_total, match.deck_total);
      assert.strictEqual(edited.win_line, match.win_line);
      assert.strictEqual(edited.table_name, '1 号桌');
      assert.strictEqual(edited.note, match.note);
      assert.strictEqual(edited.created_at, match.created_at);
      assert.strictEqual(edited.camps.length, 2);
      assert.strictEqual(edited.camps[0].id, red.id);
      assert.strictEqual(edited.camps[1].id, blue.id);
      assert.strictEqual(edited.camps[0].name, '红队');
      assert.strictEqual(edited.camps[1].name, '蓝队');
    });
    const bootAfterEdit = await must('GET', '/api/bootstrap');
    check('编辑不会解绑关联高光', () => {
      assert.strictEqual(bootAfterEdit.highlights.length, 1);
      assert.strictEqual(bootAfterEdit.highlights[0].match_id, match.id);
    });

    // 校验失败：任何一步抛错都要靠事务整体回滚，不能留下半改的数据
    const oneCampEditErr = await mustFail('PUT', `/api/matches/${match.id}`, {
      camps: [editPayload.camps[0]],
    });
    check('编辑不允许改阵营数量', () => assert.match(oneCampEditErr, /阵营数量不可修改/));

    const badCampIdErr = await mustFail('PUT', `/api/matches/${match.id}`, {
      camps: [{ ...editPayload.camps[0], id: blue.id }, editPayload.camps[1]],
    });
    check('编辑不允许把阵营 id 换成别的对局', () => assert.match(badCampIdErr, /阵营结构不可修改/));

    const dupPlayerEditErr = await mustFail('PUT', `/api/matches/${match.id}`, {
      camps: [
        {
          id: red.id,
          players: [
            { player_id: players[0].id, score: 65, finished: true },
            { player_id: players[1].id, score: 45, finished: true },
          ],
        },
        {
          id: blue.id,
          players: [
            { player_id: players[0].id, score: 25, finished: true },
            { player_id: players[3].id, score: 15, finished: false },
          ],
        },
      ],
    });
    check('编辑时同一玩家跨阵营被拒绝', () => assert.match(dupPlayerEditErr, /不能同时出现在两个阵营/));

    const fewPlayersEditErr = await mustFail('PUT', `/api/matches/${match.id}`, {
      camps: [
        { id: red.id, players: [{ player_id: players[0].id, score: 65, finished: true }] },
        editPayload.camps[1],
      ],
    });
    check('编辑时阵营玩家不足 2 名被拒绝', () => assert.match(fewPlayersEditErr, /玩家不足 2 名/));

    const overTotalEditErr = await mustFail('PUT', `/api/matches/${match.id}`, {
      camps: [
        {
          id: red.id,
          players: [
            { player_id: players[0].id, score: 200, finished: true },
            { player_id: players[3].id, score: 5, finished: true },
          ],
        },
        editPayload.camps[1],
      ],
    });
    check('编辑时总分超牌库被拒绝', () => assert.match(overTotalEditErr, /超过牌库总分/));

    const afterFailedEdits = await must('GET', `/api/matches/${match.id}`);
    check('校验失败后原数据完整保留（事务回滚）', () => {
      assert.strictEqual(afterFailedEdits.camps[0].total_score, 110);
      assert.strictEqual(afterFailedEdits.winner_camp_id, red.id);
      assert.ok(afterFailedEdits.camps[0].players.some((p) => p.player_id === players[3].id));
    });

    const notFoundPut = await call('PUT', '/api/matches/999999', editPayload);
    check('编辑不存在的对局返回 404', () => {
      assert.strictEqual(notFoundPut.status, 404);
      assert.match(notFoundPut.body.error, /对局不存在/);
    });

    /* ------------------------------------------------ 对局类型与技能门控（编辑态闭环） */
    console.log('\n对局类型与技能门控（编辑态闭环）');
    const putSkillPayload = {
      type: 'skill',
      camps: [
        {
          id: red.id,
          players: [
            { player_id: players[0].id, score: 65, finished: true, is_mvp: false, skill_id: skills[0].id },
            { player_id: players[3].id, score: 45, finished: true, is_mvp: false, skill_id: skills[1].id },
          ],
        },
        {
          id: blue.id,
          players: [
            { player_id: players[2].id, score: 25, finished: true, is_mvp: true, skill_id: skills[2].id },
            { player_id: players[1].id, score: 15, finished: false, is_mvp: false, skill_id: skills[0].id },
          ],
        },
      ],
    };
    const asSkill = await must('PUT', `/api/matches/${match.id}`, putSkillPayload);
    check('编辑可把普通赛改为技能赛，技能随 scores 原地落库', () => {
      assert.strictEqual(asSkill.type, 'skill');
      const all = asSkill.camps.flatMap((c) => c.players);
      assert.strictEqual(all.length, 4);
      assert.ok(all.every((p) => p.skill_id != null && p.skill_name));
    });

    const skillRoundTrip = await must('GET', `/api/matches/${match.id}`);
    check('GET /api/matches/:id 回填对局类型与玩家技能（供编辑态 picker 还原）', () => {
      assert.strictEqual(skillRoundTrip.type, 'skill');
      const p = skillRoundTrip.camps.flatMap((c) => c.players).find((x) => x.player_id === players[1].id);
      assert.strictEqual(p.skill_id, skills[0].id);
      assert.strictEqual(p.skill_name, '记牌');
    });

    const bootSkills = await must('GET', '/api/bootstrap');
    check('bootstrap 下发 skills（含引用数）与 matches.type / 玩家 skill_id', () => {
      assert.strictEqual(bootSkills.skills.length, 3);
      assert.ok(bootSkills.skills.some((s) => s.id === skills[0].id && s.usageCount >= 3));
      const m = bootSkills.matches.find((x) => x.id === match.id);
      assert.strictEqual(m.type, 'skill');
      assert.ok(m.camps.flatMap((c) => c.players).every((p) => p.skill_id != null && p.skill_name));
      assert.strictEqual(bootSkills.matches.find((x) => x.id === tieMatch.id).type, 'skill');
    });

    const backToNormal = await must('PUT', `/api/matches/${match.id}`, {
      type: 'normal',
      camps: putSkillPayload.camps, // 故意仍携带 skill_id
    });
    check('编辑切回普通赛时服务端强制清空所有玩家技能', () => {
      assert.strictEqual(backToNormal.type, 'normal');
      assert.ok(backToNormal.camps.flatMap((c) => c.players).every((p) => p.skill_id === null));
    });

    const invalidType = await must('PUT', `/api/matches/${match.id}`, {
      type: 'bogus',
      camps: editPayload.camps,
    });
    check('非法对局类型回落为当前类型，且不破坏主表其它字段', () => {
      assert.strictEqual(invalidType.type, 'normal');
      assert.strictEqual(invalidType.played_at, match.played_at);
      assert.strictEqual(invalidType.deck_count, match.deck_count);
    });

    const noType = await must('PUT', `/api/matches/${match.id}`, editPayload);
    check('编辑不传 type 时保持原类型（向后兼容旧客户端）', () => {
      assert.strictEqual(noType.type, 'normal');
    });

    /* ------------------------------------------------ 全量数据 */
    console.log('\n全量数据与统计');
    const boot = await must('GET', '/api/bootstrap');
    check('bootstrap 返回全部实体', () => {
      assert.strictEqual(boot.seasons.length, 1);
      assert.strictEqual(boot.players.length, 4);
      assert.strictEqual(boot.matches.length, 2);
      assert.strictEqual(boot.highlights.length, 1);
      assert.strictEqual(boot.skills.length, 3); // 「备用」已删，其余 3 个仍被技能赛引用
      assert.strictEqual(boot.matches.find((m) => m.id === tieMatch.id).type, 'skill');
      assert.strictEqual(boot.matches.find((m) => m.id === match.id).type, 'normal');
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
    // 有对局的赛季禁止删除，先清掉剩余那一局
    await must('DELETE', `/api/matches/${tieMatch.id}`);
    const delSeason = await must('DELETE', `/api/seasons/${season.id}`);
    check('删除赛季成功', () => assert.strictEqual(delSeason.deleted, true));

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
