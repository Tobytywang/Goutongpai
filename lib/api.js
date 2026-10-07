'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');

const db = require('./db');
const score = require('./score');

/**
 * 网页端只读模式：默认开启。
 * 设为 'false'（环境变量 WEB_READONLY=false）可让网页端恢复写入能力；
 * 小程序始终通过 wx.request 写入，不受此开关影响。
 */
const WEB_READONLY = (process.env.WEB_READONLY || 'true') === 'true';

// ---------------------------------------------------------------- 工具

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const bad = (msg) => new ApiError(400, msg);
const notFound = (msg) => new ApiError(404, msg);

function str(value, { max = 200, required = false, field = '字段' } = {}) {
  if (value === undefined || value === null) {
    if (required) throw bad(`${field}不能为空`);
    return null;
  }
  const s = String(value).trim();
  if (required && !s) throw bad(`${field}不能为空`);
  return s.slice(0, max) || null;
}

function int(value, fallback = 0) {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) ? n : fallback;
}

function bool01(value) {
  return value === true || value === 1 || value === '1' || value === 'true' ? 1 : 0;
}

const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 单张图片落盘上限 4MB（前端预算只有几百 KB，这里只兜底）
const MAX_IMAGE_SIDE = 4000; // 单边像素上限
const MAX_IMAGE_PIXELS = 12 * 1000 * 1000; // 总像素上限（约 12MP），挡掉"边长不大但巨幅"的图

const IMAGE_TYPES = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/avif': '.avif',
};

/**
 * 零依赖读图片尺寸：只解文件头（PNG / GIF / WebP / JPEG 的 SOF 段）。
 * 解不出来（如 AVIF）返回 null —— 后端没有解码器，只能对能识别的格式做尺寸兜底。
 */
function imageSize(buf) {
  // PNG：签名 + IHDR（宽高为大端 4 字节）
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  // GIF：逻辑屏幕宽高，小端 2 字节
  if (buf.length > 10 && buf.toString('ascii', 0, 3) === 'GIF') {
    return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  }
  // WebP：RIFF....WEBP + 三种子格式
  if (buf.length > 32 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const fourcc = buf.toString('ascii', 12, 16);
    if (fourcc === 'VP8X') return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
    if (fourcc === 'VP8 ') return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    if (fourcc === 'VP8L') {
      const bits = buf.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    return null;
  }
  // JPEG：跳过各段找 SOF（C0-CF，排除 C4/C8/CC）
  if (buf.length > 4 && buf.readUInt16BE(0) === 0xffd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) {
        i += 1;
        continue;
      }
      const marker = buf[i + 1];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        i += 2;
        continue;
      }
      if (marker === 0xda || marker === 0xd9) break; // 进了压缩数据就别扫了
      const segLen = buf.readUInt16BE(i + 2);
      const isSOF = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSOF) return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      i += 2 + segLen;
    }
    return null;
  }
  return null;
}

/**
 * 把 data URL 落盘为 uploads/ 下的文件，返回文件名。
 * 加工（缩尺寸 + 压品质）在前端 canvas 做（见 public/js/util.js 的 IMAGE_PRESETS），
 * 这里做兜底校验：格式、体积、尺寸。后端不重新编码（零依赖，没有图片编解码器）。
 */
