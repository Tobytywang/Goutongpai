// 我的：选手管理 + 赛季管理 + 登录态展示 + 头像上传（复用现有 /api 接口，与 Web 端互通）
const { get, post, BASE } = require('../../utils/request');
const { chooseImageAsDataUrl } = require('../../utils/upload');
const privacy = require('../../utils/privacy');

function maskOpenid() {
  const o = wx.getStorageSync('openid') || '';
  return o ? o.slice(0, 6) + '****' + o.slice(-4) : '未登录';
}

// 给选手补上头像访问地址（服务端只存文件名，前端拼出完整 URL）
function withAvatarUrl(p) {
  return Object.assign({}, p, {
    avatarUrl: p.avatar ? BASE + '/uploads/' + p.avatar : '',
  });
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
        players: (d.players || []).map(withAvatarUrl),
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

  // 阶段3：选图→压缩→base64→上传头像
  async uploadAvatar(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    try {
      wx.showLoading({ title: '处理中' });
      const dataUrl = await chooseImageAsDataUrl({ maxSide: 400, quality: 70 });
      await post('/api/players/' + id + '/avatar', { dataUrl });
      wx.showToast({ title: '头像已更新', icon: 'success' });
      this.loadAll();
    } catch (err) {
      // 用户主动取消选择/授权，不打扰
      if (/cancel|chooseMedia:fail|requirePrivacyAuthorize:fail/.test(err.message || '')) return;
      wx.showToast({ title: (err && err.message) || '上传失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  // 阶段4：打开隐私协议
  openPrivacy() {
    privacy.openContract();
  },
});
