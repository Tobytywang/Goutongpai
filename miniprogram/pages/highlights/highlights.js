// 高光时刻列表（复用 bootstrap.highlights；按赛季过滤，默认「全部赛季」）
const { get, getBootstrap } = require('../../utils/request');
const { pickCurrentSeason, withAllSeason } = require('../../utils/season');

Page({
  data: {
    seasons: [],
    seasonIndex: 0,
    seasonId: null,
    currentSeasonId: null,
    allHighlights: [],
    highlights: [],
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
      const all = d.highlights || [];
      const { id: activeId } = pickCurrentSeason(d.seasons || []);
      this.setData({
        seasons: withAllSeason(d.seasons || []),
        seasonIndex: 0,
        seasonId: null,
        currentSeasonId: activeId,
        allHighlights: all,
        highlights: all,
        loading: false,
      });
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: e.message, icon: 'none' });
    }
  },

  // 未关联赛季的高光归属到「当前赛季」，避免数据被隐藏
  filterBySeason(list, id) {
    if (id == null) return list;
    return list.filter((h) => h.season_id === id || (h.season_id == null && id === this.data.currentSeasonId));
  },

  onSeasonChange(e) {
    const i = Number(e.detail.value);
    const id = this.data.seasons[i] ? this.data.seasons[i].id : null;
    this.setData({
      seasonIndex: i,
      seasonId: id,
      highlights: this.filterBySeason(this.data.allHighlights, id),
    });
  },
});
