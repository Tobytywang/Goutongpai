// 网络请求封装：统一 baseURL、token 注入、错误归一化
// 生产域名已在微信后台配置为 request/uploadFile 合法域名。
// 开发期若域名未配置，可在微信开发者工具勾选「不校验合法域名」调试。
const BASE = 'https://goutongpai.tobyty.wang';

function request(path, method = 'GET', data = {}) {
  return new Promise((resolve, reject) => {
    const header = { 'Content-Type': 'application/json' };
    const token = wx.getStorageSync('token');
    if (token) header.Authorization = 'Bearer ' + token;

    wx.request({
      url: BASE + path,
      method,
      data,
      header,
      success: (res) => {
        const body = res.data || {};
        if (res.statusCode >= 200 && res.statusCode < 300 && body.ok) {
          resolve(body.data);
        } else {
          reject(new Error(body.error || 'HTTP ' + res.statusCode));
        }
      },
      fail: (err) => reject(new Error((err && err.errMsg) || '网络错误')),
    });
  });
}

module.exports = {
  BASE,
  request,
  get: (p) => request(p, 'GET'),
  post: (p, d) => request(p, 'POST', d),
  put: (p, d) => request(p, 'PUT', d),
  del: (p, d) => request(p, 'DELETE', d),
};
