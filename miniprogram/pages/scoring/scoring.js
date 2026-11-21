// 计分录入（MVP）：选赛季 + 牌副数 + 动态阵营/玩家，实时用 score.computeMatch 预览胜负
const { get, post, getBootstrap } = require('../../utils/request');
const score = require('../../utils/score');
const { pickCurrentSeason, withSeasonLabels } = require('../../utils/season');
const { buildShare, enableShareMenu } = require('../../utils/share');
const { confirmOn } = require('../../utils/confirm');
const matchForm = require('../../utils/match-form');

// 与网页端计分台保持一致：红 / 蓝 / 绿 / 紫
const CAMP_PRESETS = [
  { name: '红队', color: '#d64545', key: 'red' },
  { name: '蓝队', color: '#3b7dd8', key: 'blue' },
  { name: '绿队', color: '#2f9e63', key: 'green' },
  { name: '紫队', color: '#b165d4', key: 'purple' },
];

// 生成稳定唯一 id，用作 wx:for 的 key（避免 tab 页切回时列表不重渲染）
let _uidSeq = 0;
function uid() { return 'u' + (++_uidSeq); }

function emptyCamp(preset) {
  preset = preset || { name: '阵营', color: '', key: '' };
  return { uid: uid(), name: preset.name, color: preset.color, colorKey: preset.key, players: [], subtotal: 0 };
}
// 默认录入布局：2 个阵营时每阵营 3 人，3/4 个阵营时每阵营 2 人。
// 这个人数同时就是「每个阵营不可删除的最小玩家数」。
// 规则已抽到 utils/score.js：编辑页（pages/matches）的删除按钮锁定必须与这里同源，
// 两页各留一份会漂移成「录入删不掉、编辑能删掉」。
const playersPerCamp = score.playersPerCamp;

function emptyPlayer() {
  // 新加的玩家默认「未出完」：由记分员按实际结果逐个改为「已出完」
  // locked 只是初始值，真实锁定状态由 applyPlayerLocks 按行号统一计算
  return {
    uid: uid(), playerId: null, playerName: '选择玩家', playerIdx: -1,
    score: '', finished: false, mvp: false, locked: false,
    available: [], availIdx: -1,
    // 技能只对「技能赛」有意义：skillId 对应 skills.id，skillIdx/name 供 picker 回显
    skillId: null, skillIdx: -1, skillName: '', availableSkills: [],
  };
}

