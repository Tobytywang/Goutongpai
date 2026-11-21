// 对局编辑表单的纯函数集（无 wx 依赖，可在页面中直接引用）。
// 说明：支持修改比分相关字段（各阵营玩家、分数、已出完、MVP）、对局类型与玩家技能，
// 日期 / 局次 / 牌副数 / 赛季 / 阵营结构保持不变。
//
// 计分预览必须与服务端 lib/score.js 同口径：小程序 utils/score.js 是历史复刻版，
// 缺少「全员出完即胜」补判定，且 toScore 未对齐 5 的倍数，因此这里做了一层对齐包装。
const score = require('./score');

// 与计分页保持一致：红 / 蓝 / 绿 / 紫
const CAMP_PRESETS = [
  { name: '红队', color: '#d64545', key: 'red' },
  { name: '蓝队', color: '#3b7dd8', key: 'blue' },
  { name: '绿队', color: '#2f9e63', key: 'green' },
  { name: '紫队', color: '#b165d4', key: 'purple' },
];

// 生成稳定唯一 id，用作 wx:for 的 key，避免输入过程中列表重建导致光标丢失
let _uidSeq = 0;
function uid() { return 'e' + (++_uidSeq); }

function emptyPlayer() {
  return {
    uid: uid(),
    playerId: null,
    playerName: '选择玩家',
    playerIdx: -1,
    score: '',
    finished: false,
    mvp: false,
    available: [],
    availIdx: -1,
    // 仅技能赛使用：skillId 对应 skills.id
    skillId: null,
    skillIdx: -1,
    skillName: '',
    // 是否锁定删除。初值 false，真实状态由 applyPlayerLocks 按行号统一计算
    locked: false,
  };
}

// 对局类型下拉选项（与计分页一致）
const MATCH_TYPES = [
  { value: 'normal', label: '普通赛' },
  { value: 'skill', label: '技能赛' },
];

/** 按当前技能字典重算 picker 下标与显示名；字典为空时原样返回，避免误清历史值 */
function withSkillIndex(camps, skills) {
  if (!skills || !skills.length) return camps;
  return camps.map((c) => Object.assign({}, c, {
    players: c.players.map((p) => {
      const idx = p.skillId != null ? skills.findIndex((s) => s.id === p.skillId) : -1;
      return Object.assign({}, p, {
        skillId: idx >= 0 ? p.skillId : null,
        skillIdx: idx,
        skillName: idx >= 0 ? skills[idx].name : '',
      });
    }),
  }));
}

/** 切回普通赛时清空所有已选技能（三个字段一起清） */
function clearSkills(camps) {
  return camps.map((c) => Object.assign({}, c, {
    players: c.players.map((p) => Object.assign({}, p, {
      skillId: null, skillIdx: -1, skillName: '',
    })),
  }));
}

// 两页共用同一句提示，避免计分页 / 编辑页出现两种说法
const WARN_SKILL_DUP = '技能不能重复选取';

// 生成某行可用的玩家列表：排除其他所有位置已选中的玩家，但保留本行当前已选的玩家
function buildAvailableForRow(players, camps, ci, pi) {
  const excluded = new Set();
  camps.forEach((c, cIdx) => {
    c.players.forEach((p, pIdx) => {
      if (cIdx === ci && pIdx === pi) return;
      if (p.playerId != null) excluded.add(p.playerId);
    });
  });
  return (players || []).filter((p) => !excluded.has(p.id));
}

/** 某技能是否已被其他玩家行占用（选择时的守卫，防 picker 列表过期 / 草稿残留绕过过滤） */
function isSkillTaken(camps, skillId, ci, pi) {
  if (skillId == null) return false;
  return camps.some((c, cIdx) => c.players.some((p, pIdx) =>
    !(cIdx === ci && pIdx === pi) && p.skillId === skillId
  ));
}

/**
 * 重建每行的「可用技能」下拉与 picker 下标：同一局内技能先到先得，不重复。
 * · 其它行已占用的技能不出现在下拉里，本行已选的技能保留以便回显；
 * · 旧草稿 / 外部数据带来的重复选择按行顺序消重：后出现的那一行清空技能，交由用户重选；
 * · 技能字典为空时保留历史 skillId / skillName（同 withSkillIndex），只把下拉置空——
 *   否则打开一条历史技能赛会把技能字段误清掉。
 */
