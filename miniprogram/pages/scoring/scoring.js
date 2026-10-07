// 计分录入（MVP）：选赛季 + 牌副数 + 动态阵营/玩家，实时用 score.computeMatch 预览胜负
const { get, post, getBootstrap } = require('../../utils/request');
const score = require('../../utils/score');
const { pickCurrentSeason, withSeasonLabels } = require('../../utils/season');

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
function emptyPlayer() {
  return { uid: uid(), playerId: null, playerName: '选择玩家', playerIdx: -1, score: '', finished: true, mvp: false, available: [], availIdx: -1 };
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

// 生成「当日第 N 局」下拉选项：1..默认值（默认选中将要录入的新一局）
function buildSeqOptions(seqDefault) {
  const options = [];
  for (let i = 1; i <= seqDefault; i++) options.push({ value: i, label: `第${i}局` });
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

// 将分数约束为 5 的倍数（向下取整到最近 5 的整数倍，最小为 0）
function roundTo5(n) {
  n = Number(n);
  if (!Number.isFinite(n)) return 0;
  if (n < 0) n = 0;
  return Math.round(n / 5) * 5;
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
    camps: [emptyCamp(CAMP_PRESETS[0]), emptyCamp(CAMP_PRESETS[1])],
    result: null,
    submitting: false,
    warns: [],
    canSubmit: false,
    // 计分日期与「当日第 N 局」
    allMatches: [],
    playedAt: todayStr(),
    seqOptions: [{ value: 1, label: '第1局' }],
    seqIndex: 0,
  },

  onLoad() {
    // 冷启动（首次进入 / 小程序被回收后重进）才走完整初始化：拉数据、恢复草稿、还原滚动
    this.load();
  },

  onShow() {
    // 同会话内切回：tabBar 页面实例被保留，微信原生已维持滚动位置。
    // 这里只轻量刷新玩家列表（在「我的」里新建的玩家需即时出现在选择器），
    // 不再重建阵营结构、也不强制滚动——避免「先回顶、再跳回」的闪动。
    this.refreshOnShow();
  },

  onHide() {
    // 切走时记下滚动位置，冷启动重进时据此还原
    try { wx.setStorageSync('scoring_scroll', this._scrollTop || 0); } catch (e) {}
  },

  // 实时记录页面滚动位置，切到其它 tab 再切回时还原（避免回到顶部）
  onPageScroll(e) {
    this._scrollTop = e.scrollTop;
  },

  // 统一设置 camps，并自动计算每个阵营的小计
  setCamps(camps) {
    this.setData({ camps: calcCampSubtotals(camps) });
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
            available: [],
            availIdx: -1,
          })),
          subtotal: 0,
        }));
        this.setData({
          playedAt,
          seqOptions,
          seqIndex,
          deckIndex,
          camps: calcCampSubtotals(restored),
        }, () => {
          // 阵营重建完成后立即还原滚动位置（duration:0），与原生首帧尽量贴合，减少闪动
          if (restoreScroll > 0) wx.pageScrollTo({ scrollTop: restoreScroll, duration: 0 });
        });
      }

      // 为每个玩家行生成「可用玩家」下拉列表（排除已被占用的玩家）
      this._restoring = true;
      this.rebuildAvailable();
      // 首次进入即计算预览，使「本局预览」卡片常驻显示（而非空白）
      this.computePreview();
      this._restoring = false;
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
      const appearanceMap = buildAppearanceMap(d.matches || []);
      const players = (d.players || []).map((p) => Object.assign({}, p, { appearances: appearanceMap.get(p.id) || 0 }));
      players.sort((a, b) => b.appearances - a.appearances || a.name.localeCompare(b.name, 'zh-CN'));
      const allMatches = d.matches || [];
      const seqDefault = defaultSeqFor(allMatches, this.data.playedAt);
      const seqOptions = buildSeqOptions(seqDefault);
      let seqIndex = this.data.seqIndex;
      if (seqIndex > seqOptions.length - 1) seqIndex = seqOptions.length - 1;
      this.setData({ players, allMatches, seqOptions, seqIndex });
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
  },
  onSeqChange(e) {
    this.setData({ seqIndex: Number(e.detail.value) });
  },

  onDeckChange(e) {
    this.setData({ deckIndex: Number(e.detail.value) });
    this.computePreview();
    this.validate();
  },
  onCampName(e) {
    const ci = e.currentTarget.dataset.camp;
    const camps = this.data.camps.slice();
    camps[ci].name = e.detail.value;
    this.setCamps(camps);
  },

  addCamp() {
    if (this.data.camps.length >= 4) {
      wx.showToast({ title: '最多4个阵营', icon: 'none' });
      return;
    }
    const preset = CAMP_PRESETS[this.data.camps.length] || CAMP_PRESETS[CAMP_PRESETS.length - 1];
    const camps = this.data.camps.concat(emptyCamp(preset));
    this.setCamps(camps);
    this.rebuildAvailable();
  },
  removeCamp(e) {
    const camps = this.data.camps;
    if (camps.length <= 2) {
      wx.showToast({ title: '至少保留2个阵营', icon: 'none' });
      return;
    }
    const i = e.currentTarget.dataset.index;
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
    const next = camps.slice();
    next.splice(i, 1);
    this.setCamps(next);
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
      available: [],
      availIdx: -1,
    };
    this.setCamps(camps);
    this.rebuildAvailable();
    this.computePreview();
  },

  // 重新计算每个玩家行的「可用玩家」下拉列表：已占用的玩家不出现在其他行的下拉里
  rebuildAvailable() {
    const { players, camps } = this.data;
    const nextCamps = camps.map((c, ci) => {
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
    this.setCamps(nextCamps);
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
    camps[camp].players[pi].mvp = !camps[camp].players[pi].mvp;
    this.setCamps(camps);
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

  // 实时录入校验：牌副数≥4、玩家≥6、每阵营≥1人、无重复玩家
  validate() {
    const { deckOptions, deckIndex, camps } = this.data;
    const deckCount = deckOptions[deckIndex];
    const totalPlayers = camps.reduce((n, c) => n + c.players.filter((p) => p.playerId).length, 0);
    const warns = [];
    if (deckCount < 4) warns.push(`牌副数至少 4 副（当前 ${deckCount} 副）`);
    if (totalPlayers < 6) warns.push(`至少 6 名玩家才能录入（当前 ${totalPlayers} 名）`);
    if (camps.some((c) => c.players.filter((p) => p.playerId).length < 2)) warns.push('每个阵营至少 2 名玩家');
    const allIds = [];
    camps.forEach((c) => c.players.forEach((p) => { if (p.playerId) allIds.push(p.playerId); }));
    if (new Set(allIds).size !== allIds.length) warns.push('存在重复玩家，请检查各阵营');
    // 得分必须是 5 的倍数（失焦时已对齐，这里做兜底校验）
    if (camps.some((c) => c.players.some((p) => p.playerId && roundTo5(p.score) !== Number(p.score)))) {
      warns.push('得分必须是 5 的倍数');
    }
    this.setData({ warns, canSubmit: warns.length === 0 });
  },

  async submit() {
    const { seasonId, camps, deckOptions, deckIndex, playedAt, seqOptions, seqIndex } = this.data;
    if (!seasonId) {
      wx.showToast({ title: '请先选择赛季', icon: 'none' });
      return;
    }
    const deckCount = deckOptions[deckIndex];
    const totalPlayers = camps.reduce((n, c) => n + c.players.filter((p) => p.playerId).length, 0);
    if (deckCount < 4) {
      wx.showToast({ title: '牌副数至少 4 副', icon: 'none' });
      return;
    }
    if (totalPlayers < 6) {
      wx.showToast({ title: '至少 6 名玩家才能录入', icon: 'none' });
      return;
    }
    const payloadCamps = camps.map((c) => ({
      name: c.name,
      color: c.color,
        players: c.players
          .filter((p) => p.playerId)
          .map((p) => ({ player_id: p.playerId, score: roundTo5(p.score), finished: p.finished ? 1 : 0, is_mvp: p.mvp ? 1 : 0 })),
    }));
    if (payloadCamps.some((c) => c.players.length < 2)) {
      wx.showToast({ title: '每个阵营至少2名玩家', icon: 'none' });
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
    this.setData({ submitting: true });
    try {
      await post('/api/matches', {
        season_id: seasonId,
        deck_count: deckOptions[deckIndex],
        played_at: playedAt,
        seq: seqOptions[seqIndex].value,
        camps: payloadCamps,
      });
      wx.showToast({ title: '录入成功', icon: 'success' });
      this.setCamps([emptyCamp(CAMP_PRESETS[0]), emptyCamp(CAMP_PRESETS[1])]);
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
});
