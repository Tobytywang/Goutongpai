// 技能字典维护（独立页）：从「我的 → 设置 → 技能」进入
// 只有「技能赛」的对局才给玩家选技能，字典在此统一维护（/api/skills 增删改查）
const { get, post, put, del } = require('../../utils/request');
const { confirmOn } = require('../../utils/confirm');

Page({
  data: {
    skills: [],
    loading: true,
    error: '',
    showForm: false,
    newName: '',
    editingId: '',
    editName: '',
  },

  onLoad() {
    this.load();
  },

  onPullDownRefresh() {
    this.load().then(() => wx.stopPullDownRefresh());
  },

  // /api/skills 直接返回带 usageCount 的列表，不必拉整份 bootstrap
  async load() {
    this.setData({ error: '' });
    try {
      const list = await get('/api/skills');
      this.setData({ skills: Array.isArray(list) ? list : [], loading: false });
    } catch (e) {
      this.setData({ loading: false, error: e.message || '加载失败' });
    }
  },

  // ---- 新建 ----
  toggleForm() {
    const open = !this.data.showForm;
    this.setData({
      showForm: open,
      newName: '',
      editingId: '',
      editName: '',
    });
  },
  onNewName(e) {
    this.setData({ newName: e.detail.value });
  },
  async submitSkill() {
    const name = (this.data.newName || '').trim();
    if (!name) {
      wx.showToast({ title: '请输入技能名称', icon: 'none' });
      return;
    }
    if (name.length > 8) {
      wx.showToast({ title: '技能名称最多8个字符', icon: 'none' });
      return;
    }
    try {
      await post('/api/skills', { name });
      this.setData({ showForm: false, newName: '' });
      wx.showToast({ title: '已添加', icon: 'success' });
      this.load();
    } catch (e) {
      wx.showToast({ title: e.message || '添加失败', icon: 'none' });
    }
  },

  // ---- 改名 ----
  openEdit(e) {
    const id = e.currentTarget.dataset.id;
    const s = this.data.skills.find((x) => String(x.id) === String(id));
    if (!s) return;
    this.setData({
      editingId: id,
      editName: s.name || '',
      showForm: false,
    });
  },
  onEditName(e) {
    this.setData({ editName: e.detail.value });
  },
  cancelEdit() {
    this.setData({ editingId: '', editName: '' });
  },
  async submitEdit() {
    const id = this.data.editingId;
    if (!id) return;
    const name = (this.data.editName || '').trim();
    if (!name) {
      wx.showToast({ title: '请输入技能名称', icon: 'none' });
      return;
    }
    if (name.length > 8) {
      wx.showToast({ title: '技能名称最多8个字符', icon: 'none' });
      return;
    }
    try {
      await put(`/api/skills/${id}`, { name });
      this.setData({ editingId: '', editName: '' });
      wx.showToast({ title: '已保存', icon: 'success' });
      this.load();
    } catch (e) {
      wx.showToast({ title: e.message || '保存失败', icon: 'none' });
    }
  },

  // ---- 删除（被对局引用的前端置灰 + 后端拦截，删除前统一二次确认）----
  async deleteSkill(e) {
    const id = Number(e.currentTarget.dataset.id);
    if (this._deleting) return;
    const s = this.data.skills.find((x) => String(x.id) === String(id));
    if (s && s.usageCount > 0) {
      wx.showToast({ title: '该技能已被对局引用，无法删除', icon: 'none' });
      return;
    }
    const ok = await confirmOn(this, {
      title: '删除技能',
      content: s ? `确认删除技能「${s.name}」？` : '确认删除该技能？',
      details: [{ label: '引用记录', value: s ? `${s.usageCount} 条` : '—' }],
      warning: '删除后不可恢复。已被对局引用的技能不能删除，可直接改名让历史记录跟随。',
      confirmText: '删除',
      danger: true,
    });
    if (!ok) return;
    this._deleting = true;
    try {
      await del(`/api/skills/${id}`);
      wx.showToast({ title: '已删除', icon: 'success' });
      this.load();
    } catch (err) {
      wx.showToast({ title: err.message || '删除失败', icon: 'none' });
    } finally {
      this._deleting = false;
    }
  },

  // 空函数：编辑表单容器 catchtap 阻止冒泡
  noop() {},
});
