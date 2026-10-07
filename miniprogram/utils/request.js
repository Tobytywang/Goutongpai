// 网络请求封装：统一 baseURL、token 注入、错误归一化
// 生产域名已在微信后台配置为 request/uploadFile 合法域名。
// 开发期若域名未配置，可在微信开发者工具勾选「不校验合法域名」调试。
const BASE = 'https://goutongpai.tobyty.wang';

// ---- bootstrap 共享缓存：避免每个 tab 页 onShow 都重复拉全量数据（切 tab 迟滞感的主因） ----
// 8s 内复用同一份数据；任何写操作（POST/PUT/DELETE）成功后自动失效，保证写后切回能拿到新数据。
const BOOTSTRAP_TTL = 8000;
let _bootstrapCache = null; // { ts, data }
let _bootstrapInflight = null;

function invalidateBootstrap() {
  _bootstrapCache = null;
  _bootstrapInflight = null;
}

function getBootstrap(force) {
  const now = Date.now();
  if (!force && _bootstrapCache && now - _bootstrapCache.ts < BOOTSTRAP_TTL) {
    return Promise.resolve(_bootstrapCache.data);
  }
  if (_bootstrapInflight) return _bootstrapInflight;
  const p = request('/api/bootstrap', 'GET').then((data) => {
    _bootstrapCache = { ts: Date.now(), data };
    return data;
  });
  _bootstrapInflight = p;
  p.finally(() => { _bootstrapInflight = null; });
  return p;
}

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
          // 任何写操作成功后让 bootstrap 缓存失效，下次切回相应 tab 才会拉新数据
          if (method !== 'GET') invalidateBootstrap();
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
  getBootstrap,
  invalidateBootstrap,
};
