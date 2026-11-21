// 切换编辑目标时的「滚动锚定」补偿（纯函数，可单测）
//
// 场景：A 卡在上方且已展开编辑抽屉，用户下滑到 B 卡点「编辑」。
// A 的抽屉被 wx:if 立即销毁 → A 卡片变矮 H → 文档流里 B 及之后所有内容上移 H，
// 刚点的按钮也跟着跳上去。抽屉挂在页脚之后的做法只能保证「同一张卡」内部不位移，
// 管不了其它卡片高度变化引起的重排。
//
// 修法等价于浏览器的 scroll anchoring：记录切换前锚点元素的视口 top，
// 切换后重测，把差值补进 scrollTop，锚点就回到原来的屏幕位置。
//   topAfter - topBefore = -H（上移） → scrollTop -= H（视口同步上移，内容看起来没动）
// scrollTop 不能为负，页面已接近顶部时只能补到 0，残余位移无法消除，故用 max(0, ...)。
function anchoredScrollTop(topBefore, topAfter, scrollTop) {
  return Math.max(0, scrollTop + (topAfter - topBefore));
}

module.exports = { anchoredScrollTop };
