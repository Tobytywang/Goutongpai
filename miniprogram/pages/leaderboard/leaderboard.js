// 排行榜：从 matches 聚合每位玩家成绩（与 Web 端同一套统计口径；按赛季过滤，默认「全部赛季」）
// 关键口径：玩家成绩只算「总得分」(banked) = 仅在「把牌出完」的局里录得的分数之和。
const { get, getBootstrap } = require('../../utils/request');
const { withAllSeason } = require('../../utils/season');

// 排序口径：与页面中 8 项展示顺序一致（出场 → 胜局 → 胜率 → 出完率 → 总得分 → 场均得分 → 最高得分 → MVP 次数）
const SORT_KEYS = [
  { key: 'games', label: '出场', percent: false },
  { key: 'wins', label: '胜局', percent: false },
  { key: 'winRate', label: '胜率', percent: true },
  { key: 'finishRate', label: '出完率', percent: true },
  { key: 'banked', label: '总得分', percent: false },
  { key: 'avg', label: '场均得分', percent: false },
  { key: 'best', label: '最高得分', percent: false },
  { key: 'mvp', label: 'MVP 次数', percent: false },
];

// 默认排序项为「出场」，即列表项 8 项中的首个（索引 0）
const DEFAULT_SORT_INDEX = 0;

function pct(n) {
  if (!n || n < 0) return '0%';
  return Math.round(n * 100) + '%';
}

