/**
 * 危险操作二次确认模态框（应用内）。
 *
 * 用法：页面 wxml 挂载 <confirm-modal id="confirmModal" /> 后，
 *       const ok = await confirmOn(this, { title, content, details, warning, confirmText });
 * 组件 open() 返回 Promise<boolean>：只有用户点「确认」才 resolve(true)，
 * 点取消 / 遮罩 / 关闭页面都算取消，避免误删。
 */
Component({
  data: {
    visible: false,
    title: '确认操作',
    content: '',
    details: [],       // [{ label, value }]
    warning: '',
    confirmText: '确认',
    cancelText: '取消',
    danger: true,
  },

  methods: {
    noop() {},

    /** 打开确认框；若上一次确认尚未决断，先按「取消」收尾，避免 Promise 悬挂 */
    open(options) {
      const opts = options || {};
      if (this._resolve) this._settle(false, false);
      this.setData({
        visible: true,
        title: opts.title || '确认操作',
        content: opts.content || '',
        details: Array.isArray(opts.details) ? opts.details : [],
        warning: opts.warning || '',
        confirmText: opts.confirmText || '确认',
        cancelText: opts.cancelText || '取消',
        danger: opts.danger !== false,
      });
      return new Promise((resolve) => {
        this._resolve = resolve;
      });
    },

    onCancel() {
      this._settle(false);
    },

    onConfirm() {
      this._settle(true);
    },

    _settle(result, hide = true) {
      const resolve = this._resolve;
      this._resolve = null;
      if (hide && this.data.visible) this.setData({ visible: false });
      if (resolve) resolve(!!result);
    },
  },

  lifetimes: {
    detached() {
      // 页面被销毁时（如删除后 navigateBack），确保等待中的 Promise 收尾为 false
      if (this._resolve) this._settle(false, false);
    },
  },
});
