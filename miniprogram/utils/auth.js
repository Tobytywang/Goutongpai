// 微信登录态管理：wx.login -> /api/auth/login -> 存 token/openid
const { post } = require('./request');

// 静默登录：拿 code 换 token（仅获取 openid，不弹窗）
function login() {
  return new Promise((resolve, reject) => {
    wx.login({
      success: (res) => {
        if (!res.code) {
          reject(new Error('wx.login 未返回 code'));
          return;
        }
        post('/api/auth/login', { code: res.code })
          .then((data) => {
            wx.setStorageSync('token', data.token);
            wx.setStorageSync('openid', data.openid);
            resolve(data);
          })
          .catch(reject);
      },
      fail: (err) => reject(new Error((err && err.errMsg) || 'wx.login 失败')),
    });
  });
}

// 确保已登录：有 token 直接返回，否则登录
function ensureLogin() {
  const token = wx.getStorageSync('token');
  if (token) return Promise.resolve({ token });
  return login();
}

module.exports = { login, ensureLogin };