function rebuildAvailableSkills(skills, camps) {
  const list = skills || [];
  const seen = new Set();
  return (camps || []).map((c) => Object.assign({}, c, {
    players: c.players.map((p) => {
      if (!list.length) return Object.assign({}, p, { availableSkills: [] });
      const valid = p.skillId != null && list.some((s) => s.id === p.skillId);
      const duplicate = valid && seen.has(p.skillId);
      if (valid && !duplicate) seen.add(p.skillId);
      const skillId = valid && !duplicate ? p.skillId : null;
      // seen 已含本行技能，故本行已选项仍留在下拉里（picker 的 value 才不会越界）
      const availableSkills = list.filter((s) => !seen.has(s.id) || s.id === skillId);
      const skillIdx = skillId != null ? availableSkills.findIndex((s) => s.id === skillId) : -1;
      const skillName = skillId != null
        ? (list.find((s) => s.id === skillId) || {}).name || p.skillName || ''
        : '';
      return Object.assign({}, p, { skillId, skillIdx, skillName, availableSkills });
    }),
  }));
}

// 重建每个玩家行的「可用玩家」下拉（含新玩家），不改动其它字段
// 传了 skills 时顺带重建技能下拉；不传则保持旧行为（纯玩家列表）
function rebuildAvailable(players, camps, skills) {
  const withPlayers = camps.map((c, ci) => Object.assign({}, c, {
    players: c.players.map((p, pi) => {
      const available = buildAvailableForRow(players, camps, ci, pi);
      const availIdx = p.playerId != null ? available.findIndex((pl) => pl.id === p.playerId) : -1;
      return Object.assign({}, p, { available, availIdx });
    }),
  }));
  return skills === undefined ? withPlayers : rebuildAvailableSkills(skills, withPlayers);
}

/**
 * 按行号重算「不可删除」标记，规则与计分页同源（utils/score.js:playersPerCamp）：
 * 2 个阵营 → 每队前 3 行锁定；3/4 个阵营 → 每队前 2 行锁定。
 * WXML 用 p.locked 把 ✕ 渲染成占位（visibility:hidden），删到下限以下无从点起。
 * 纯函数：返回新对象，不原地修改，editSync 每次都会重跑。
 */
function applyPlayerLocks(camps) {
  const per = score.playersPerCamp(camps.length);
  return camps.map((c) => Object.assign({}, c, {
    players: c.players.map((p, i) => Object.assign({}, p, { locked: i < per })),
  }));
}

// 将分数对齐到最近的 5 的倍数（与服务端 score.toScore 一致）
function roundTo5(n) {
  n = Number(n);
  if (!Number.isFinite(n)) return 0;
  if (n < 0) n = 0;
  return Math.round(n / 5) * 5;
}

// 每个阵营的小计：只累加已出完玩家的有效分数
function calcCampSubtotals(camps) {
  return camps.map((c) => Object.assign({}, c, {
    subtotal: c.players.reduce((sum, p) => {
      if (!p.finished || p.playerId == null) return sum;
      return sum + roundTo5(p.score);
    }, 0),
  }));
}

// 录入约束（与计分页同口径），编辑时只作软提示，不阻断历史对局保存
const WARN_MVP = 'MVP 未设置';
const WARN_WIN = '获胜条件不满足';
function entryConstraintWarns(camps, deckCount) {
  const warns = [];
  const entries = camps.reduce((all, c) => all.concat(c.players), []);
  const mvpCount = entries.filter((p) => p.mvp).length;
  // 先判定、后按顺序 push：计分页的展示顺序是「获胜条件 → MVP」，这边保持一致，
  // 两页并排看时同一局的不合规项顺序不会互相打架
  const mvpBad = entries.length > 0 && mvpCount !== 1;

  const line = score.winLine(deckCount);
  const stats = camps.map((c) => {
    const list = c.players;
    return {
      banked: list.filter((p) => p.finished).reduce((s, p) => s + roundTo5(p.score), 0),
      hasPlayers: list.length > 0,
      allFinished: list.length > 0 && list.every((p) => p.finished),
    };
  });
  const hasAnyCamp = stats.some((s) => s.hasPlayers);
  const finishedCount = stats.filter((s) => s.allFinished).length;
  const badFinishCount = hasAnyCamp && finishedCount !== 1;
  const finishWinner = stats.find(
    (s) => s.allFinished && stats.some((o) => o !== s && o.hasPlayers && !o.allFinished)
  );
  const conflicted = finishWinner && stats.some((s) => s !== finishWinner && s.banked > line);
  if (badFinishCount || conflicted) warns.push(WARN_WIN);
  if (mvpBad) warns.push(WARN_MVP);
  return warns;
}

