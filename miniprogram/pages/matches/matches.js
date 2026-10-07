// 对局列表（复用 bootstrap.matches，与 Web 端同一数据源；按赛季过滤，默认「全部赛季」）
const { get, del, getBootstrap } = require('../../utils/request');
const { withAllSeason } = require('../../utils/season');

Page({
  data: {
    seasons: [],
    seasonIndex: 0,
    seasonId: null,
    allMatches: [],
    matches: [],
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
      const players = d.players || [];
      const playerMap = new Map(players.map((p) => [p.id, p]));
      const all = (d.matches || []).map((m) => ({
        ...m,
        camps: (m.camps || []).map((c) => ({
          ...c,
          players: (c.players || []).map((p) => ({
            ...p,
            name: (playerMap.get(p.player_id) && playerMap.get(p.player_id).name) || `玩家${p.player_id}`,
          })),
        })),
      }));

      // 计算「当日第 N 局」：按 played_at 分组，组内按 id 升序
      const dateGroup = new Map();
      all.forEach((m) => {
        if (!dateGroup.has(m.played_at)) dateGroup.set(m.played_at, []);
        dateGroup.get(m.played_at).push(m);
      });
      dateGroup.forEach((list) => {
        list.sort((a, b) => a.id - b.id);
        list.forEach((m, i) => (m.daily_index = i + 1));
      });
      this.setData({
        seasons: withAllSeason(d.seasons || []),
        players,
        seasonIndex: 0,
        seasonId: null,
        allMatches: all,
        matches: all,
        loading: false,
      });
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: e.message, icon: 'none' });
    }
  },

  onSeasonChange(e) {
    const i = Number(e.detail.value);
    const id = this.data.seasons[i] ? this.data.seasons[i].id : null;
    const all = this.data.allMatches;
    this.setData({
      seasonIndex: i,
      seasonId: id,
      matches: id == null ? all : all.filter((m) => m.season_id === id),
    });
  },

  async deleteMatch(e) {
    const id = e.currentTarget.dataset.id;
    const ok = await new Promise((resolve) =>
      wx.showModal({
        title: '删除本局记录',
        content: `确认删除第 #${id} 局？该局分数将从所有排行榜中移除，且不可恢复。`,
        confirmText: '删除',
        confirmColor: '#ee0a24',
        success: resolve,
      })
    );
    if (!ok.confirm) return;
    try {
      await del(`/api/matches/${id}`);
      wx.showToast({ title: '已删除', icon: 'success' });
      this.load();
    } catch (err) {
      wx.showToast({ title: err.message || '删除失败', icon: 'none' });
    }
  },
});
