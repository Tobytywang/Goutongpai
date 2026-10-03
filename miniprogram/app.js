// App 入口：启动即静默登录，拿到 token/openid 供后续请求使用
const auth = require('./utils/auth');

App({
  globalData: {
    token: '',
    openid: '',
  },

  onLaunch() {
    auth
      .ensureLogin()
      .then((info) => {
        this.globalData.token = info.token;
        this.globalData.openid = wx.getStorageSync('openid');
        console.log('[登录]', info.openid ? '已登录' : '完成');
      })
      .catch((err) => console.error('[登录失败]', err.message));
  },
});