function saveDataUrl(dataUrl, prefix) {
  const raw = String(dataUrl || '');
  const m = /^data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,([\s\S]+)$/i.exec(raw);
  if (!m) throw bad('图片数据格式不正确，需要通过 data URL 方式提交图片');

  const mime = m[1].toLowerCase();
  if (!mime.startsWith('image/')) {
    throw bad(`不支持的文件类型 ${mime}，请上传 PNG / JPG / WebP / GIF 图片`);
  }

  const ext = IMAGE_TYPES[mime];
  if (!ext) throw bad(`不支持的图片格式：${mime}，请使用 PNG / JPG / WebP / GIF`);

  const buf = Buffer.from(m[2], 'base64');
  if (buf.length === 0) throw bad('图片内容为空');
  if (buf.length > MAX_IMAGE_BYTES) {
    throw bad(
      `图片文件过大（${(buf.length / 1024 / 1024).toFixed(1)}MB），请压缩到 ${MAX_IMAGE_BYTES / 1024 / 1024}MB 以内`
    );
  }

  const size = imageSize(buf);
  if (size) {
    const maxSide = Math.max(size.width, size.height);
    if (maxSide > MAX_IMAGE_SIDE || size.width * size.height > MAX_IMAGE_PIXELS) {
      throw bad(
        `图片尺寸 ${size.width}×${size.height} 过大，请先缩到 ${MAX_IMAGE_SIDE}px 以内再上传` +
          `（浏览器端正常上传会自动缩放，出现这个提示通常是绕过了页面直接调接口）`
      );
    }
  }

  const name = `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
  fs.writeFileSync(path.join(db.UPLOAD_DIR, name), buf);
  return name;
}

/** 删除 uploads 下的旧文件，忽略失败 */
function removeUpload(fileName) {
  if (!fileName) return;
  const target = path.join(db.UPLOAD_DIR, path.basename(fileName));
  fs.rm(target, { force: true }, () => {});
}

// ---------------------------------------------------------------- 读取

/** 拉取全量数据，前端一次性加载后在本地做各种统计 */
function bootstrap() {
  const seasons = db.all('SELECT * FROM seasons ORDER BY pinned DESC, started_on DESC, id DESC');
  for (const s of seasons) {
    s.matchCount = db.get('SELECT COUNT(*) AS n FROM matches WHERE season_id = ?', s.id).n;
    s.playerCount = db.get(
      `SELECT COUNT(DISTINCT sc.player_id) AS n
         FROM scores sc
         JOIN matches m ON m.id = sc.match_id
        WHERE m.season_id = ?`,
      s.id
    ).n;
  }
  const players = db.all('SELECT * FROM players ORDER BY name ASC');
  const camps = db.all('SELECT * FROM camps ORDER BY match_id ASC, id ASC');
  const scores = db.all('SELECT * FROM scores ORDER BY match_id ASC, id ASC');
  const highlights = db
    .all(
      `SELECT h.*,
              (SELECT group_concat(player_id) FROM highlight_players WHERE highlight_id = h.id) AS player_ids_csv
       FROM highlights h
       ORDER BY COALESCE(h.happened_on, h.created_at) DESC, h.id DESC`
    )
    .map((h) => ({
      ...h,
      player_ids: h.player_ids_csv ? h.player_ids_csv.split(',').map(Number) : h.player_id ? [Number(h.player_id)] : [],
    }));

  const matchRows = db.all(
    `SELECT m.*, s.name AS season_name
       FROM matches m
       LEFT JOIN seasons s ON s.id = m.season_id
      ORDER BY m.played_at DESC, m.id DESC`
  );

  const campsByMatch = new Map();
  for (const c of camps) {
    if (!campsByMatch.has(c.match_id)) campsByMatch.set(c.match_id, []);
    campsByMatch.get(c.match_id).push({
      id: c.id,
      name: c.name,
      color: c.color,
      total_score: c.total_score,
      is_winner: !!c.is_winner,
      players: [],
    });
  }

  const campIndex = new Map();
  for (const list of campsByMatch.values()) {
    for (const c of list) campIndex.set(c.id, c);
  }

  for (const s of scores) {
    const camp = campIndex.get(s.camp_id);
    if (!camp) continue;
    camp.players.push({
      player_id: s.player_id,
      score: s.score,
      finished: !!s.finished,
      is_mvp: !!s.is_mvp,
    });
  }

  const matches = matchRows.map((m) => ({
    id: m.id,
    season_id: m.season_id,
    season_name: m.season_name,
    table_name: m.table_name,
    seq: m.seq,
    deck_count: m.deck_count,
    deck_total: m.deck_total,
    win_line: m.win_line,
    winner_camp_id: m.winner_camp_id,
    played_at: m.played_at,
    note: m.note,
    created_at: m.created_at,
    camps: campsByMatch.get(m.id) || [],
  }));

  return {
    seasons,
    players,
    matches,
    highlights,
  meta: {
    pointsPerDeck: score.POINTS_PER_DECK,
    deckBreakdown: score.DECK_BREAKDOWN,
    serverTime: db.now(),
    webReadonly: WEB_READONLY,
  },
  };
}

// ---------------------------------------------------------------- 玩家

function createPlayer(body) {
  const name = str(body.name, { required: true, field: '玩家昵称', max: 6 });
  const bio = str(body.bio, { max: 300, field: '个性签名' });
  // 玩家 ID：留空时按自增 id 自动生成；用户填写时必须是 GT- 加三位数字且不可重复
  const playerCode = str(body.player_code, { max: 40, field: '玩家 ID' }) || null;
  const style = str(body.style, { max: 40, field: '签名' });

  if (playerCode && !/^GT-\d{3}$/.test(playerCode)) {
    throw bad('玩家 ID 必须是 GT- 加三位数字（如 GT-001）');
  }
  if (playerCode && db.get('SELECT id FROM players WHERE player_code = ?', playerCode)) {
    throw bad(`玩家 ID「${playerCode}」已被使用，请更换编号`);
  }

  const duplicated = db.get('SELECT id FROM players WHERE name = ?', name);
  if (duplicated) throw bad(`已存在同名玩家「${name}」，换个昵称或加个后缀`);

  const { lastInsertRowid } = db.run(
    `INSERT INTO players (name, player_code, bio, style, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    name,
    playerCode,
    bio,
    style,
    db.now()
  );

  if (!playerCode) {
    let code = `GT-${String(lastInsertRowid).padStart(3, '0')}`;
    if (db.get('SELECT id FROM players WHERE player_code = ? AND id <> ?', code, lastInsertRowid)) {
      code = `${code}-${lastInsertRowid}`;
    }
    db.run('UPDATE players SET player_code = ? WHERE id = ?', code, lastInsertRowid);
  }

  return db.get('SELECT * FROM players WHERE id = ?', lastInsertRowid);
}

