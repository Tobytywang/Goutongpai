// 玩家资料查看页：封面(背景) + 头像 + 基础信息；支持更换头像/背景
const { get, del, BASE, getBootstrap } = require('../../utils/request');
const { uploadPlayerImage } = require('../../utils/upload');

function withMedia(p) {
  return Object.assign({}, p, {
    avatarUrl: p.avatar ? BASE + '/uploads/' + p.avatar : '',
    photoUrl: p.photo ? BASE + '/uploads/' + p.photo : '',
    initial: (p.name || '?').charAt(0),
  });
}

Page({
  data: { player: null, loading: true, error: '' },

  onLoad(q) {
    this.playerId = Number(q && q.id);
    this.load();
  },

  onShow() {
    if (this.playerId) this.load();
  },

  async load() {
    this.setData({ loading: true, error: '' });
    try {
      const d = await getBootstrap();
      const p = (d.players || []).find((x) => x.id === this.playerId);
      this.setData({ player: p ? withMedia(p) : null, loading: false });
    } catch (e) {
      this.setData({ loading: false, error: e.message });
    }
  },

  async upload(e) {
    const kind = e.currentTarget.dataset.kind;
    try {
      wx.showLoading({ title: '处理中' });
      await uploadPlayerImage(this.playerId, kind, { maxSide: kind === 'photo' ? 800 : 400, quality: 75 });
      wx.showToast({ title: '已更新', icon: 'success' });
      this.load();
    } catch (err) {
      if (/cancel|chooseMedia:fail|requirePrivacyAuthorize:fail/.test(err.message || '')) return;
      wx.showToast({ title: (err && err.message) || '上传失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  // 删除玩家：后端在有对局记录时会拦截（与 Web 端规则一致）
  async deletePlayer() {
    const p = this.data.player;
    if (!p) return;
    const ok = await new Promise((resolve) =>
      wx.showModal({
        title: '删除玩家',
        content: `确认删除「${p.name}」？该玩家若已有对局记录则无法删除。`,
        confirmText: '删除',
        confirmColor: '#ee0a24',
        success: resolve,
      })
    );
    if (!ok.confirm) return;
    try {
      await del(`/api/players/${p.id}`);
      wx.showToast({ title: '已删除', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 600);
    } catch (err) {
      wx.showToast({ title: err.message || '删除失败', icon: 'none' });
    }
  },
});
