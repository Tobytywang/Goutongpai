// 全站统一分享内容：所有页面共用同一个 onShareAppMessage 返回值，
// 改这里即可全局生效。当前策略：固定宣传语 + 统一落地排行榜。
function buildShare() {
  return {
    title: '沟通牌 · 一起来记分，战绩一目了然',
    path: '/pages/leaderboard/leaderboard',
  };
}

// 显式启用右上角胶囊菜单的「转发」入口。
// 开发者工具里定义 onShareAppMessage 通常会自动显示转发菜单，但部分真机基础库版本
// 不会自动显示，需在页面显示时主动调用 wx.showShareMenu 才能亮起「转发」。
function enableShareMenu() {
  wx.showShareMenu({ menus: ['shareAppMessage'] });
}

module.exports = { buildShare, enableShareMenu };
