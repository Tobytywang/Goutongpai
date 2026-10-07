// 我的（管理 hub）：玩家管理 + 赛季管理 + 设置 + 头像/背景上传与查看（复用现有 /api 接口，与 Web 端互通）
const { get, post, put, del, BASE, getBootstrap } = require('../../utils/request');
const { uploadPlayerImage, uploadSeasonImage } = require('../../utils/upload');
const privacy = require('../../utils/privacy');

function maskOpenid() {
  const o = wx.getStorageSync('openid') || '';
  return o ? o.slice(0, 6) + '****' + o.slice(-4) : '未登录';
}

// 当年当月最后一天（格式 YYYY-MM-DD），用于赛季默认结束时间
function currentMonthEnd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const last = new Date(y, m, 0).getDate();
  return y + '-' + (m < 10 ? '0' + m : m) + '-' + (last < 10 ? '0' + last : last);
}

// 给玩家补上头像/背景访问地址（服务端只存文件名，前端拼出完整 URL）
function withMedia(p) {
  const bio = (p.bio || '').trim();
  return Object.assign({}, p, {
    avatarUrl: p.avatar ? BASE + '/uploads/' + p.avatar : '',
    photoUrl: p.photo ? BASE + '/uploads/' + p.photo : '',
    initial: (p.name || '?').charAt(0),
    bio,
    hasBio: !!bio,
    playerCode: p.player_code || '',
  });
}

// 给赛季补上背景图访问地址（服务端只存文件名，前端拼出完整 URL）
function withSeasonMedia(s) {
  const note = (s.note || '').trim();
  return Object.assign({}, s, {
    photoUrl: s.photo ? BASE + '/uploads/' + s.photo : '',
    note,
    hasNote: !!note,
  });
}

// 从对局数据汇总玩家成绩（与 Web 端 computePlayerStats 口径一致：总得分只算「出完牌」的局）
function withStats(players, matches) {
  const map = new Map();
  (players || []).forEach((p) => map.set(p.id, { games: 0, wins: 0, banked: 0, mvps: 0 }));
  for (const m of matches || []) {
    for (const camp of m.camps || []) {
      for (const e of camp.players || []) {
        const s = map.get(e.player_id);
        if (!s) continue;
        s.games += 1;
        if (e.finished) s.banked += e.score;
        if (camp.is_winner) s.wins += 1;
        if (e.is_mvp) s.mvps += 1;
      }
    }
  }
  return (players || []).map((p) => {
    const s = map.get(p.id) || { games: 0, wins: 0, banked: 0, mvps: 0 };
    const winRate = s.games ? Math.round((s.wins / s.games) * 100) : 0;
    return Object.assign({}, p, { games: s.games, wins: s.wins, winRate, banked: s.banked, mvps: s.mvps });
  });
}

