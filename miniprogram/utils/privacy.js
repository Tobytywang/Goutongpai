// 隐私合规：首次启动弹出微信隐私授权；并提供查看隐私协议入口。
// 前置：需先在微信公众平台「设置 → 服务内容 → 用户隐私保护指引」配置并审核通过《隐私保护指引》，
// 否则 getPrivacySetting 可能返回 needAuthorization=false，弹窗不会触发（属正常）。

/**
 * 检查并弹出隐私授权。返回 Promise，用户同意或拒绝/接口不可用时都 resolve，避免阻塞启动。
 */
function checkPrivacy() {
  return new Promise((resolve) => {
    if (!wx.getPrivacySetting) {
      resolve();
      return;
    }
    wx.getPrivacySetting({
      success: (res) => {
        if (res && res.needAuthorization) {
          wx.requirePrivacyAuthorize({
            success: () => resolve(),
            fail: () => resolve(), // 用户拒绝也放行；具体敏感操作可在页面再次触发
          });
        } else {
          resolve();
        }
      },
      fail: () => resolve(),
    });
  });
}

/** 打开已配置的隐私协议（用户点「隐私政策」时调用） */
function openContract() {
  if (wx.openPrivacyContract) {
    wx.openPrivacyContract({
      fail: () => wx.showToast({ title: '尚未配置隐私协议', icon: 'none' }),
    });
  } else {
    wx.showToast({ title: '当前基础库不支持', icon: 'none' });
  }
}

module.exports = { checkPrivacy, openContract };