function updatePlayer(id, body) {
  const current = db.get('SELECT * FROM players WHERE id = ?', id);
  if (!current) throw notFound('玩家不存在');

  const name = body.name === undefined ? current.name : str(body.name, { required: true, field: '玩家昵称', max: 6 });
  const duplicated = db.get('SELECT id FROM players WHERE name = ? AND id <> ?', name, id);
  if (duplicated) throw bad(`已存在同名玩家「${name}」`);

  db.run(
    `UPDATE players
        SET name = ?, player_code = ?, bio = ?, style = ?
      WHERE id = ?`,
    name,
    body.player_code === undefined ? current.player_code : str(body.player_code, { max: 40 }),
    body.bio === undefined ? current.bio : str(body.bio, { max: 300 }),
    body.style === undefined ? current.style : str(body.style, { max: 40 }),
    id
  );
  return db.get('SELECT * FROM players WHERE id = ?', id);
}

function deletePlayer(id) {
  const current = db.get('SELECT * FROM players WHERE id = ?', id);
  if (!current) throw notFound('玩家不存在');

  // 有对局记录的玩家禁止删除：删除会级联清除其全部历史战绩，且已无「停用」机制可软下架
  const played = db.get('SELECT COUNT(*) AS n FROM scores WHERE player_id = ?', id);
  if (played.n > 0) {
    throw bad(
      `该玩家已有 ${played.n} 条对局记录，无法删除（删除会导致历史战绩不可逆丢失）。`
    );
  }

  removeUpload(current.avatar);
  removeUpload(current.photo);
  db.run('DELETE FROM players WHERE id = ?', id);
  return { deleted: true };
}