/** 按当前技能字典重算每行的 picker 下标与显示名；技能被删除时自动清空该行选择 */
function withSkillIndex(camps, skills) {
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

/** 切回普通赛时清空所有已选技能（三个字段一起清，避免草稿残留） */
function clearSkills(camps) {
  return camps.map((c) => Object.assign({}, c, {
    players: c.players.map((p) => Object.assign({}, p, { skillId: null, skillIdx: -1, skillName: '' })),
  }));
}

/** 每个阵营的前 N 行（N = 当前阵营数对应的最小玩家数）不可删，多余行可删。
 *  阵营数变化、增删玩家行、恢复草稿后都会重算，避免「全局前 6 行」这类过期标记：
 *  · 2 阵营：每队前 3 行锁定；
 *  · 3/4 阵营：每队前 2 行锁定（红蓝队原有的第 3 行自动变为可删）。 */
function applyPlayerLocks(camps) {
  const per = playersPerCamp(camps.length);
  // 原地更新标记，不新建玩家对象：避免每次录分都让 wx:for 里的 input 重建、丢光标
  camps.forEach((c) => c.players.forEach((p, i) => { p.locked = i < per; }));
  return camps;
}

/** 生成默认阵营（含默认空玩家行），默认行全部属于最小玩家数，均不可删 */
function defaultCamps(campCount) {
  const per = playersPerCamp(campCount);
  return applyPlayerLocks(CAMP_PRESETS.slice(0, campCount).map((preset) => {
    const camp = emptyCamp(preset);
    camp.players = Array.from({ length: per }, () => emptyPlayer());
    return camp;
  }));
}

/** 所有行都还没选玩家 / 录分 → 可以安全地按阵营数重排默认行，不会丢数据 */
function isPristine(camps) {
  return camps.every((c) => c.players.every((p) =>
    p.playerId == null && p.score === '' && !p.finished && !p.mvp && p.skillId == null
  ));
}

/** 默认态下按当前阵营数重排；保留用户改过的阵营名与颜色。
 *  已开始录入则原样返回（不丢已录数据），各行的锁定状态由 setCamps 按行号重算。 */
function withDefaultLayout(camps) {
  if (!isPristine(camps)) return camps;
  const rebuilt = defaultCamps(camps.length);
  rebuilt.forEach((c, i) => {
    if (!camps[i]) return;
    c.name = camps[i].name;
    c.color = camps[i].color;
    c.colorKey = camps[i].colorKey;
  });
  return rebuilt;
}

// 生成某行可用的玩家列表：排除其他所有位置已选中的玩家，但保留本行当前已选的玩家（若有）
function buildAvailableForRow(players, camps, ci, pi) {
  const excluded = new Set();
  camps.forEach((c, cIdx) => {
    c.players.forEach((p, pIdx) => {
      if (cIdx === ci && pIdx === pi) return;
      if (p.playerId != null) excluded.add(p.playerId);
    });
  });
  return players.filter((p) => !excluded.has(p.id));
}

// 今天日期 YYYY-MM-DD
function todayStr() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// 按日期计算「当日第 N 局」默认值：当天已有对局的最大 seq + 1
function defaultSeqFor(matches, date) {
  let max = 0;
  (matches || []).forEach((m) => {
    if ((m.played_at || '').slice(0, 10) === date && (m.seq || 0) > max) max = m.seq;
  });
  return max + 1;
}

// 生成「第几局」下拉选项：1..默认值，选项只显示纯数字 1/2/3…
// 标签「第几局」已说明语义，框里再写「第N局」是重复，也不利于快速扫数字。
// label 必须是字符串：picker 用 range-key="label" 取值。
function buildSeqOptions(seqDefault) {
  const options = [];
  for (let i = 1; i <= seqDefault; i++) options.push({ value: i, label: String(i) });
  return options;
}

// 为每个阵营计算「小计」：只累加已出完玩家的有效分数
function calcCampSubtotals(camps) {
  return camps.map((c) => {
    const subtotal = c.players.reduce((sum, p) => {
      if (!p.finished) return sum;
      return sum + (Number(p.score) || 0);
    }, 0);
    return Object.assign({}, c, { subtotal });
  });
}

// 根据全部对局统计每个玩家的出场次数
function buildAppearanceMap(matches) {
  const map = new Map();
  for (const m of matches || []) {
    for (const c of m.camps || []) {
      for (const p of c.players || []) {
        const id = p.player_id;
        map.set(id, (map.get(id) || 0) + 1);
      }
    }
  }
  return map;
}

// 将分数约束为 5 的倍数（四舍五入到最近的 5 的整数倍，负数按 0 处理）
// 与服务端 lib/score.js 的 toScore 同口径，保证预览与落库一致
function roundTo5(n) {
  n = Number(n);
  if (!Number.isFinite(n)) return 0;
  if (n < 0) n = 0;
  return Math.round(n / 5) * 5;
}

// 不满足提交条件时只显示两条固定提示，不细分原因
const WARN_MVP = 'MVP 未设置';
const WARN_WIN = '获胜条件不满足';

/**
 * 录入约束（与 Web 计分台同口径），最多返回上面两条提示：
 *   ① 每局恰好 1 名 MVP → 「MVP 未设置」；
 *   ② 获胜方必须恰好 1 个 → 否则「获胜条件不满足」。
 * 两个**独立**的获胜条件（与 score.computeMatch 同口径），命中任一即为获胜方：
 *   ① 全队出完：本阵营全员出完牌，且存在对手阵营未全员出完；
 *   ② 有效分过半：本阵营有效分严格超过获胜线。
 * 有效分 = 已出完牌玩家的分数之和；若全场「都」没出完，有效分为 0，谈不上过半。
 * 不合法：两方都全员出完、两方有效分都过半、一方出完 + 另一方过半、或无人达成条件。
 * 同一阵营既全员出完又过半只算一个获胜方，允许保存。
 * @param {Array<{players:Array<{score:any, finished:boolean, mvp:boolean}>}>} camps 只传已选玩家
 */
function entryConstraintWarns(camps, deckCount) {
  const warns = [];
  const entries = camps.reduce((all, c) => all.concat(c.players), []);
  const mvpCount = entries.filter((p) => p.mvp).length;
  // 「获胜条件不满足」在前、「MVP 未设置」在后（两项同时出现时合并成一行显示）
  const mvpBad = entries.length > 0 && mvpCount !== 1;

  const line = score.winLine(deckCount);
  const stats = camps.map((c) => {
    const list = c.players;
    return {
      hasPlayers: list.length > 0,
      allFinished: list.length > 0 && list.every((p) => p.finished),
      // 有效分 = 已出完牌玩家的分数之和；全员都没出完时为 0
      effectiveScore: list.filter((p) => p.finished).reduce((s, p) => s + roundTo5(p.score), 0),
    };
  });

  const live = stats.filter((s) => s.hasPlayers);
  if (live.length > 0) {
    const anyUnfinished = live.some((s) => !s.allFinished);
    const finishedCamps = live.filter((s) => s.allFinished).length;
    // 两个独立条件，命中任一即为获胜方
    const winners = live.filter(
      (s) => (s.allFinished && anyUnfinished) || s.effectiveScore > line
    ).length;
    // 恰好 1 个获胜方（0 个 = 本局没打完，≥2 个 = 两队同时达成），且不能两方都全员出完
    if (winners !== 1 || finishedCamps > 1) warns.push(WARN_WIN);
  } // 空白录入（还没放玩家）不误报
  if (mvpBad) warns.push(WARN_MVP); // 放在获胜条件之后
  return warns;
}

// 本地草稿：切到其它 tab 再切回时保留录入进度（也兼容小程序被回收后重进）
const DRAFT_KEY = 'scoring_draft';
function saveDraft(data) {
  try {
    wx.setStorageSync(DRAFT_KEY, {
      seasonId: data.seasonId,
      playedAt: data.playedAt,
      seqIndex: data.seqIndex,
      deckIndex: data.deckIndex,
      matchType: data.matchType,
      typeIndex: data.typeIndex,
      camps: (data.camps || []).map((c) => ({
        name: c.name,
        color: c.color,
        colorKey: c.colorKey,
        players: (c.players || []).map((p) => ({
          playerId: p.playerId,
          playerName: p.playerName,
          playerIdx: p.playerIdx,
          score: p.score,
          finished: p.finished,
          mvp: p.mvp,
          skillId: p.skillId,
          skillName: p.skillName,
          // locked 是派生态（按阵营数与行号算），不存草稿
        })),
      })),
    });
  } catch (e) {}
}
function loadDraft() {
  try { return wx.getStorageSync(DRAFT_KEY) || null; } catch (e) { return null; }
}
function clearDraft() {
  try { wx.removeStorageSync(DRAFT_KEY); } catch (e) {}
}

Page({
  data: {
    seasons: [],
    seasonIndex: 0,
    seasonId: null,
    players: [],
    deckOptions: [4, 5, 6, 7, 8, 9, 10],
    deckIndex: 0,
    camps: defaultCamps(2),
    result: null,
    submitting: false,
    warns: [],
    ruleWarns: [], // 录入约束的原始提示数组（校验与提交兜底用）
    ruleWarnText: '', // 不能保存的原因合并成一行，展示在表单上方（人数等基础校验 + 两条录入约束）
    canSubmit: false,
    // 计分日期与「当日第 N 局」
    allMatches: [],
    playedAt: todayStr(),
    seqOptions: [{ value: 1, label: '1' }],
    seqIndex: 0,
    // 对局类型：normal 普通赛（默认）/ skill 技能赛，只有技能赛才显示并录入技能
    typeOptions: [{ value: 'normal', label: '普通赛' }, { value: 'skill', label: '技能赛' }],
    typeIndex: 0,
    matchType: 'normal',
    skills: [],
  },

  onLoad() {
    // 冷启动（首次进入 / 小程序被回收后重进）才走完整初始化：拉数据、恢复草稿、还原滚动
    this.load();
  },

  onShow() {
    enableShareMenu();
    // 同会话内切回：tabBar 页面实例被保留，微信原生已维持滚动位置。
    // 这里只轻量刷新玩家列表（在「我的」里新建的玩家需即时出现在选择器），
    // 不再重建阵营结构、也不强制滚动——避免「先回顶、再跳回」的闪动。
    this.refreshOnShow();
  },

  onHide() {
    // 切走时记下滚动位置，冷启动重进时据此还原
    try { wx.setStorageSync('scoring_scroll', this._scrollTop || 0); } catch (e) {}
    // 兜底：页面被切走 / 被系统回收前，把当前所有选单与录入状态写入草稿
    saveDraft(this.data);
  },

  // 实时记录页面滚动位置，切到其它 tab 再切回时还原（避免回到顶部）
  onPageScroll(e) {
    this._scrollTop = e.scrollTop;
  },

  // 统一设置 camps，并自动计算每个阵营的小计
  setCamps(camps) {
    // 锁定行数随阵营数变化（2 阵营每队 3 行 / 3、4 阵营每队 2 行），每次更新都重算
    this.setData({ camps: calcCampSubtotals(applyPlayerLocks(camps)) });
    this.validate();
    if (!this._restoring) saveDraft(this.data);
  },

  async load() {
    try {
      // 冷启动（或小程序被回收后重进）才走到这里：读取上次切走时的滚动位置，
      // 待草稿恢复、阵营重建完成后再一次性还原，避免可见的回顶跳动
      const restoreScroll = (() => { try { return wx.getStorageSync('scoring_scroll') || 0; } catch (e) { return 0; } })();
      const d = await getBootstrap(true);
      const seasons = withSeasonLabels(d.seasons || []);
      const allMatches = d.matches || [];
      const skills = d.skills || [];
      // 玩家下拉按出场次数降序排列，便于录入时快速找到常玩的人
      const appearanceMap = buildAppearanceMap(allMatches);
      const players = (d.players || []).map((p) => Object.assign({}, p, { appearances: appearanceMap.get(p.id) || 0 }));
      players.sort((a, b) => b.appearances - a.appearances || a.name.localeCompare(b.name, 'zh-CN'));
      // 计分页赛季固定为「当前赛季」，不允许玩家切换
      const cur = pickCurrentSeason(seasons);
      const seasonIndex = cur.index;
      const seasonId = cur.id;
      // 默认日期为今天，并据已有对局生成「当日第 N 局」下拉选项（默认选中将要录入的新一局）
      let playedAt = todayStr();
      let seqDefault = defaultSeqFor(allMatches, playedAt);
      let seqOptions = buildSeqOptions(seqDefault);
      let seqIndex = seqDefault - 1;
      let deckIndex = this.data.deckIndex;
      this.setData({
        seasons,
        players,
        skills,
        seasonIndex,
        seasonId,
        allMatches,
        playedAt,
        seqOptions,
        seqIndex,
      });

      // 恢复本地草稿：切到其它 tab 再切回、或小程序被回收后重进，都保留录入进度
      const draft = loadDraft();
      if (draft && draft.seasonId === seasonId && Array.isArray(draft.camps) && draft.camps.length) {
        if (draft.playedAt) {
          playedAt = draft.playedAt;
          seqDefault = defaultSeqFor(allMatches, playedAt);
          seqOptions = buildSeqOptions(seqDefault);
          seqIndex = typeof draft.seqIndex === 'number' ? Math.min(draft.seqIndex, seqOptions.length - 1) : seqDefault - 1;
        }
        if (typeof draft.deckIndex === 'number' && draft.deckIndex >= 0) deckIndex = draft.deckIndex;
        const restored = draft.camps.map((c) => ({
          uid: uid(),
          name: c.name,
          color: c.color,
          colorKey: c.colorKey || '',
          players: (c.players || []).map((p) => ({
            uid: uid(),
            playerId: p.playerId,
            playerName: p.playerName,
            playerIdx: p.playerIdx,
            score: p.score,
            finished: p.finished,
            mvp: p.mvp,
            skillId: p.skillId ?? null,
            skillName: p.skillName || '',
            skillIdx: -1,
            availableSkills: [],
            // locked 不读草稿里的旧值，统一按当前阵营数 + 行号重算
            locked: false,
            available: [],
            availIdx: -1,
          })),
          subtotal: 0,
        }));
        // 旧草稿若尚未录入，按当前阵营数补齐到新的默认布局（保证每阵营达到最小玩家数）
        this.setData({
          playedAt,
          seqOptions,
          seqIndex,
          deckIndex,
          matchType: draft.matchType === 'skill' ? 'skill' : 'normal',
          typeIndex: draft.matchType === 'skill' ? 1 : 0,
          camps: calcCampSubtotals(applyPlayerLocks(withDefaultLayout(restored))),
        }, () => {
          // 阵营重建完成后立即还原滚动位置（duration:0），与原生首帧尽量贴合，减少闪动
          if (restoreScroll > 0) wx.pageScrollTo({ scrollTop: restoreScroll, duration: 0 });
        });
      }

      // 旧草稿可能引用已删除的技能：按当前字典重算 picker 下标，失效值清空
      this.setData({ camps: withSkillIndex(this.data.camps, skills) });

      // 为每个玩家行生成「可用玩家」下拉列表（排除已被占用的玩家）
      this._restoring = true;
      this.rebuildAvailable();
      // 首次进入即计算预览，使「本局预览」卡片常驻显示（而非空白）
      this.computePreview();
      this._restoring = false;
      // 记录本次冷启动所用数据的签名，避免紧接着的第一次 onShow 又无谓重建一遍选单
      this._bootstrapSig = JSON.stringify({
        players: d.players || [],
        matches: d.matches || [],
        skills: d.skills || [],
        playedAt: this.data.playedAt,
      });
      this._initialized = true;
    } catch (e) {
      wx.showToast({ title: e.message, icon: 'none' });
    }
  },

  // 切回本 tab 时的轻量刷新：只更新玩家列表与「可用玩家」下拉（让「我的」里新建的玩家即时出现），
  // 不重建阵营结构、不强制滚动——从而保留微信原生维持的滚动位置，消除切回时的闪动
  async refreshOnShow() {
    try {
      const d = await getBootstrap();
      // bootstrap 数据没变就完全不动页面：否则每次切回（8 秒缓存过期后）都会重排玩家下拉、
      // 重建 seqOptions、重算 availIdx / 技能下标并覆写草稿，观感上就是「选单自己重置了」。
      // 签名包含 playedAt，因为「第几局」选项依赖它。
      const sig = JSON.stringify({
        players: d.players || [],
        matches: d.matches || [],
        skills: d.skills || [],
        playedAt: this.data.playedAt,
      });
      if (sig === this._bootstrapSig) return;
      this._bootstrapSig = sig;
      const appearanceMap = buildAppearanceMap(d.matches || []);
      const players = (d.players || []).map((p) => Object.assign({}, p, { appearances: appearanceMap.get(p.id) || 0 }));
      players.sort((a, b) => b.appearances - a.appearances || a.name.localeCompare(b.name, 'zh-CN'));
      const allMatches = d.matches || [];
      const skills = d.skills || [];
      const seqDefault = defaultSeqFor(allMatches, this.data.playedAt);
      const seqOptions = buildSeqOptions(seqDefault);
      let seqIndex = this.data.seqIndex;
      if (seqIndex > seqOptions.length - 1) seqIndex = seqOptions.length - 1;
      this.setData({ players, allMatches, seqOptions, seqIndex, skills });
      // 设置页新建 / 改名 / 删除技能后，切回计分页同步下拉并重算已选下标
      this.setData({ camps: withSkillIndex(this.data.camps, skills) });
      // 重建每个玩家行的「可用玩家」下拉（含新玩家），不触碰阵营结构，滚动位置不变
      this.rebuildAvailable();
    } catch (e) {}
  },

  onDateChange(e) {
    const playedAt = e.detail.value;
    const seqDefault = defaultSeqFor(this.data.allMatches, playedAt);
    const seqOptions = buildSeqOptions(seqDefault);
    const seqIndex = seqDefault - 1;
    this.setData({ playedAt, seqOptions, seqIndex });
    // 选单改动不走 setCamps，必须立刻写草稿，否则页面被重建后日期/局数会跳回默认
    saveDraft(this.data);
  },
  // 切换对局类型：切回普通赛会立即清空已选技能，有值时先二次确认
  async onTypeChange(e) {
    const typeIndex = Number(e.detail.value);
    const next = (this.data.typeOptions[typeIndex] || {}).value;
    if (!next || next === this.data.matchType) return;
    if (next === 'normal') {
      const hasSkill = this.data.camps.some((c) => c.players.some((p) => p.skillId != null));
      if (hasSkill) {
        const ok = await confirmOn(this, {
          title: '切换为普通赛',
          content: '普通赛不录入技能，已选的技能会被清空。',
          details: [{ label: '对局类型', value: '技能赛 → 普通赛' }],
          warning: '所有已为玩家选择的技能将全部清除，且不可恢复。',
          confirmText: '清空并切换',
          danger: true,
        });
        if (!ok) return;
      }
      this.setData({ matchType: next, typeIndex });
      this.setCamps(clearSkills(this.data.camps));
      return;
    }
    this.setData({ matchType: next, typeIndex });
    // 切换后立即刷新校验：技能赛有「每位玩家必填」校验；
    // 同时重建技能下拉（普通赛期间清空了选择，原本被占用的技能重新可用）
    this.rebuildAvailable();
  },

  onSkillPick(e) {
    const ci = Number(e.currentTarget.dataset.camp);
    const pi = Number(e.currentTarget.dataset.pi);
    const idx = Number(e.detail.value);
    const row = this.data.camps[ci].players[pi];
    // picker 只列未被占用的技能；这里按行内列表取值，过期列表 / 草稿残留再守一道
    const s = (row.availableSkills || [])[idx];
    if (!s) return;
    if (matchForm.isSkillTaken(this.data.camps, s.id, ci, pi)) {
      wx.showToast({ title: matchForm.WARN_SKILL_DUP, icon: 'none' });
      return;
    }
    const camps = this.data.camps.slice();
    camps[ci].players[pi] = Object.assign({}, camps[ci].players[pi], {
      skillId: s.id,
      skillIdx: idx,
      skillName: s.name,
    });
    // 一次 setData 完成「写入选择 + 重建其它行的可用技能」，避免重复选择残留
    this.setCamps(matchForm.rebuildAvailableSkills(this.data.skills, camps));
  },

  // 技能字典为空时的入口：跳到独立的技能维护页，回来自动按 onShow 刷新字典
  goSkills() {
    wx.navigateTo({
      url: '/pages/skills/skills',
      fail: (err) => {
        console.error('navigateTo skills failed', err);
        wx.showToast({ title: err.errMsg || '打开失败', icon: 'none' });
      },
    });
  },

  onSeqChange(e) {
    this.setData({ seqIndex: Number(e.detail.value) });
    saveDraft(this.data);
  },

  onDeckChange(e) {
    this.setData({ deckIndex: Number(e.detail.value) });
    this.computePreview();
    this.validate();
    saveDraft(this.data);
  },
  onCampName(e) {
    const ci = e.currentTarget.dataset.camp;
    const camps = this.data.camps.slice();
    camps[ci].name = e.detail.value;
    this.setCamps(camps);
  },

  addCamp() {
    const current = this.data.camps;
    if (current.length >= 4) {
      wx.showToast({ title: '最多4个阵营', icon: 'none' });
      return;
    }
    const nextCount = current.length + 1;
    const preset = CAMP_PRESETS[current.length] || CAMP_PRESETS[CAMP_PRESETS.length - 1];
    const camps = current.concat(emptyCamp(preset));
    if (isPristine(camps)) {
      // 还没开始录入：按阵营数重排默认行（2 阵营各 3 人 → 3/4 阵营各 2 人）
      this.setCamps(withDefaultLayout(camps));
    } else {
      // 已开始录入：不动已有行（避免丢已录数据），只给新阵营补默认行数。
      // 锁定由 setCamps 重算：3/4 阵营下每队前 2 行不可删，红蓝队第 3 行变为可删
      camps[camps.length - 1].players = Array.from(
        { length: playersPerCamp(nextCount) }, () => emptyPlayer()
      );
      this.setCamps(camps);
    }
    this.rebuildAvailable();
  },
  async removeCamp(e) {
    const camps = this.data.camps;
    if (camps.length <= 2) {
      wx.showToast({ title: '至少保留2个阵营', icon: 'none' });
      return;
    }
    const i = Number(e.currentTarget.dataset.index);
    // 红队(0) / 蓝队(1) 固定不可删除
    if (i <= 1) {
      wx.showToast({ title: '红队/蓝队不可删除', icon: 'none' });
      return;
    }
    // 只能按 第4 → 第3 依次删除：只允许删最后一个阵营
    if (i !== camps.length - 1) {
      wx.showToast({ title: '请先删除最后一个阵营', icon: 'none' });
      return;
    }
    const camp = camps[i];
    const filled = (camp.players || []).filter((p) => p.playerId != null || p.score !== '').length;
    // 与 Web 端计分台一致：移除阵营前二次确认，避免误触丢掉已录分数
    const ok = await confirmOn(this, {
      title: '移除阵营',
      content: `确认移除阵营「${camp.name}」？`,
      details: [{ label: '已录入', value: `${filled} 人 · 小计 ${camp.subtotal || 0} 分` }],
      warning: '该阵营已录入的分数与玩家会从本局草稿中清除，需重新录入。',
      confirmText: '移除阵营',
      danger: true,
    });
    if (!ok) return;
    const next = camps.slice();
    next.splice(i, 1);
    // 删掉阵营后，若剩下的行还是空白，按新阵营数重排默认行，保证仍不少于 6 行
    this.setCamps(withDefaultLayout(next));
    this.rebuildAvailable();
    this.computePreview();
  },

  addPlayer(e) {
    const ci = e.currentTarget.dataset.camp;
    const camps = this.data.camps.slice();
    if (camps[ci].players.length >= 5) {
      wx.showToast({ title: '每个阵营最多5人', icon: 'none' });
      return;
    }
    camps[ci].players = camps[ci].players.concat(emptyPlayer());
    this.setCamps(camps);
    this.rebuildAvailable();
  },
  removePlayer(e) {
    const { camp, pi } = e.currentTarget.dataset;
    const camps = this.data.camps.slice();
    // 每个阵营的最小玩家行锁定不可删（界面上删除按钮位置留空），这里只作兜底
    if (camps[camp].players[pi] && camps[camp].players[pi].locked) return;
    camps[camp].players.splice(pi, 1);
    this.setCamps(camps);
    this.rebuildAvailable();
    this.computePreview();
  },
  onPlayerPick(e) {
    const ci = Number(e.currentTarget.dataset.camp);
    const pi = Number(e.currentTarget.dataset.pi);
    const availIdx = Number(e.detail.value);
    const row = this.data.camps[ci].players[pi];
    const p = row.available[availIdx];
    if (!p) return;

    const camps = this.data.camps.slice();
    const cur = camps[ci].players[pi];
    camps[ci].players[pi] = {
      uid: cur.uid,
      playerId: p.id,
      playerName: p.name,
      playerIdx: p.id,
      score: cur.score,
      finished: cur.finished,
      mvp: cur.mvp,
      skillId: cur.skillId,
      skillIdx: cur.skillIdx,
      skillName: cur.skillName,
      locked: cur.locked, // 选玩家后先原样带上，setCamps 会按行号重算
      available: [],
      availIdx: -1,
    };
    this.setCamps(camps);
    this.rebuildAvailable();
    this.computePreview();
  },

  // 重新计算每个玩家行的「可用玩家」与「可用技能」下拉：
  // 已被其它行占用的玩家 / 技能都不出现在该行下拉里，本行已选项保留以便回显
  rebuildAvailable() {
    const { players, skills, camps } = this.data;
    const withPlayers = camps.map((c, ci) => {
      const playersArr = c.players.map((p, pi) => {
        const available = buildAvailableForRow(players, camps, ci, pi);
        let availIdx = -1;
        if (p.playerId != null) {
          availIdx = available.findIndex((pl) => pl.id === p.playerId);
        }
        return Object.assign({}, p, { available, availIdx });
      });
      return Object.assign({}, c, { players: playersArr });
    });
    this.setCamps(matchForm.rebuildAvailableSkills(skills, withPlayers));
  },
  onScore(e) {
    const { camp, pi } = e.currentTarget.dataset;
    const camps = this.data.camps.slice();
    camps[camp].players[pi].score = e.detail.value;
    this.setCamps(camps);
    this.computePreview();
  },
  // 输入框失焦时，把任意值对齐到最近的 5 的倍数
  onScoreBlur(e) {
    const camp = Number(e.currentTarget.dataset.camp);
    const pi = Number(e.currentTarget.dataset.pi);
    const raw = e.detail.value;
    const camps = this.data.camps.slice();
    camps[camp].players[pi].score = raw === '' ? '' : String(roundTo5(raw));
    this.setCamps(camps);
    this.computePreview();
  },
  onFinished(e) {
    const { camp, pi } = e.currentTarget.dataset;
    const camps = this.data.camps.slice();
    camps[camp].players[pi].finished = !camps[camp].players[pi].finished;
    this.setCamps(camps);
    this.computePreview();
  },
  onMvp(e) {
    const { camp, pi } = e.currentTarget.dataset;
    const camps = this.data.camps.slice();
    const wasOn = camps[camp].players[pi].mvp;
    // 每局恰好 1 名 MVP：全局单选，选另一人自动取消原选，再点一次可取消（校验会提示补选）
    camps.forEach((c) => c.players.forEach((p) => { p.mvp = false; }));
    camps[camp].players[pi].mvp = !wasOn;
    this.setCamps(camps); // 内部触发 validate：刷新 ruleWarns 与「保存对局」按钮状态
    this.computePreview();
  },

  computePreview() {
    const deckCount = this.data.deckOptions[this.data.deckIndex];
    const camps = this.data.camps;
    const campDefs = camps.map((c, i) => ({ id: i, name: c.name || '阵营' + (i + 1), color: c.color || '' }));
    const entries = [];
    camps.forEach((c, i) =>
      c.players.forEach((p) => {
        if (p.playerId) entries.push({ camp_id: i, score: roundTo5(p.score), finished: p.finished, is_mvp: p.mvp });
      })
    );
    // 始终产出 result（computeMatch 对空数据也安全），让「本局预览」卡片常驻显示
    this.setData({ result: score.computeMatch(campDefs, entries, deckCount) });
  },

  // 实时录入校验：玩家总数≥6、每阵营≥2人、技能赛技能齐全
  // 不校验的三项（都已在别处保证，不会产生需要用户处理的状态）：
  //   · 牌副数≥4 → 选择器最小 4；
  //   · 无重复玩家 → 每行下拉已排除其他行已选玩家；
  //   · 分数为 5 的倍数 → 失焦自动四舍五入、预览与落库都走 roundTo5，最终值必然对齐；
  //     输入中途（如「12」）会短暂命中，属于打字噪音，不该占用提示行
  // submit 里保留对应兜底，防止草稿等异常数据绕过 UI
  validate() {
    const { deckOptions, deckIndex, camps, matchType, skills } = this.data;
    const deckCount = deckOptions[deckIndex];
    const totalPlayers = camps.reduce((n, c) => n + c.players.filter((p) => p.playerId).length, 0);
    // 人数门槛由阵营数推导：2 队每队 3 个固定位（共 6 人）、3/4 队每队 2 个（共 6/8 人），
    // 与 applyPlayerLocks 的锁定行数同源，避免「4 队缺 2 人却不提示」
    const per = playersPerCamp(camps.length);
    const minTotal = camps.length * per;
    const warns = [];
    // 提示挤在一行显示：先说缺多少人才够开局（最直观），再说局部问题
    if (totalPlayers < minTotal) warns.push(`还需 ${minTotal - totalPlayers} 名玩家`);
    if (camps.some((c) => c.players.filter((p) => p.playerId).length < per)) warns.push('阵营人数不足');
    // 技能赛：一人一技能 ⇒ 字典数量够用 → 不重复 → 每人都有（普通赛完全跳过）
    if (matchType === 'skill') {
      const skillPlayers = camps.reduce((n, c) => n + c.players.filter((p) => p.playerId).length, 0);
      const chosenSkillIds = [];
      camps.forEach((c) => c.players.forEach((p) => {
        if (p.playerId && p.skillId != null) chosenSkillIds.push(p.skillId);
      }));
      if (!skills.length) warns.push('未添加技能');
      else if (skills.length < skillPlayers) warns.push(`技能数量不足（需 ${skillPlayers} 个，现有 ${skills.length} 个）`);
      else if (new Set(chosenSkillIds).size !== chosenSkillIds.length) warns.push(matchForm.WARN_SKILL_DUP);
      else if (chosenSkillIds.length < skillPlayers) warns.push('有人未选技能');
    }
    // 基础校验（人数/阵营/技能）只取第一条，与两条录入约束一起展示在表单上方，
    // 否则出现「约束都满足了、按钮还是灰的，界面却没有任何说明」的情况
    const formWarns = warns.slice();
    // 录入约束：MVP 唯一 + 恰好 1 个获胜方（两个独立条件不能两队同时达成）
    const normalized = camps.map((c) => ({
      name: c.name,
      players: c.players
        .filter((p) => p.playerId)
        .map((p) => ({ score: p.score, finished: !!p.finished, mvp: !!p.mvp })),
    }));
    const ruleWarns = entryConstraintWarns(normalized, deckCount);
    warns.push(...ruleWarns);
    // 合并成一行：基础原因（只取第一条，修完会依次露出下一条）→ 获胜条件 → MVP
    const warnParts = formWarns.length ? [formWarns[0], ...ruleWarns] : ruleWarns;
    this.setData({
      warns,
      ruleWarns,
      ruleWarnText: warnParts.join(' · '),
      canSubmit: warns.length === 0,
    });
  },

  async submit() {
    const { seasonId, camps, deckOptions, deckIndex, playedAt, seqOptions, seqIndex, matchType, skills } = this.data;
    if (!seasonId) {
      wx.showToast({ title: '请先选择赛季', icon: 'none' });
      return;
    }
    const deckCount = deckOptions[deckIndex];
    const totalPlayers = camps.reduce((n, c) => n + c.players.filter((p) => p.playerId).length, 0);
    // 与 validate 同源：人数门槛 = 阵营数 × 每队固定位（2 队 6 人 / 3 队 6 人 / 4 队 8 人）
    const per = playersPerCamp(camps.length);
    const minTotal = camps.length * per;
    if (deckCount < 4) {
      // 兜底：牌副数选择器最小就是 4，正常走不到这里
      wx.showToast({ title: '牌副数至少 4 副', icon: 'none' });
      return;
    }
    if (totalPlayers < minTotal) {
      wx.showToast({ title: `还需 ${minTotal - totalPlayers} 名玩家`, icon: 'none' });
      return;
    }
    const payloadCamps = camps.map((c) => ({
      name: c.name,
      color: c.color,
        players: c.players
          .filter((p) => p.playerId)
          .map((p) => {
            const row = { player_id: p.playerId, score: roundTo5(p.score), finished: p.finished ? 1 : 0, is_mvp: p.mvp ? 1 : 0 };
            // 普通赛不携带技能字段；服务端还会再兜一次底
            if (matchType === 'skill') row.skill_id = p.skillId;
            return row;
          }),
    }));
    if (payloadCamps.some((c) => c.players.length < per)) {
      wx.showToast({ title: `每个阵营至少${per}名玩家`, icon: 'none' });
      return;
    }
    // 兜底：禁止同一玩家出现在多个阵营
    const seen = new Set();
    for (const c of camps) {
      for (const p of c.players) {
        if (!p.playerId) continue;
        if (seen.has(p.playerId)) {
          wx.showToast({ title: '存在重复玩家，请检查各阵营', icon: 'none' });
          return;
        }
        seen.add(p.playerId);
      }
    }
    // 兜底：录入约束（实时校验已禁用「保存对局」，这里防绕过）
    const ruleWarns = entryConstraintWarns(
      payloadCamps.map((c) => ({
        name: c.name,
        players: c.players.map((p) => ({ score: p.score, finished: !!p.finished, mvp: !!p.is_mvp })),
      })),
      deckCount
    );
    if (ruleWarns.length) {
      wx.showToast({ title: ruleWarns[0], icon: 'none' });
      return;
    }
    // 兜底：技能赛技能齐全且一人一个，防止草稿等异常数据绕过实时校验
    if (matchType === 'skill') {
      if (!skills.length) {
        wx.showToast({ title: '请先添加技能（我的 → 设置 → 技能）', icon: 'none' });
        return;
      }
      const chosen = payloadCamps.reduce((all, c) => all.concat(c.players.map((p) => p.skill_id)), []);
      if (skills.length < totalPlayers) {
        wx.showToast({ title: `技能数量不足（需 ${totalPlayers} 个，现有 ${skills.length} 个）`, icon: 'none' });
        return;
      }
      if (new Set(chosen.filter((id) => id != null)).size !== chosen.filter((id) => id != null).length) {
        wx.showToast({ title: matchForm.WARN_SKILL_DUP, icon: 'none' });
        return;
      }
      if (chosen.some((id) => id == null)) {
        wx.showToast({ title: '技能赛需为每位玩家选择技能', icon: 'none' });
        return;
      }
    }
    this.setData({ submitting: true });
    try {
      await post('/api/matches', {
        season_id: seasonId,
        deck_count: deckOptions[deckIndex],
        played_at: playedAt,
        seq: seqOptions[seqIndex].value,
        type: matchType,
        camps: payloadCamps,
      });
      wx.showToast({ title: '录入成功', icon: 'success' });
      // 新一局回到默认普通赛，避免下一局意外带上技能赛设置
      this.setData({ matchType: 'normal', typeIndex: 0 });
      this.setCamps(defaultCamps(2));
      this.computePreview();
      clearDraft();
      // 重新拉取：刷新玩家列表，并按最新对局重算「当日第 N 局」
      this.load();
    } catch (e) {
      wx.showToast({ title: e.message, icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },

  // 转发：全站统一分享内容（固定宣传语 + 落地排行榜），见 utils/share.js
  onShareAppMessage() {
    return buildShare();
  },
});
