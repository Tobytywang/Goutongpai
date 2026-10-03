'use strict';

/**
 * 演示数据生成器：`npm run demo`
 *
 * 灌入一个赛季、6 名玩家（含头像）、8 局对局（覆盖「获胜 / 无人过线 / 有分数作废」
 * 各种情形）以及若干高光时刻。仅在数据为空时执行，不会覆盖已有数据。
 *
 * 环境变量：
 *   BASE          服务地址，默认 http://127.0.0.1:5178
 *   GTP_DATA_DIR  若与服务同机，可指定数据目录以直接生成头像文件
 */

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const BASE = process.env.BASE || 'http://127.0.0.1:5178';
const DATA_DIR = process.env.GTP_DATA_DIR ? path.resolve(process.env.GTP_DATA_DIR) : null;

/* ---------------------------------------------------------------- PNG 生成 */

let CRC_TABLE = null;
function crc32(buf) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Int32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

/** 生成一张 size×size 的圆形渐变 PNG（模拟头像） */
function makeAvatarPng(size, [r1, g1, b1], [r2, g2, b2]) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2;

  let p = 0;
  for (let y = 0; y < size; y += 1) {
    raw[p] = 0; // filter: none
    p += 1;
    for (let x = 0; x < size; x += 1) {
      const t = (x / size + y / size) / 2;
      const inCircle = (x - cx) ** 2 + (y - cy) ** 2 <= (radius - 1) ** 2;
      if (inCircle) {
        raw[p] = Math.round(r1 + (r2 - r1) * t);
        raw[p + 1] = Math.round(g1 + (g2 - g1) * t);
        raw[p + 2] = Math.round(b1 + (b2 - b1) * t);
      } else {
        raw[p] = 240;
        raw[p + 1] = 241;
        raw[p + 2] = 244;
      }
      p += 3;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---------------------------------------------------------------- 请求 */

async function must(method, apiPath, body) {
  const options = { method, headers: {} };
  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  const res = await fetch(BASE + apiPath, options);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) {
    throw new Error(`${method} ${apiPath} 失败：${json.error || res.status}`);
  }
  return json.data;
}

/* ---------------------------------------------------------------- 数据 */

const PLAYERS = [
  { name: '老王', player_code: 'GT-001', style: '稳健流', bio: '二十年老牌友，出牌永远不慌', color: [[23, 102, 63], [31, 125, 77]] },
  { name: '小陈', player_code: 'GT-002', style: '激进流', bio: '能抢的分一分不让，输赢都快', color: [[214, 69, 69], [176, 42, 42]] },
  { name: '阿强', player_code: 'GT-003', style: '记牌流', bio: '把把算到最后一轮，就是手慢', color: [[59, 125, 216], [36, 87, 143]] },
  { name: '大刘', player_code: 'GT-004', style: '闷声发财', bio: '话最少，分最多', color: [[91, 61, 138], [70, 45, 110]] },
  { name: '婷婷', player_code: 'GT-005', style: '搭档控', bio: '配合意识拉满，最喜欢补位', color: [[201, 138, 0], [150, 105, 10]] },
  { name: '老周', player_code: 'GT-006', style: '心理战', bio: '专挑你犹豫那一秒压牌', color: [[194, 65, 12], [154, 52, 10]] },
];

/** 每局：{ day, deck, red: [...], blue: [...] }，4 人 2v2（末局为 3 副牌） */
const MATCHES = [
  {
    day: '2026-09-05', deck: 2, time: '19:40:00',
    red: [{ p: '老王', s: 65, f: true }, { p: '小陈', s: 40, f: true }],
    blue: [{ p: '阿强', s: 55, f: true }, { p: '大刘', s: 25, f: false }],
    note: '开季第一局，大刘压着分没走成',
  },
  {
    day: '2026-09-05', deck: 2, time: '21:10:00',
    red: [{ p: '阿强', s: 50, f: true }, { p: '老周', s: 35, f: true }],
    blue: [{ p: '老王', s: 60, f: true }, { p: '婷婷', s: 45, f: true }],
  },
  {
    day: '2026-09-12', deck: 2, time: '20:00:00',
    red: [{ p: '老王', s: 60, f: true }, { p: '婷婷', s: 20, f: false }],
    blue: [{ p: '小陈', s: 55, f: true }, { p: '大刘', s: 50, f: true }],
    note: '婷婷最后一张没走成，20 分作废',
  },
  {
    day: '2026-09-12', deck: 2, time: '21:30:00',
    red: [{ p: '大刘', s: 80, f: true }, { p: '老周', s: 10, f: false }],
    blue: [{ p: '阿强', s: 65, f: true }, { p: '老王', s: 40, f: true }],
  },
  {
    day: '2026-09-19', deck: 3, time: '19:30:00',
    red: [{ p: '老王', s: 85, f: true }, { p: '小陈', s: 70, f: true }],
    blue: [{ p: '阿强', s: 80, f: true }, { p: '大刘', s: 65, f: true }],
    note: '三副牌的硬仗，300 分全部分完',
  },
  {
    day: '2026-09-19', deck: 2, time: '21:00:00',
    red: [{ p: '婷婷', s: 50, f: true }, { p: '老周', s: 45, f: true }],
    blue: [{ p: '小陈', s: 55, f: true }, { p: '老王', s: 45, f: true }],
    note: '蓝队正好 100 分，差一分，谁都没赢',
  },
  {
    day: '2026-09-26', deck: 2, time: '19:50:00',
    red: [{ p: '老王', s: 75, f: true }, { p: '阿强', s: 35, f: true }],
    blue: [{ p: '大刘', s: 60, f: true }, { p: '小陈', s: 30, f: false }],
  },
  {
    day: '2026-09-26', deck: 2, time: '21:20:00',
    red: [{ p: '小陈', s: 75, f: true }, { p: '婷婷', s: 15, f: false }],
    blue: [{ p: '老周', s: 70, f: true }, { p: '老王', s: 40, f: true }],
    note: '老周压着最后两张，稳稳收场',
  },
];

const HIGHLIGHTS = [
  {
    day: '2026-09-05', title: '开季第一局就打出 105:55', kind: '名场面', player: '老王',
    content: '老王和小陈开局就抢下两张 K，红队一路压着打，最后 105:55 拿下开季首胜。大刘手里那 25 分没走成，白白作废。',
  },
  {
    day: '2026-09-12', title: '三副牌 300 分全部分完', kind: '神级配合', player: '老王',
    content: '这场打到最后一轮，300 分一分不剩全落在四个人手里。老王 85 分，红队 155:145 险胜，是本赛季最胶着的一局。',
  },
  {
    day: '2026-09-19', title: '差一分，谁都没赢', kind: '精彩瞬间', player: '小陈',
    content: '蓝队把「出完牌的人」分数加起来正好 100 分 —— 恰好是一半，按规则必须「超过」才算赢。全场看着记分员反复确认了三遍。',
  },
  {
    day: '2026-09-26', title: '老周压牌压到最后一轮', kind: '逆风翻盘', player: '老周',
    content: '红队一度 75 分领先，老周手里攥着两张 K 一直不出，等到最后两轮连着甩出来，蓝队 110 分反超。',
  },
];

/* ---------------------------------------------------------------- 主流程 */

async function main() {
  console.log(`\n沟通牌 · 演示数据生成\n服务地址：${BASE}\n`);

  const health = await fetch(`${BASE}/api/health`).catch(() => null);
  if (!health || !health.ok) {
    console.error(`连不上服务（${BASE}）。请先启动：node server.js\n`);
    process.exit(1);
  }

  const existing = await must('GET', '/api/bootstrap');
  if (existing.seasons.length > 0 || existing.players.length > 0) {
    console.log('数据库中已有数据，为避免覆盖，演示数据未生成。');
    console.log('如需重新演示，请先清空 data/ 目录后重试。\n');
    return;
  }

  // 1) 赛季
  const season = await must('POST', '/api/seasons', {
    name: '2026 秋季赛',
    deck_count: 2,
    started_on: '2026-09-01',
    note: '每周五晚，两副牌。第五局起升级为三副牌。',
  });
  console.log(`✓ 赛季「${season.name}」`);

  // 2) 玩家 + 头像
  const idOf = new Map();
  for (const p of PLAYERS) {
    const created = await must('POST', '/api/players', {
      name: p.name,
      player_code: p.player_code,
      style: p.style,
      bio: p.bio,
    });
    idOf.set(p.name, created.id);

    const png = makeAvatarPng(128, p.color[0], p.color[1]);
    await must('POST', `/api/players/${created.id}/avatar`, {
      dataUrl: `data:image/png;base64,${png.toString('base64')}`,
    });
  }
  console.log(`✓ ${PLAYERS.length} 名玩家（含头像）`);

  // 3) 对局
  for (const m of MATCHES) {
    const saved = await must('POST', '/api/matches', {
      season_id: season.id,
      deck_count: m.deck,
      played_at: `${m.day} ${m.time}`,
      table_name: '1 号桌',
      note: m.note || '',
      camps: [
        { name: '红队', color: '#d64545', players: m.red.map((x) => ({ player_id: idOf.get(x.p), score: x.s, finished: x.f })) },
        { name: '蓝队', color: '#3b7dd8', players: m.blue.map((x) => ({ player_id: idOf.get(x.p), score: x.s, finished: x.f })) },
      ],
    });
    const winner = (saved.camps || []).find((c) => c.is_winner);
    console.log(
      `✓ 对局 #${saved.id} ${m.day}　${m.deck} 副牌　` +
        (winner ? `${winner.name} ${winner.total_score} 分获胜` : '无阵营过线')
    );
  }

  // 4) 高光
  for (const h of HIGHLIGHTS) {
    await must('POST', '/api/highlights', {
      season_id: season.id,
      player_id: idOf.get(h.player),
      title: h.title,
      kind: h.kind,
      content: h.content,
      happened_on: h.day,
    });
  }
  console.log(`✓ ${HIGHLIGHTS.length} 条高光时刻`);

  const final = await must('GET', '/api/bootstrap');
  console.log(`\n完成：${final.matches.length} 局对局、${final.players.length} 名玩家、${final.highlights.length} 条高光。`);
  console.log(`打开 ${BASE} 查看效果。\n`);
}

main().catch((err) => {
  console.error('\n生成演示数据失败：', err.message);
  process.exit(1);
});