Page({
  data: {
    seasons: [],
    seasonIndex: 0,
    seasonId: null,
    allMatches: [],
    players: [],
    sortIndex: DEFAULT_SORT_INDEX, // 当前排序键在 SORT_KEYS 中的位置（默认出场，即列表首项）
    sortLabels: SORT_KEYS.map((k) => k.label),
    sortLabel: SORT_KEYS[DEFAULT_SORT_INDEX].label,
    activeKey: SORT_KEYS[DEFAULT_SORT_INDEX].key, // 当前排序项对应的统计字段（用于高亮列表项中的同名字段）
    scopeLabel: '全部赛季',
    podium: [], // 前 3 名
    rankings: [], // 第 4 名及以后
    loading: true,
  },

  onShow() {
    this.load();
  },

  onPullDownRefresh() {
    this.load(true).then(() => wx.stopPullDownRefresh());
  },

  async load(force) {
    this.setData({ loading: true });
    try {
      const d = await getBootstrap(force);
      this.setData({
        seasons: withAllSeason(d.seasons || []),
        seasonIndex: 0,
        seasonId: null,
        allMatches: d.matches || [],
        players: d.players || [],
        loading: false,
      });
      this.recompute();
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: e.message, icon: 'none' });
    }
  },

  // 与 Web 端 computePlayerStats 同口径：banked 只算「出完牌」的分数
  aggregate(matches, players, seasonId) {
    const nameMap = {};
    players.forEach((p) => (nameMap[p.id] = p.name));
    const scoped = seasonId == null ? matches : matches.filter((m) => m.season_id === seasonId);
    const map = {};
    const campColorMap = {};
    scoped.forEach((m) =>
      (m.camps || []).forEach((c) => {
        const campName = c.name || '未命名阵营';
        if (c.color) campColorMap[campName] = c.color;
        (c.players || []).forEach((s) => {
          const pid = s.player_id;
          if (!map[pid]) {
            map[pid] = {
              id: pid,
              name: nameMap[pid] || '#' + pid,
              games: 0,
              wins: 0,
              finishedGames: 0,
              banked: 0,
              mvp: 0,
              best: 0,
              campWin: {},
            };
          }
          const r = map[pid];
          r.games += 1;
          if (s.finished) {
            r.banked += Number(s.score) || 0;
            r.finishedGames += 1;
          }
          if (c.is_winner) r.wins += 1;
          if (s.is_mvp) r.mvp += 1;
          const sc = Number(s.score) || 0;
          if (sc > r.best) r.best = sc;
          r.campWin[campName] = (r.campWin[campName] || 0) + 1;
        });
      })
    );
    // 初始化全部玩家（含尚未出场的），让新建号、尚未打过对局的人也出现在排行榜末尾
    players.forEach((p) => {
      if (!map[p.id]) {
        map[p.id] = {
          id: p.id,
          name: p.name,
          games: 0,
          wins: 0,
          finishedGames: 0,
          banked: 0,
          mvp: 0,
          best: 0,
          campWin: {},
        };
      }
    });
    // 不再按出场数过滤；games===0 的标记 noRecord，排序时沉底
    return Object.values(map).map((r) => {
        const winRate = r.games ? r.wins / r.games : 0;
        const finishRate = r.games ? r.finishedGames / r.games : 0;
        const avg = r.games ? r.banked / r.games : 0;
        const entries = Object.entries(r.campWin)
          .map(([camp, count]) => ({
            camp,
            count,
            pct: Math.round((count / r.games) * 100),
            color: campColorMap[camp] || '#999999',
          }))
          .sort((a, b) => b.count - a.count);
        // 四舍五入后修正总和为 100，避免进度条总长出现缺口/溢出
        if (entries.length) {
          const diff = 100 - entries.reduce((sum, e) => sum + e.pct, 0);
          if (diff) entries[0].pct += diff;
        }
        return {
          id: r.id,
          name: r.name,
          games: r.games,
          wins: r.wins,
          finishedGames: r.finishedGames,
          banked: r.banked,
          mvp: r.mvp,
          best: r.best,
          winRate,
          finishRate,
          avg,
          campShares: entries,
          noRecord: r.games === 0,
        };
      });
  },

  // 与 Web 端 sortStats 同口径：主排序键降序，同值再按 胜局→出场→总得分 兜底
  sortRows(rows, key) {
    return rows.slice().sort((a, b) => {
      // 未出场玩家（无战绩）始终排在最后
      const aNo = a.noRecord ? 1 : 0;
      const bNo = b.noRecord ? 1 : 0;
      if (aNo !== bNo) return aNo - bNo;
      const diff = (b[key] ?? 0) - (a[key] ?? 0);
      if (diff !== 0) return diff;
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.games !== a.games) return b.games - a.games;
      if (b.banked !== a.banked) return b.banked - a.banked;
      return String(a.name).localeCompare(String(b.name), 'zh-Hans-CN');
    });
  },

  recompute() {
    const meta = SORT_KEYS[this.data.sortIndex];
    const key = meta.key;
    const percent = meta.percent;
    const rows = this.aggregate(this.data.allMatches, this.data.players, this.data.seasonId);
    const sorted = this.sortRows(rows, key);
    const fmt = (r) => {
      const v = r[key];
      if (percent) return pct(v);
      if (key === 'avg') return v.toFixed(1);
      return String(v);
    };
    const decorated = sorted.map((r, i) => ({
      ...r,
      rank: i + 1,
      primaryValue: fmt(r),
      avgText: String(Math.round(r.avg)),
      winRateText: pct(r.winRate),
      finishRateText: pct(r.finishRate),
      bestText: String(r.best),
    }));
    const scopeLabel =
      this.data.seasonId == null
        ? '全部赛季'
        : this.data.seasons[this.data.seasonIndex]
        ? this.data.seasons[this.data.seasonIndex].label
        : '全部赛季';
    this.setData({
      sortLabel: meta.label,
      activeKey: meta.key,
      scopeLabel,
      podium: decorated.slice(0, 3),
      rankings: decorated.slice(3),
    });
  },

  onSeasonChange(e) {
    const i = Number(e.detail.value);
    const id = this.data.seasons[i] ? this.data.seasons[i].id : null;
    this.setData({ seasonIndex: i, seasonId: id });
    this.recompute();
  },

  onSortChange(e) {
    const i = Number(e.detail.value);
    this.setData({ sortIndex: i });
    this.recompute();
  },

});