function uploadPlayerImage(id, body, kind) {
  const current = db.get('SELECT * FROM players WHERE id = ?', id);
  if (!current) throw notFound('玩家不存在');

  const fileName = saveDataUrl(body.dataUrl, `${kind}-p${id}`);
  const column = kind === 'avatar' ? 'avatar' : 'photo';
  removeUpload(current[column]);

  db.run(`UPDATE players SET ${column} = ? WHERE id = ?`, fileName, id);
  return db.get('SELECT * FROM players WHERE id = ?', id);
}

// 赛季背景图：与玩家头像/背景共用 saveDataUrl 落盘 + 旧图清理逻辑
function uploadSeasonImage(id, body) {
  const current = db.get('SELECT * FROM seasons WHERE id = ?', id);
  if (!current) throw notFound('赛季不存在');

  const fileName = saveDataUrl(body.dataUrl, `photo-s${id}`);
  removeUpload(current.photo);

  db.run('UPDATE seasons SET photo = ? WHERE id = ?', fileName, id);
  return db.get('SELECT * FROM seasons WHERE id = ?', id);
}

// ---------------------------------------------------------------- 赛季

// 赛季默认结束时间：未填写时取当年当月最后一天
function currentMonthEnd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const lastDay = new Date(y, m, 0).getDate();
  return `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

function createSeason(body) {
  const rawName = String(body.name || '').trim();
  if (!rawName) throw bad('赛季名称不能为空');
  if (rawName.length > 8) throw bad('赛季名称最多8个字符');
  const name = str(rawName, { required: true, field: '赛季名称', max: 8 });
  const note = str(body.note, { max: 500, field: '备注' });

  // 首个赛季自动置为「当前」（全局有且仅 1 个当前赛季）
  const isFirst = db.get('SELECT COUNT(*) AS n FROM seasons').n === 0 ? 1 : 0;

  const { lastInsertRowid } = db.run(
    `INSERT INTO seasons (name, status, started_on, ended_on, note, pinned, created_at)
     VALUES (?, 'active', ?, ?, ?, ?, ?)`,
    name,
    str(body.started_on, { max: 20 }) || db.now().slice(0, 10),
    str(body.ended_on, { max: 20 }) || currentMonthEnd(),
    note,
    isFirst,
    db.now()
  );
  return db.get('SELECT * FROM seasons WHERE id = ?', lastInsertRowid);
}

function updateSeason(id, body) {
  const current = db.get('SELECT * FROM seasons WHERE id = ?', id);
  if (!current) throw notFound('赛季不存在');

  const status = body.status === undefined ? current.status : String(body.status);
  if (!['active', 'archived'].includes(status)) throw bad('赛季状态只能是 active（进行中）或 archived（已归档）');

  let name = current.name;
  if (body.name !== undefined) {
    const rawName = String(body.name || '').trim();
    if (!rawName) throw bad('赛季名称不能为空');
    if (rawName.length > 8) throw bad('赛季名称最多8个字符');
    name = str(rawName, { required: true, field: '赛季名称', max: 8 });
  }

  db.run(
    `UPDATE seasons SET name = ?, status = ?, started_on = ?, ended_on = ?, note = ?
      WHERE id = ?`,
    name,
    status,
    body.started_on === undefined ? current.started_on : str(body.started_on, { max: 20 }),
    body.ended_on === undefined
      ? status === 'archived' && !current.ended_on
        ? db.now().slice(0, 10)
        : (current.ended_on || currentMonthEnd())
      : str(body.ended_on, { max: 20 }) || currentMonthEnd(),
    body.note === undefined ? current.note : str(body.note, { max: 500 }),
    id
  );
  return db.get('SELECT * FROM seasons WHERE id = ?', id);
}

function pinSeason(id) {
  const current = db.get('SELECT * FROM seasons WHERE id = ?', id);
  if (!current) throw notFound('赛季不存在');

  // 设为「当前」赛季：清空全部置顶后再置本季为当前（全局有且仅 1 个）；
  // 不提供取消操作，只能点击另一个赛季的「置为当前」来顶替它
  db.run('UPDATE seasons SET pinned = 0');
  db.run('UPDATE seasons SET pinned = 1 WHERE id = ?', id);
  return db.get('SELECT * FROM seasons WHERE id = ?', id);
}

function deleteSeason(id) {
  const current = db.get('SELECT * FROM seasons WHERE id = ?', id);
  if (!current) throw notFound('赛季不存在');

  // 有对局的赛季禁止删除：赛季是对局的归属容器，删赛季会因外键 CASCADE 连同删除全部对局与历史战绩
  const matchCount = db.get('SELECT COUNT(*) AS n FROM matches WHERE season_id = ?', id).n;
  if (matchCount > 0) {
    throw bad(
      `该赛季已有 ${matchCount} 局对局记录，无法删除（删除会导致历史对局与战绩不可逆丢失）。`
    );
  }

  const hl = db.all('SELECT image FROM highlights WHERE season_id = ?', id);
  hl.forEach((r) => removeUpload(r.image));

  removeUpload(current.photo);

  db.run('DELETE FROM seasons WHERE id = ?', id);

  // 删除后若已无「当前」赛季但有剩余赛季，自动把最近的一个置为当前，保证始终有当前赛季
  if (db.get('SELECT COUNT(*) AS n FROM seasons').n > 0) {
    const anyPinned = db.get('SELECT COUNT(*) AS n FROM seasons WHERE pinned = 1').n;
    if (!anyPinned) {
      const next = db.get('SELECT * FROM seasons ORDER BY started_on DESC, id DESC LIMIT 1');
      if (next) db.run('UPDATE seasons SET pinned = 1 WHERE id = ?', next.id);
    }
  }
  return { deleted: true };
}

// ---------------------------------------------------------------- 对局

/**
 * 创建一局。
 * 后端重新计算阵营总分与胜负，不信任前端传来的计算结果。
 */
function createMatch(body) {
  const season = db.get('SELECT * FROM seasons WHERE id = ?', int(body.season_id));
  if (!season) throw bad('赛季不存在，请先选择正确的赛季');

  const deckCount = score.clampDeckCount(body.deck_count || 2);
  const deckTotal = score.deckTotal(deckCount);
  const winLine = score.winLine(deckCount);
  const playedAt = str(body.played_at, { max: 30 }) || db.now();
  const tableName = str(body.table_name, { max: 40, field: '桌号' });
  const note = str(body.note, { max: 500, field: '备注' });
  // 当天第几局：可选，缺省时按当天已有对局数自动递增
  const seqInput = body.seq === undefined || body.seq === null || body.seq === '' ? 0 : int(body.seq);
  const seq =
    seqInput > 0
      ? seqInput
      : db.get(
          'SELECT COALESCE(MAX(seq), 0) + 1 AS n FROM matches WHERE substr(played_at, 1, 10) = ?',
          String(playedAt).slice(0, 10)
        ).n;

  const camps = Array.isArray(body.camps) ? body.camps : [];
  if (camps.length < 2) throw bad('至少需要 2 个阵营');
  if (camps.length > 4) throw bad('阵营数量最多 4 个');

  const seenPlayers = new Set();
  const normalized = camps.map((camp, idx) => {
    const name = str(camp && camp.name, { max: 40 }) || `阵营 ${idx + 1}`;
    const color = str(camp && camp.color, { max: 20 });
    const members = Array.isArray(camp && camp.players) ? camp.players : [];
    if (members.length === 0) throw bad(`「${name}」还没有玩家，请至少放 1 名玩家`);

    const list = members.map((p) => {
      const playerId = int(p && p.player_id);
      const exists = db.get('SELECT id FROM players WHERE id = ?', playerId);
      if (!exists) throw bad(`阵营「${name}」中存在无效玩家（id=${playerId}）`);
      if (seenPlayers.has(playerId)) throw bad(`同一名玩家不能同时出现在两个阵营`);
      seenPlayers.add(playerId);
      return {
        player_id: playerId,
        score: score.toScore(p && p.score),
        finished: bool01(p && p.finished),
        is_mvp: bool01(p && p.is_mvp),
      };
    });

    return { name, color, players: list };
  });

  // 录入总额校验：所有玩家分数之和（含未出完）不可超过牌库总分
  const recordedTotal = normalized.reduce(
    (sum, c) => sum + c.players.reduce((t, p) => t + p.score, 0),
    0
  );
  if (recordedTotal > deckTotal) {
    throw bad(`录入总分 ${recordedTotal} 超过牌库总分 ${deckTotal}，请核对分数（牌库只有 ${deckTotal} 分）`);
  }
  for (const c of normalized) {
    for (const p of c.players) {
      if (p.score > deckTotal) {
        throw bad(`单名玩家分数 ${p.score} 超过牌库总分 ${deckTotal}，请核对分数`);
      }
    }
  }

  // 未出完牌的玩家分数不计入阵营总分
  const preview = score.computeMatch(
    normalized.map((c, i) => ({ id: i, name: c.name, color: c.color })),
    normalized.flatMap((c, i) =>
      c.players.map((p) => ({ camp_id: i, score: p.score, finished: p.finished, is_mvp: p.is_mvp }))
    ),
    deckCount
  );

  const matchId = db.tx(() => {
    const { lastInsertRowid } = db.run(
      `INSERT INTO matches (season_id, table_name, seq, deck_count, deck_total, win_line, winner_camp_id, played_at, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
      season.id,
      tableName,
      seq,
      deckCount,
      deckTotal,
      winLine,
      playedAt,
      note,
      db.now()
    );
    const mid = lastInsertRowid;

    let winnerCampId = null;
    normalized.forEach((camp, i) => {
      const stat = preview.rows[i];
      const res = db.run(
        `INSERT INTO camps (match_id, name, color, total_score, is_winner) VALUES (?, ?, ?, ?, ?)`,
        mid,
        camp.name,
        camp.color,
        stat.totalScore,
        stat.isWinner ? 1 : 0
      );
      if (stat.isWinner && winnerCampId === null) winnerCampId = res.lastInsertRowid;

      for (const p of camp.players) {
        db.run(
          `INSERT INTO scores (match_id, player_id, camp_id, score, finished, is_mvp)
           VALUES (?, ?, ?, ?, ?, ?)`,
          mid,
          p.player_id,
          res.lastInsertRowid,
          p.score,
          p.finished,
          p.is_mvp
        );
      }
    });

    if (winnerCampId !== null) {
      db.run('UPDATE matches SET winner_camp_id = ? WHERE id = ?', winnerCampId, mid);
    }
    return mid;
  });

  return getMatch(matchId);
}

