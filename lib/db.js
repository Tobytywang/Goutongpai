'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.join(__dirname, '..');
/** 数据目录可用环境变量覆盖，方便 Docker 挂载卷或测试隔离 */
const DATA_DIR = process.env.GTP_DATA_DIR ? path.resolve(process.env.GTP_DATA_DIR) : path.join(ROOT_DIR, 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'goutongpai.db');

let db = null;

const SCHEMA = `
-- 用 DELETE（回滚日志）而非 WAL：单写者记账场景无需 WAL 的并发优势，
-- 且 WAL 的 -shm 需要 mmap，在部分容器卷文件系统上会 disk I/O error。
-- 同时显式 mmap_size=0，彻底禁止 SQLite 对库文件做内存映射（bind 挂载到宿主机
-- ext4/xfs 后本应没问题，此行为额外保险）。部署改用 bind 挂载而非命名卷后该问题消除。
PRAGMA journal_mode = DELETE;
PRAGMA mmap_size = 0;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS seasons (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  deck_count  INTEGER NOT NULL DEFAULT 2,
  status      TEXT    NOT NULL DEFAULT 'active',
  started_on  TEXT,
  ended_on    TEXT,
  note        TEXT,
  created_at  TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS players (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  player_code TEXT,
  avatar      TEXT,
  photo       TEXT,
  bio         TEXT,
  style       TEXT,
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS matches (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  season_id      INTEGER NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  table_name     TEXT,
  seq            INTEGER,          -- 当天第几局（录入时可改，历史数据回填）
  deck_count     INTEGER NOT NULL,
  deck_total     INTEGER NOT NULL,
  win_line       INTEGER NOT NULL,
  winner_camp_id INTEGER,
  played_at      TEXT    NOT NULL,
  note           TEXT,
  created_at     TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS camps (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id    INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL,
  color       TEXT,
  total_score INTEGER NOT NULL DEFAULT 0,
  is_winner   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS scores (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id  INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  camp_id   INTEGER NOT NULL REFERENCES camps(id) ON DELETE CASCADE,
  score     INTEGER NOT NULL DEFAULT 0,
  finished  INTEGER NOT NULL DEFAULT 0,
  is_mvp    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS highlights (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  season_id   INTEGER REFERENCES seasons(id) ON DELETE SET NULL,
  match_id    INTEGER REFERENCES matches(id) ON DELETE SET NULL,
  player_id   INTEGER REFERENCES players(id) ON DELETE SET NULL,
  title       TEXT    NOT NULL,
  content     TEXT,
  image       TEXT,
  kind        TEXT,
  happened_on TEXT,
  created_at  TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_matches_season ON matches(season_id);
CREATE INDEX IF NOT EXISTS idx_camps_match    ON camps(match_id);
CREATE INDEX IF NOT EXISTS idx_scores_match   ON scores(match_id);
CREATE INDEX IF NOT EXISTS idx_scores_player  ON scores(player_id);
CREATE INDEX IF NOT EXISTS idx_hl_season      ON highlights(season_id);

CREATE TABLE IF NOT EXISTS highlight_players (
  highlight_id INTEGER NOT NULL REFERENCES highlights(id) ON DELETE CASCADE,
  player_id    INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  PRIMARY KEY (highlight_id, player_id)
);
CREATE INDEX IF NOT EXISTS idx_hlp_highlight ON highlight_players(highlight_id);
CREATE INDEX IF NOT EXISTS idx_hlp_player    ON highlight_players(player_id);
`;

function ensureDirs() {
  for (const dir of [DATA_DIR, UPLOAD_DIR]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * 打开数据库并建表。node:sqlite 需要 Node >= 22.5。
 */
function backfillHighlightPlayers() {
  // 旧数据：highlights.player_id 单列 → 关联表（只跑一次，幂等）
  run(
    `INSERT OR IGNORE INTO highlight_players (highlight_id, player_id)
     SELECT id, player_id FROM highlights
     WHERE player_id IS NOT NULL
       AND id NOT IN (SELECT highlight_id FROM highlight_players)`
  );
}

/** 对局只记日期：把历史带时刻的 played_at 截断为 YYYY-MM-DD（幂等） */
function normalizeMatchDates() {
  run(`UPDATE matches SET played_at = substr(played_at, 1, 10) WHERE played_at IS NOT NULL AND length(played_at) > 10`);
}

/** 旧库补列：matches.seq（幂等） */
function ensureMatchSeqColumn() {
  const cols = all('PRAGMA table_info(matches)');
  if (!cols.some((c) => c.name === 'seq')) run('ALTER TABLE matches ADD COLUMN seq INTEGER');
}

/** 历史对局补「第几局」：同一天内按 id 升序编号（只补空值，幂等） */
function backfillMatchSeq() {
  run(
    `UPDATE matches SET seq = (
       SELECT COUNT(*) + 1 FROM matches m2
        WHERE substr(m2.played_at, 1, 10) = substr(matches.played_at, 1, 10)
          AND m2.id < matches.id
     )
     WHERE seq IS NULL AND played_at IS NOT NULL`
  );
}

function init() {
  if (db) return db;
  ensureDirs();

  let DatabaseSync;
  try {
    ({ DatabaseSync } = require('node:sqlite'));
  } catch (err) {
    throw new Error(
      '当前 Node.js 版本不支持内置 node:sqlite 模块（需要 Node >= 22.5.0）。\n' +
        '当前版本：' +
        process.version +
        '\n请升级 Node.js 后重试，或改用随附的 Docker 方式部署。'
    );
  }

  db = new DatabaseSync(DB_FILE);
  db.exec(SCHEMA);
  backfillHighlightPlayers();
  normalizeMatchDates();
  ensureMatchSeqColumn();
  backfillMatchSeq();
  return db;
}

function handle() {
  if (!db) init();
  return db;
}

/** 查询多行 */
function all(sql, ...params) {
  return handle().prepare(sql).all(...params);
}

/** 查询单行，无结果返回 null */
function get(sql, ...params) {
  const row = handle().prepare(sql).get(...params);
  return row === undefined ? null : row;
}

/** 执行写入，返回 { changes, lastInsertRowid } */
function run(sql, ...params) {
  const info = handle().prepare(sql).run(...params);
  return {
    changes: Number(info.changes),
    lastInsertRowid: Number(info.lastInsertRowid),
  };
}

/** 事务包装 */
function tx(fn) {
  const h = handle();
  h.exec('BEGIN');
  try {
    const out = fn();
    h.exec('COMMIT');
    return out;
  } catch (err) {
    try {
      h.exec('ROLLBACK');
    } catch (_) {
      /* 回滚失败时保留原始错误 */
    }
    throw err;
  }
}

/** now() 统一为本地时间的 ISO 字符串（分钟精度足够，便于阅读） */
function now() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

module.exports = {
  init,
  all,
  get,
  run,
  tx,
  now,
  handle,
  ROOT_DIR,
  DATA_DIR,
  UPLOAD_DIR,
  DB_FILE,
};
