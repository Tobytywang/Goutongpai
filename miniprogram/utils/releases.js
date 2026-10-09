// 应用版本号 + 历史版本发布说明（「关于沟通牌」页数据源）
// 维护约定：每次上传新版本提审前——
//   1. 把 APP_VERSION 改成本次版本号；
//   2. 在 RELEASES 数组顶部加一条 { version, date, title, notes }，notes 为该版本更新要点。
const APP_VERSION = '1.1.2';

const RELEASES = [
  {
    version: '1.1.2',
    date: '',
    title: '修复',
    notes: [
      '转发功能修复',
      '支持版本显示（「我的 → 设置 → 关于沟通牌」）',
    ],
  },
  {
    version: '1.1.1',
    date: '',
    title: '新增',
    notes: [
      '支持转发功能',
    ],
  },
  {
    version: '1.1.0',
    date: '',
    title: '优化',
    notes: [
      'UI 优化',
      '表单提交优化',
    ],
  },
  {
    version: '1.0.0',
    date: '',
    title: '首个版本',
    notes: [
      '小程序首个版本上线',
      '计分、对局、高光、排名、玩家、赛季 功能上线',
    ],
  },
];

module.exports = { APP_VERSION, RELEASES };