function getMatch(id) {
  const m = db.get(
    `SELECT m.*, s.name AS season_name FROM matches m LEFT JOIN seasons s ON s.id = m.season_id WHERE m.id = ?`,
    id
  );
  if (!m) throw notFound('对局不存在');

  const camps = db.all('SELECT * FROM camps WHERE match_id = ? ORDER BY id ASC', id);
  const scores = db.all('SELECT * FROM scores WHERE match_id = ? ORDER BY id ASC', id);

  return {
    ...m,
    camps: camps.map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
      total_score: c.total_score,
      is_winner: !!c.is_winner,
      players: scores
        .filter((s) => s.camp_id === c.id)
        .map((s) => ({
          player_id: s.player_id,
          score: s.score,
          finished: !!s.finished,
          is_mvp: !!s.is_mvp,
        })),
    })),
  };
}

function deleteMatch(id) {
  const current = db.get('SELECT id FROM matches WHERE id = ?', id);
  if (!current) throw notFound('对局不存在');

  const hl = db.all('SELECT id, image FROM highlights WHERE match_id = ?', id);
  hl.forEach((h) => {
    db.run('DELETE FROM highlight_players WHERE highlight_id = ?', h.id);
    removeUpload(h.image);
  });
  if (hl.length) db.run('UPDATE highlights SET match_id = NULL WHERE match_id = ?', id);

  db.run('DELETE FROM matches WHERE id = ?', id);
  return { deleted: true, unlinkedHighlights: hl.length };
}

