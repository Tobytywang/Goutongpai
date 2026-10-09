// 关于沟通牌：当前版本 + 历史版本发布说明（功能介绍）
const { APP_VERSION, RELEASES } = require('../../utils/releases');
const { buildShare, enableShareMenu } = require('../../utils/share');

Page({
  data: {
    appVersion: APP_VERSION,
    sdkVersion: '', // 真机基础库版本（只读展示，便于排查兼容性问题）
    releases: [],
    expanded: '', // 当前展开说明的版本号（手风琴，同一时间只展开一条）
  },

  onLoad() {
    let sdk = '';
    try {
      const info = wx.getAppBaseInfo ? wx.getAppBaseInfo() : wx.getSystemInfoSync();
      sdk = info.SDKVersion || '';
    } catch (e) {
      sdk = '';
    }
    this.setData({ sdkVersion: sdk, releases: RELEASES });
  },

  onShow() {
    enableShareMenu();
  },

  // 展开/收起某个版本的发布说明
  toggle(e) {
    const v = e.currentTarget.dataset.version;
    this.setData({ expanded: this.data.expanded === v ? '' : v });
  },

  // 转发：全站统一分享内容，见 utils/share.js
  onShareAppMessage() {
    return buildShare();
  },
});
