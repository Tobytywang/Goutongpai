// 对局列表（复用 bootstrap.matches，与 Web 端同一数据源）
const { get } = require('../../utils/request');

Page({
  data: {
    matches: [],
    loading: true,
  },

  onShow() {
    this.load();
  },

  onPullDownRefresh() {
    this.load().then(() => wx.stopPullDownRefresh());
  },

  async load() {
    this.setData({ loading: true });
    try {
      const d = await get('/api/bootstrap');
      this.setData({ matches: d.matches || [], loading: false });
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: e.message, icon: 'none' });
    }
  },
});