// ---------------------------------------------------------------- 高光时刻

function createHighlight(body) {
  const title = str(body.title, { required: true, field: '高光标题', max: 80 });
  const content = str(body.content, { max: 1000, field: '高光描述' });
  const kind = str(body.kind, { max: 20 }) || '精彩瞬间';
  const seasonId = body.season_id ? int(body.season_id) : null;
  const matchId = body.match_id ? int(body.match_id) : null;
  const playerIds = Array.isArray(body.player_ids)
    ? body.player_ids.map((x) => int(x)).filter((x) => x > 0)
    : body.player_id
    ? [int(body.player_id)]
    : [];

  if (seasonId && !db.get('SELECT id FROM seasons WHERE id = ?', seasonId)) throw bad('关联的赛季不存在');
  if (matchId && !db.get('SELECT id FROM matches WHERE id = ?', matchId)) throw bad('关联的对局不存在');
  for (const pid of playerIds) {
    if (!db.get('SELECT id FROM players WHERE id = ?', pid)) throw bad('关联的玩家不存在');
  }

  // 没指定赛季时，若关联了对局则自动继承对局的赛季
  let finalSeasonId = seasonId;
  if (!finalSeasonId && matchId) {
    const m = db.get('SELECT season_id FROM matches WHERE id = ?', matchId);
    finalSeasonId = m ? m.season_id : null;
  }
  // 既没对局也没赛季时，落到当前进行中的赛季，保证高光有归属
  if (!finalSeasonId) {
    const cur = db.get("SELECT id FROM seasons WHERE status = 'active' ORDER BY id DESC LIMIT 1");
    finalSeasonId = cur ? cur.id : null;
  }

  const image = body.image ? saveDataUrl(body.image, 'hl') : null;

  const { lastInsertRowid } = db.run(
    `INSERT INTO highlights (season_id, match_id, player_id, title, content, image, kind, happened_on, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    finalSeasonId,
    matchId,
    playerIds[0] ?? null,
    title,
    content,
    image,
    kind,
    str(body.happened_on, { max: 20 }) || db.now().slice(0, 10),
    db.now()
  );
  const newId = Number(lastInsertRowid);
  for (const pid of playerIds) {
    db.run('INSERT OR IGNORE INTO highlight_players (highlight_id, player_id) VALUES (?, ?)', newId, pid);
  }
  return db.get('SELECT * FROM highlights WHERE id = ?', newId);
}

function updateHighlight(id, body) {
  const current = db.get('SELECT * FROM highlights WHERE id = ?', id);
  if (!current) throw notFound('高光记录不存在');

  let image = current.image;
  if (body.image === null) {
    removeUpload(current.image);
    image = null;
  } else if (typeof body.image === 'string' && body.image.startsWith('data:')) {
    removeUpload(current.image);
    image = saveDataUrl(body.image, 'hl');
  }

  db.run(
    `UPDATE highlights SET title = ?, content = ?, kind = ?, happened_on = ?, season_id = ?, match_id = ?, player_id = ?, image = ?
      WHERE id = ?`,
    body.title === undefined ? current.title : str(body.title, { required: true, field: '高光标题', max: 80 }),
    body.content === undefined ? current.content : str(body.content, { max: 1000 }),
    body.kind === undefined ? current.kind : str(body.kind, { max: 20 }),
    body.happened_on === undefined ? current.happened_on : str(body.happened_on, { max: 20 }),
    body.season_id === undefined ? current.season_id : body.season_id ? int(body.season_id) : null,
    body.match_id === undefined ? current.match_id : body.match_id ? int(body.match_id) : null,
    body.player_ids !== undefined
      ? Array.isArray(body.player_ids) && body.player_ids.length
        ? int(body.player_ids[0])
        : null
      : current.player_id,
    image,
    id
  );

  if (body.player_ids !== undefined) {
    db.run('DELETE FROM highlight_players WHERE highlight_id = ?', id);
    for (const pid of body.player_ids.map((x) => int(x)).filter((x) => x > 0)) {
      db.run('INSERT OR IGNORE INTO highlight_players (highlight_id, player_id) VALUES (?, ?)', id, pid);
    }
  }
  return db.get('SELECT * FROM highlights WHERE id = ?', id);
}

function deleteHighlight(id) {
  const current = db.get('SELECT * FROM highlights WHERE id = ?', id);
  if (!current) throw notFound('高光记录不存在');
  db.run('DELETE FROM highlight_players WHERE highlight_id = ?', id);
  removeUpload(current.image);
  db.run('DELETE FROM highlights WHERE id = ?', id);
  return { deleted: true };
}

// ---------------------------------------------------------------- 导出

// ---------------------------------------------------------------- 微信登录

const WX_APPID = process.env.WX_APPID || '';
const WX_SECRET = process.env.WX_SECRET || '';
const TOKEN_TTL = 7 * 24 * 3600 * 1000; // 7 天
/** token -> { openid, sessionKey, createdAt }。单进程内存存储，重启失效（小项目够用）。 */
const tokenStore = new Map();

function wxCode2Session(code) {
  return new Promise((resolve, reject) => {
    if (!WX_APPID || !WX_SECRET) {
      reject(bad('服务端未配置 WX_APPID / WX_SECRET 环境变量'));
      return;
    }
    const url =
      `https://api.weixin.qq.com/sns/jscode2session?appid=${WX_APPID}` +
      `&secret=${WX_SECRET}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`;
    https
      .get(url, (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          try {
            const json = JSON.parse(raw);
            if (json.errcode) {
              reject(bad(`微信登录失败(${json.errcode}): ${json.errmsg}`));
              return;
            }
            if (!json.openid) {
              reject(bad('微信未返回 openid'));
              return;
            }
            resolve({ openid: json.openid, sessionKey: json.session_key || '' });
          } catch (_) {
            reject(bad('微信返回数据解析失败'));
          }
        });
      })
      .on('error', (e) => reject(bad('请求微信登录接口失败: ' + e.message)));
  });
}

