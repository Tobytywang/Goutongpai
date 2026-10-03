// 高光时刻列表（复用 bootstrap.highlights）
const { get } = require('../../utils/request');

Page({
  data: {
    highlights: [],
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
      this.setData({ highlights: d.highlights || [], loading: false });
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: e.message, icon: 'none' });
    }
  },
});
