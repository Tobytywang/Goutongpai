// App 入口：启动先弹隐私授权，再静默登录拿到 token/openid
const auth = require('./utils/auth');
const privacy = require('./utils/privacy');

App({
  globalData: {
    token: '',
    openid: '',
  },

  onLaunch() {
    // 阶段4：首次启动弹隐私授权（需先在 MP 后台配置《隐私保护指引》）
    privacy
      .checkPrivacy()
      .then(() => auth.ensureLogin())
      .then((info) => {
        this.globalData.token = info.token;
        this.globalData.openid = wx.getStorageSync('openid');
        console.log('[登录]', info.openid ? '已登录' : '完成');
      })
      .catch((err) => console.error('[登录失败]', err.message));
  },
});