/**
 * 在 utils/score.js 的 computeMatch 之上补齐服务端 lib/score.js:114-118 的判定：
 * 某阵营全员出完，且存在对手阵营未全员出完时，该阵营判胜。
 * 分数先按 5 的倍数归一，保证预览与落库结果一致。
 */
function computePreview(camps, deckCount) {
  const campDefs = camps.map((c, i) => ({
    id: i,
    name: c.name || `阵营 ${i + 1}`,
    color: c.color || '',
  }));
  const entries = [];
  camps.forEach((c, i) => {
    c.players.forEach((p) => {
      if (p.playerId == null) return;
      entries.push({
        camp_id: i,
        score: roundTo5(p.score),
        finished: p.finished,
        is_mvp: p.mvp,
      });
    });
  });

  const base = score.computeMatch(campDefs, entries, deckCount);
  const rows = base.rows.map((r, i) => {
    const own = entries.filter((e) => String(e.camp_id) === String(i));
    return Object.assign({}, r, {
      allFinished: own.length > 0 && own.every((e) => Boolean(e.finished)),
    });
  });
  rows.forEach((r) => {
    if (r.allFinished && rows.some((o) => o !== r && !o.allFinished)) r.isWinner = true;
  });
  const winners = rows.filter((r) => r.isWinner);

  return Object.assign({}, base, {
    rows,
    winners,
    unresolved: winners.length !== 1,
    hasEntries: entries.length > 0,
  });
}

/**
 * 编辑态校验：硬错误（后端也会拒绝）+ 记录完整性约束（获胜条件 / MVP / 技能），
 * 两者只要存在就阻断保存。用户 2026-11-09 明确要求「不能保存」——拦下来只是不改动，
 * 不会破坏已有记录，所以阻断是安全的。
 *
 * 刻意不校验「牌副数 ≥4」「总人数 ≥6」：这两条是**对局创建时的结构性事实**，编辑态改不了
 * （牌副数是只读字段，人数要凑就得给历史对局塞人）。现网 8 局全是 2~3 副 / 4 人，一旦纳入
 * 校验，这 8 局会永久点不动「保存修改」，编辑入口等于失效。
 */
function validateForm(camps, deckCount, type, skills) {
  const deckTotal = score.deckTotal(deckCount);
  const hard = new Set();
  const constraintWarns = [];
  // 技能字典为空时给出可操作提示，否则用户只会看到「每位玩家必填」却无从选择
  if (type === 'skill' && Array.isArray(skills) && !skills.length) {
    constraintWarns.push('请先添加技能');
  }
  const allIds = [];
  const chosenSkillIds = [];
  let skillPlayerCount = 0;
  let recordedTotal = 0;

  camps.forEach((c, i) => {
    const chosen = c.players.filter((p) => p.playerId != null);
    if (chosen.length < 2) hard.add(`「${c.name || `阵营 ${i + 1}`}」至少 2 名玩家`);
    chosen.forEach((p) => {
      allIds.push(p.playerId);
      // 分数统一按 5 的倍数收敛后再参与上限校验：输入中途（如「12」）不再是错误，
      // 失焦会四舍五入对齐、保存也走 roundTo5，没必要为用户不需要处理的中间态报错
      const v = roundTo5(p.score);
      recordedTotal += v;
      if (v > deckTotal) hard.add(`单名玩家分数 ${v} 超过牌库总分 ${deckTotal}`);
      // 技能赛每位已选玩家都必须选技能（普通赛完全跳过）
      if (type === 'skill') {
        skillPlayerCount += 1;
        if (p.skillId == null) hard.add('技能赛需为每位玩家选择技能');
        else chosenSkillIds.push(p.skillId);
      }
    });
  });

  if (new Set(allIds).size !== allIds.length) hard.add('存在重复玩家，请检查各阵营');
  if (type === 'skill') {
    // 一人一技能 ⇒ 字典数量至少要覆盖已选玩家数，否则末位玩家永远无从选择
    const skillCount = (skills || []).length;
    if (skillCount > 0 && skillCount < skillPlayerCount) {
      hard.add(`技能数量不足（需 ${skillPlayerCount} 个，现有 ${skillCount} 个）`);
    }
    if (new Set(chosenSkillIds).size !== chosenSkillIds.length) hard.add(WARN_SKILL_DUP);
  }
  if (recordedTotal > deckTotal) hard.add(`录入总分 ${recordedTotal} 超过牌库总分 ${deckTotal}`);

  // 「牌副数 ≥4」「总人数 ≥6」不在此校验：编辑态改不了，纳入会让历史对局永久无法保存
  const normalized = camps.map((c) => ({
    name: c.name,
    players: c.players
      .filter((p) => p.playerId != null)
      .map((p) => ({ score: p.score, finished: !!p.finished, mvp: !!p.mvp })),
  }));
  constraintWarns.push(...entryConstraintWarns(normalized, deckCount));

  const hardErrors = Array.from(hard);
  // 与计分页（scoring.js:751-756）同构：硬错误在前、约束提示在后，合并成一行交给
  // .rule-warns 渲染；分成两段会出现「红字 + 灰字」两套风格，且每条带尾随分号很难看
  const ruleWarnText = hardErrors.concat(constraintWarns).join(' · ');
  return {
    hardErrors,
    constraintWarns,
    ruleWarnText,
    // 阻断条件：硬错误 或 任意一条记录完整性约束（用户要求：不合规就不给保存）
    canSubmit: hardErrors.length === 0 && constraintWarns.length === 0,
  };
}

