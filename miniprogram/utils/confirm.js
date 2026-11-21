/**
 * 危险操作二次确认统一入口。
 *
 * 优先走应用内统一模态框（components/confirm-modal），页面需在 wxml 挂载：
 *   <confirm-modal id="confirmModal" />
 * 并在页面 .json 注册 usingComponents。
 * 若组件未挂载（或旧页面漏接），自动降级到 wx.showModal，保证「删除必确认」不漏。
 *
 * @param {object} page  页面实例（Page 的 this）
 * @param {object} opts  { title, content, details: [{label,value}], warning, confirmText, cancelText, danger }
 * @returns {Promise<boolean>} 仅用户确认时为 true
 */
function confirmOn(page, opts) {
  const options = opts || {};
  const cfg = {
    title: options.title || '确认操作',
    content: options.content || '',
    details: Array.isArray(options.details) ? options.details : [],
    warning: options.warning || '',
    confirmText: options.confirmText || '确认',
    cancelText: options.cancelText || '取消',
    danger: options.danger !== false,
  };

  const modal = page && typeof page.selectComponent === 'function'
    ? page.selectComponent('#confirmModal')
    : null;
  if (modal && typeof modal.open === 'function') return modal.open(cfg);

  // 兜底：原生系统模态框，把详情与警示拼进 content，fail 也按取消处理（绝不误删）
  const lines = [cfg.content];
  cfg.details.forEach((d) => lines.push(d.label + '：' + d.value));
  if (cfg.warning) lines.push(cfg.warning);
  return new Promise((resolve) => {
    wx.showModal({
      title: cfg.title,
      content: lines.filter(Boolean).join('\n'),
      confirmText: cfg.confirmText,
      cancelText: cfg.cancelText,
      confirmColor: cfg.danger ? '#ee0a24' : '#0f5132',
      success: (res) => resolve(!!res.confirm),
      fail: () => resolve(false),
    });
  });
}

module.exports = { confirmOn };