Page({
  data: {
    tab: 'players', // players | seasons | settings：页内分段导航，避免新增 tabBar（微信上限 5）
    seasons: [],
    players: [],
    openidMasked: '未登录',
    showPlayerForm: false,
    newPlayerName: '',
    newPlayerStyle: '',
    newPlayerCode: '',
    showSeasonForm: false,
    newSeasonName: '',
    newSeasonStartedOn: '',
    newSeasonEndedOn: currentMonthEnd(),
    newSeasonNote: '',
    editingId: '',
    editName: '',
    editStartedOn: '',
    editEndedOn: '',
    editNote: '',
    editingPlayerId: '',
    editPlayerName: '',
    editPlayerCode: '',
    editPlayerBio: '',
    loading: true,
    error: '',
  },

  onShow() {
    this.loadAll();
  },

  onPullDownRefresh() {
    this.loadAll(true).then(() => wx.stopPullDownRefresh());
  },

  async loadAll(force) {
    this.setData({ loading: true, error: '', openidMasked: maskOpenid() });
    try {
      const d = await getBootstrap(force);
      const seasons = (d.seasons || []).map(withSeasonMedia);
      const players = withStats(d.players || [], d.matches || []).map(withMedia);
      this.setData({
        seasons,
        players,
        loading: false,
      });
    } catch (e) {
      this.setData({ loading: false, error: e.message });
    }
  },

  setTab(e) {
    this.setData({ tab: e.currentTarget.dataset.tab });
  },


  togglePlayerForm() {
    const open = !this.data.showPlayerForm;
    this.setData({
      showPlayerForm: open,
      newPlayerName: '',
      newPlayerStyle: '',
      newPlayerCode: '',
      showSeasonForm: false,
      editingPlayerId: '',
      editingId: '',
    });
  },
  onPlayerCode(e) {
    this.setData({ newPlayerCode: e.detail.value });
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
    if (name.length > 6) {
      wx.showToast({ title: '昵称最多6个字符', icon: 'none' });
      return;
    }
    const digits = (this.data.newPlayerCode || '').trim();
    let player_code = '';
    if (digits) {
      if (!/^\d{3}$/.test(digits)) {
        wx.showToast({ title: '编号须为 001-999 的三位数字', icon: 'none' });
        return;
      }
      player_code = `GT-${digits}`;
    }
    try {
      const body = { name, style: this.data.newPlayerStyle };
      if (player_code) body.player_code = player_code;
      await post('/api/players', body);
      wx.showToast({ title: '已添加', icon: 'success' });
      this.setData({ showPlayerForm: false });
      this.loadAll();
    } catch (e) {
      wx.showToast({ title: e.message, icon: 'none' });
    }
  },

  toggleSeasonForm() {
    const open = !this.data.showSeasonForm;
    this.setData({
      showSeasonForm: open,
      newSeasonName: '',
      newSeasonStartedOn: '',
      newSeasonEndedOn: currentMonthEnd(),
      newSeasonNote: '',
      showPlayerForm: false,
      editingPlayerId: '',
      editingId: '',
    });
  },
  onSeasonName(e) {
    this.setData({ newSeasonName: e.detail.value });
  },
  onSeasonStartedOn(e) {
    this.setData({ newSeasonStartedOn: e.detail.value });
  },
  onSeasonEndedOn(e) {
    this.setData({ newSeasonEndedOn: e.detail.value });
  },
  onSeasonNote(e) {
    this.setData({ newSeasonNote: e.detail.value });
  },
  async submitSeason() {
    const name = (this.data.newSeasonName || '').trim();
    if (!name) {
      wx.showToast({ title: '请输入赛季名', icon: 'none' });
      return;
    }
    if (name.length > 8) {
      wx.showToast({ title: '赛季名称最多8个字符', icon: 'none' });
      return;
    }
    try {
      await post('/api/seasons', {
        name,
        started_on: this.data.newSeasonStartedOn || '',
        ended_on: this.data.newSeasonEndedOn || '',
        note: this.data.newSeasonNote || '',
      });
      wx.showToast({ title: '已创建', icon: 'success' });
      this.setData({ showSeasonForm: false });
      this.loadAll();
    } catch (e) {
      wx.showToast({ title: e.message, icon: 'none' });
    }
  },

  // 编辑赛季：打开内联编辑表单，带入当前值
  openEditSeason(e) {
    const id = e.currentTarget.dataset.id;
    const s = this.data.seasons.find((x) => x.id === id);
    if (!s) return;
    this.setData({
      editingId: id,
      editName: s.name || '',
      editStartedOn: s.started_on || '',
      editEndedOn: s.ended_on || currentMonthEnd(),
      editNote: s.note || '',
      showSeasonForm: false,
      showPlayerForm: false,
      editingPlayerId: '',
    }, () => {
      const last = this.data.seasons[this.data.seasons.length - 1];
      if (last && String(last.id) === String(id)) {
        this.scrollToBottom();
      }
    });
  },
  // 滚动到页面底部，用于最后一个卡片的内联表单展开后不被 tabBar 遮挡
  scrollToBottom() {
    wx.pageScrollTo({ scrollTop: Number.MAX_SAFE_INTEGER, duration: 250 });
  },
  onEditName(e) {
    this.setData({ editName: e.detail.value });
  },
  onEditStartedOn(e) {
    this.setData({ editStartedOn: e.detail.value });
  },
  onEditEndedOn(e) {
    this.setData({ editEndedOn: e.detail.value });
  },
  onEditNote(e) {
    this.setData({ editNote: e.detail.value });
  },
  cancelEditSeason() {
    this.setData({ editingId: '' });
  },
  async submitEditSeason() {
    const id = this.data.editingId;
    if (!id) return;
    const name = (this.data.editName || '').trim();
    if (!name) {
      wx.showToast({ title: '请输入赛季名', icon: 'none' });
      return;
    }
    if (name.length > 8) {
      wx.showToast({ title: '赛季名称最多8个字符', icon: 'none' });
      return;
    }
    try {
      await put(`/api/seasons/${id}`, {
        name,
        started_on: this.data.editStartedOn || '',
        ended_on: this.data.editEndedOn || '',
        note: this.data.editNote || '',
      });
      wx.showToast({ title: '已保存', icon: 'success' });
      this.setData({ editingId: '' });
      this.loadAll();
    } catch (e) {
      wx.showToast({ title: e.message, icon: 'none' });
    }
  },

  // 编辑玩家：打开内联编辑表单，带入当前值（昵称 / ID / 签名）
  openEditPlayer(e) {
    const id = e.currentTarget.dataset.id;
    const p = this.data.players.find((x) => x.id === id);
    if (!p) return;
    this.setData({
      editingPlayerId: id,
      editPlayerName: p.name || '',
      editPlayerCode: p.playerCode || '',
      editPlayerBio: p.bio || '',
      showPlayerForm: false,
      showSeasonForm: false,
      editingId: '',
    }, () => {
      const last = this.data.players[this.data.players.length - 1];
      if (last && String(last.id) === String(id)) {
        this.scrollToBottom();
      }
    });
  },
  onEditPlayerName(e) {
    this.setData({ editPlayerName: e.detail.value });
  },
  onEditPlayerBio(e) {
    this.setData({ editPlayerBio: e.detail.value });
  },
  cancelEditPlayer() {
    this.setData({ editingPlayerId: '' });
  },
  async submitEditPlayer() {
    const id = this.data.editingPlayerId;
    if (!id) return;
    const name = (this.data.editPlayerName || '').trim();
    if (!name) {
      wx.showToast({ title: '请输入昵称', icon: 'none' });
      return;
    }
    if (name.length > 6) {
      wx.showToast({ title: '昵称最多6个字符', icon: 'none' });
      return;
    }
    try {
      // ID 由系统按注册顺序分配，编辑时不允许修改
      const body = { name, bio: this.data.editPlayerBio || '' };
      await put(`/api/players/${id}`, body);
      wx.showToast({ title: '已保存', icon: 'success' });
      this.setData({ editingPlayerId: '' });
      this.loadAll();
    } catch (e) {
      wx.showToast({ title: e.message || '保存失败', icon: 'none' });
    }
  },
  // 空函数：用于编辑表单容器 catchtap 阻止冒泡到卡片整体（避免触发 viewPlayer）
  noop() {},

  // 置为当前赛季：后端保证全局有且仅 1 个当前赛季（无取消，只能被另一个赛季顶替）
  async pinSeason(e) {
    const id = e.currentTarget.dataset.id;
    try {
      await post(`/api/seasons/${id}/pin`);
      wx.showToast({ title: '已更新', icon: 'success' });
      this.loadAll();
    } catch (err) {
      wx.showToast({ title: err.message || '操作失败', icon: 'none' });
    }
  },

  // 删除玩家：后端在有对局记录时会拦截（与 Web 端规则一致）；前端对有对局的玩家直接置灰禁用 + 防御兜底
  async deletePlayer(e) {
    const id = e.currentTarget.dataset.id;
    const p = this.data.players.find((x) => x.id === id);
    if (p && p.games > 0) {
      wx.showToast({ title: '该玩家已有对局，无法删除', icon: 'none' });
      return;
    }
    const ok = await new Promise((resolve) =>
      wx.showModal({
        title: '删除玩家',
        content: p ? `确认删除「${p.name}」？需先删除该玩家的全部关联对局才能移除。` : '确认删除？',
        confirmText: '删除',
        confirmColor: '#ee0a24',
        success: resolve,
      })
    );
    if (!ok.confirm) return;
    try {
      await del(`/api/players/${id}`);
      wx.showToast({ title: '已删除', icon: 'success' });
      this.loadAll();
    } catch (err) {
      wx.showToast({ title: err.message || '删除失败', icon: 'none' });
    }
  },

  // 删除赛季：后端在有对局记录时会拦截（与 Web 端规则一致）；前端对有关联对局的赛季直接置灰禁用
  async deleteSeason(e) {
    const id = e.currentTarget.dataset.id;
    const s = this.data.seasons.find((x) => x.id === id);
    if (s && s.matchCount > 0) {
      wx.showToast({ title: '该赛季已有对局，无法删除', icon: 'none' });
      return;
    }
    const ok = await new Promise((resolve) =>
      wx.showModal({
        title: '删除赛季',
        content: s ? `确认删除「${s.name}」？` : '确认删除？',
        confirmText: '删除',
        confirmColor: '#ee0a24',
        success: resolve,
      })
    );
    if (!ok.confirm) return;
    try {
      await del(`/api/seasons/${id}`);
      wx.showToast({ title: '已删除', icon: 'success' });
      this.loadAll();
    } catch (err) {
      wx.showToast({ title: err.message || '删除失败', icon: 'none' });
    }
  },

  // 查看玩家资料（头像 + 背景）
  viewPlayer(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: '/pages/player/player?id=' + id });
  },

  // 上传头像
  async uploadAvatar(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    try {
      wx.showLoading({ title: '处理中' });
      await uploadPlayerImage(id, 'avatar', { maxSide: 400, quality: 70 });
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

  // 上传背景图片
  async uploadPhoto(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    try {
      wx.showLoading({ title: '处理中' });
      await uploadPlayerImage(id, 'photo', { maxSide: 800, quality: 75 });
      wx.showToast({ title: '背景已更新', icon: 'success' });
      this.loadAll();
    } catch (err) {
      // 用户主动取消选择/授权，不打扰
      if (/cancel|chooseMedia:fail|requirePrivacyAuthorize:fail/.test(err.message || '')) return;
      wx.showToast({ title: (err && err.message) || '上传失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  // 上传赛季背景图（与玩家背景图同一套上传逻辑）
  async uploadSeasonPhoto(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    try {
      wx.showLoading({ title: '处理中' });
      await uploadSeasonImage(id, { maxSide: 800, quality: 75 });
      wx.showToast({ title: '背景已更新', icon: 'success' });
      this.loadAll();
    } catch (err) {
      // 用户主动取消选择/授权，不打扰
      if (/cancel|chooseMedia:fail|requirePrivacyAuthorize:fail/.test(err.message || '')) return;
      wx.showToast({ title: (err && err.message) || '上传失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  // 打开隐私协议
  openPrivacy() {
    privacy.openContract();
  },
});
