// 我的：选手管理 + 赛季管理 + 登录态展示（复用现有 /api 接口，与 Web 端互通）
const { get, post } = require('../../utils/request');

function maskOpenid() {
  const o = wx.getStorageSync('openid') || '';
  return o ? o.slice(0, 6) + '****' + o.slice(-4) : '未登录';
}

Page({
  data: {
    seasons: [],
    players: [],
    currentSeasonId: null,
    currentSeasonIndex: 0,
    openidMasked: '未登录',
    showPlayerForm: false,
    newPlayerName: '',
    newPlayerStyle: '',
    showSeasonForm: false,
    newSeasonName: '',
    deckOptions: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    deckIndex: 1,
    loading: true,
    error: '',
  },

  onShow() {
    this.loadAll();
  },

  onPullDownRefresh() {
    this.loadAll().then(() => wx.stopPullDownRefresh());
  },

  async loadAll() {
    this.setData({ loading: true, error: '', openidMasked: maskOpenid() });
    try {
      const d = await get('/api/bootstrap');
      const seasons = d.seasons || [];
      const curIdx = seasons.findIndex((s) => s.status === 'active');
      const idx = curIdx >= 0 ? curIdx : 0;
      const current = seasons[idx];
      this.setData({
        seasons,
        players: d.players || [],
        currentSeasonId: current ? current.id : null,
        currentSeasonIndex: idx,
        loading: false,
      });
    } catch (e) {
      this.setData({ loading: false, error: e.message });
    }
  },

  onSeasonChange(e) {
    const i = Number(e.detail.value);
    this.setData({ currentSeasonIndex: i, currentSeasonId: this.data.seasons[i].id });
  },

  togglePlayerForm() {
    this.setData({ showPlayerForm: !this.data.showPlayerForm, newPlayerName: '', newPlayerStyle: '' });
  },
  onPlayerName(e) {
    this.setData({ newPlayerName: e.detail.value });
  },
  onPlayerStyle(e) {
    this.setData({ newPlayerStyle: e.detail.value });
  },
  async submitPlayer() {
    const name = (this.data.newPlayerName || '').trim();
    if (!name) {
      wx.showToast({ title: '请输入昵称', icon: 'none' });
      return;
    }
    try {
      await post('/api/players', { name, style: this.data.newPlayerStyle });
      wx.showToast({ title: '已添加', icon: 'success' });
      this.setData({ showPlayerForm: false });
      this.loadAll();
    } catch (e) {
      wx.showToast({ title: e.message, icon: 'none' });
    }
  },

  toggleSeasonForm() {
    this.setData({ showSeasonForm: !this.data.showSeasonForm, newSeasonName: '', deckIndex: 1 });
  },
  onSeasonName(e) {
    this.setData({ newSeasonName: e.detail.value });
  },
  onDeckChange(e) {
    this.setData({ deckIndex: Number(e.detail.value) });
  },
  async submitSeason() {
    const name = (this.data.newSeasonName || '').trim();
    if (!name) {
      wx.showToast({ title: '请输入赛季名', icon: 'none' });
      return;
    }
    try {
      await post('/api/seasons', { name, deck_count: this.data.deckOptions[this.data.deckIndex] });
      wx.showToast({ title: '已创建', icon: 'success' });
      this.setData({ showSeasonForm: false });
      this.loadAll();
    } catch (e) {
      wx.showToast({ title: e.message, icon: 'none' });
    }
  },
});