/**
 * 微信小程序登录：code -> openid -> 自定义 token。
 * secret 仅在服务端使用，绝不返回前端；session_key 存内存供后续解密（如需手机号）。
 */
function wxLogin(body) {
  const code = str(body.code, { required: true, field: 'login code' });
  return wxCode2Session(code).then(({ openid, sessionKey }) => {
    const token = crypto.randomBytes(16).toString('hex');
    tokenStore.set(token, { openid, sessionKey, createdAt: Date.now() });
    // 惰性清理过期 token，避免内存无限增长
    if (tokenStore.size > 5000) {
      const now = Date.now();
      for (const [k, v] of tokenStore) if (now - v.createdAt > TOKEN_TTL) tokenStore.delete(k);
    }
    return { token, openid };
  });
}

/** 按 token 取 openid（过期/无效返回 null）。供后续接口可选记录操作人。 */
function getOpenidByToken(token) {
  if (!token) return null;
  const info = tokenStore.get(token);
  if (!info) return null;
  if (Date.now() - info.createdAt > TOKEN_TTL) {
    tokenStore.delete(token);
    return null;
  }
  return info.openid;
}

module.exports = {
  ApiError,
  bootstrap,
  isWebReadonly: () => WEB_READONLY,
  createPlayer,
  updatePlayer,
  deletePlayer,
  uploadPlayerImage,
  createSeason,
  updateSeason,
  pinSeason,
  deleteSeason,
  uploadSeasonImage,
  createMatch,
  getMatch,
  deleteMatch,
  createHighlight,
  updateHighlight,
  deleteHighlight,
  wxLogin,
  getOpenidByToken,
};