/** 把 getMatch 的返回结构映射成编辑表单状态 */
function buildEditState(m, players, skills) {
  const skillList = skills || [];
  const playerMap = new Map((players || []).map((p) => [p.id, p]));
  let camps = (m.camps || []).map((c, ci) => {
    const preset = CAMP_PRESETS.find((x) => x.color === c.color)
      || CAMP_PRESETS[ci]
      || { key: '' };
    return {
      campId: c.id,
      name: c.name,
      color: c.color || '',
      colorKey: preset.key || '',
      players: (c.players || []).map((p) => {
        const player = playerMap.get(p.player_id);
        return {
          uid: uid(),
          playerId: player ? p.player_id : null,
          playerName: player ? player.name : '⚠ 玩家已失效，请重选',
          playerIdx: player ? p.player_id : -1,
          score: String(p.score),
          finished: !!p.finished,
          mvp: !!p.is_mvp,
          skillId: p.skill_id ?? null,
          skillName: p.skill_name || '',
          skillIdx: -1,
          available: [],
          availIdx: -1,
        };
      }),
      subtotal: 0,
    };
  });

  // 先按当前技能字典清理失效 skillId，再重建逐行的可用技能下拉：
  // 顺序不能反——withSkillIndex 写的是全量字典下标，rebuildAvailableSkills 写的才是行内下标
  camps = withSkillIndex(camps, skillList);
  camps = calcCampSubtotals(applyPlayerLocks(rebuildAvailable(players, camps, skillList)));
  const deckCount = Number(m.deck_count) || 1;
  const type = m.type === 'skill' ? 'skill' : 'normal';
  const edit = {
    id: m.id,
    seasonLabel: m.season_name || '—',
    playedAt: m.played_at,
    deckCount,
    deckTotal: m.deck_total,
    winLine: m.win_line,
    type,
    typeOptions: MATCH_TYPES,
    typeIndex: type === 'skill' ? 1 : 0,
    skills: skillList,
    camps,
    result: computePreview(camps, deckCount),
    submitting: false,
  };
  const v = validateForm(camps, deckCount, type, skillList);
  return Object.assign(edit, v);
}

/**
 * 生成 PUT /api/matches/:id 的 payload：
 * 只带「比分 + 对局类型 + 玩家技能」，日期 / 局次 / 牌副数 / 赛季 / 阵营结构保持不变。
 * 普通赛不带 skill_id（服务端也会强制置空），技能赛每位玩家必带。
 */
function buildPayload(edit) {
  return {
    type: edit.type,
    camps: edit.camps.map((c) => ({
      id: c.campId,
      players: c.players
        .filter((p) => p.playerId != null)
        .map((p) => {
          const row = {
            player_id: p.playerId,
            score: roundTo5(p.score),
            finished: p.finished ? 1 : 0,
            is_mvp: p.mvp ? 1 : 0,
          };
          if (edit.type === 'skill') row.skill_id = p.skillId;
          return row;
        }),
    })),
  };
}

module.exports = {
  CAMP_PRESETS,
  MATCH_TYPES,
  WARN_SKILL_DUP,
  uid,
  emptyPlayer,
  withSkillIndex,
  clearSkills,
  buildAvailableForRow,
  isSkillTaken,
  rebuildAvailable,
  rebuildAvailableSkills,
  applyPlayerLocks,
  calcCampSubtotals,
  roundTo5,
  entryConstraintWarns,
  computePreview,
  validateForm,
  buildEditState,
  buildPayload,
};
