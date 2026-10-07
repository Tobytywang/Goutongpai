# 沟通牌小程序 UI 设计规范（Design System）

> 适用：微信原生小程序「沟通牌」（`miniprogram/` 目录）
> 状态：v1.6 · 生效日期 2026-10-05
> 定位：所有页面开发、组件封装、UI 走查的**单一事实来源（SSOT）**。

---

## 1. 目的与适用范围
统一「沟通牌」小程序（微信原生）的视觉语言，解决当前按钮大小不一、字号参差不齐、颜色/圆角/间距散落写死，以及排行榜等业务场景"退化为通用列表"的问题。本规范是后续所有页面开发、组件封装与 UI 走查的单一事实来源。

---

## 2. 设计原则
1. **一致性优先** — 同类元素（按钮、卡片、列表项）在所有页面表现一致。
2. **Token 驱动** — 颜色 / 字号 / 间距 / 圆角只允许引用设计变量，禁止散落写死。
3. **可读性** — 正文 ≥ 28rpx，辅助文字 ≥ 24rpx。
4. **可点击区域** — 按钮最小可点高度 **56rpx**（iOS HIG ≥ 44pt）；主操作更高。
5. **场景有语义** — 强语义业务场景（如排行榜）必须有专属视觉规则，禁止退化为通用列表。
6. **克制** — 圆角分 3 档，层级不冗余。
7. **导航有上限** — 底部 tabBar 严格 ≤ 5（微信硬上限）；强相关的管理功能用**页内分段导航（seg）**承载，不得为管理项新增 tab；新页面走 `navigateTo`，不入 tabBar。

---

## 3. 设计 Token（全部定义在 `app.wxss` 的 `page{}` 上）

基准：750rpx 设计稿，1rpx = 0.5px @2x。

### 3.1 颜色 color
| Token | 值 | 用途 |
|---|---|---|
| `--color-primary` | #0f5132 | 品牌主色：主按钮、强调、tabBar 选中 |
| `--color-primary-light` | #e7f3ec | 主色浅底：添加型按钮、标签底、头像占位 |
| `--color-text` | #323233 | 主文字 |
| `--color-text-secondary` | #969799 | 次要/辅助文字 |
| `--color-text-disabled` | #c8c9cc | 禁用文字 |
| `--color-bg` | #f5f5f5 | 页面背景 |
| `--color-card` | #ffffff | 卡片背景 |
| `--color-fill` | #f5f5f5 | 输入框/灰底填充 |
| `--color-border` | #f0f0f0 | 分割线/描边 |
| `--color-danger` | #ee0a24 | 删除/告警 |
| `--color-win` | #07c160 | 成功/过线 |
| `--color-medal-gold` | #F0B429 | 排名第 1 奖牌 |
| `--color-medal-silver` | #C8CDD4 | 排名第 2 奖牌 |
| `--color-medal-bronze` | #D98E32 | 排名第 3 奖牌 |

### 3.2 字号 font-size（禁止出现 22/26/32 等非刻度值）
| Token | 值 | 用途 |
|---|---|---|
| `--font-size-xs` | 20rpx | 角标/标签 |
| `--font-size-sm` | 24rpx | 辅助说明、小按钮 |
| `--font-size-base` | 28rpx | 正文、标准按钮 |
| `--font-size-md` | 30rpx | 强调正文、副标题、分数 |
| `--font-size-lg` | 34rpx | 卡片/页面标题 |
| `--font-size-xl` | 40rpx | 大数字/总分（按需） |

### 3.3 间距 spacing（8rpx 基准）
| Token | 值 | 用途 |
|---|---|---|
| `--space-xs` | 8rpx | 紧凑内距 |
| `--space-sm` | 16rpx | 元素间、列表项小距 |
| `--space-md` | 24rpx | 卡片内外距基准 |
| `--space-lg` | 32rpx | 区块间 |
| `--space-xl` | 48rpx | 大留白 |

### 3.4 圆角 radius
| Token | 值 | 用途 |
|---|---|---|
| `--radius-sm` | 8rpx | 标签、角标 |
| `--radius-md` | 12rpx | 输入框、小按钮 |
| `--radius-lg` | 16rpx | 卡片、大按钮 |
| `--radius-round` | 999rpx | 胶囊按钮（按需） |

### 3.5 阴影
- 卡片：`0 2rpx 12rpx rgba(0,0,0,0.04)`（全局统一，不改）。
- 分段导航选中项：`0 1rpx 4rpx rgba(0,0,0,0.06)`。

---

## 4. 按钮规范 Button

### 4.1 全局基类（必须）
所有 `<button>` 必须清除微信默认边框、内距、外边距与最小宽度：
```css
button {
  border: none;
  padding: 0;
  margin: 0;
  min-width: 0;
}
button::after { border: none; }
```
高度用固定 `height` 控制，配合 `line-height` 或 flex 居中，**不靠 line-height 撑高**。

### 4.2 类型 × 尺寸矩阵
**类型（颜色）**
| 类 | 底色 | 字色 | 场景 |
|---|---|---|---|
| `.btn-primary` | 主色填充 | #fff | 主操作 / 新建 / 保存 / 创建 / + 阵营（创建新结构，页面级主操作） |
| `.btn-ghost` | 灰底 `--color-fill` | 主色 | 次级 / 局部补充操作：头像 / 背景 / 更换 / 阵营内「+ 添加玩家」 |
| `.btn-danger` | 红底 `--color-danger` | #fff | **仅用于删除类操作**：删除本局 / 删除玩家 / 删除赛季（绝不与主按钮混用，且需 `hover-class="btn-hover"`） |
| `.btn-add` | 主色浅底 | 主色 | ~~添加类~~ **已弃用**；新代码所有"新建 / 添加"按场景归入 `.btn-primary.mini`（主）或 `.btn-ghost.mini`（次） |

**尺寸（高度 / 字号 / 横向内距 / 圆角）**
| 修饰 | 高度 | 字号 | 横向内距 | 圆角 | 典型场景 |
|---|---|---|---|---|---|
| 默认（中号） | 72rpx | 28rpx | 0 32rpx | md(12) | 独立表单页"保存/创建"（如整页表单提交） |
| `.mini` | 56rpx | 24rpx | 0 24rpx | md(12) | 行内 / 卡片内操作："+ 阵营 / + 新建 / + 添加玩家"、头像 / 背景按钮、以及由这些按钮展开表单内的"保存/创建" |
| `.submit` | 88rpx | 30rpx | 0 | lg(16) | 整行"保存对局"（底部通栏主操作） |

> 按钮最小高度 56rpx；行内 / 紧凑操作用 `.mini`，禁止出现高度各异、颜色两套的按钮。**同一视觉区域内不得堆叠两个深绿主按钮**——页面级主操作（如「保存对局」）用 `.btn-primary`（或 `.btn-primary.submit`），局部补充操作（如阵营内「+ 添加玩家」）用 `.btn-ghost.mini` 降级；卡片内由 `+ 新建 / + 添加` 展开的保存/创建须与触发它的按钮保持同尺寸（mini），避免同一视觉区域内出现高低两套主按钮。
> 
> `.mini` 统一覆盖 `min-width: 0 !important`，强制避免微信原生 `button` 默认最小宽度（约 176rpx）把「删除」等短文案按钮撑得过宽；删除按钮统一用 `.btn-danger.mini`，与玩家/赛季/对局列表保持一致。

### 4.3 状态
- 禁用：`.btn-primary[disabled]` 用 `#b9c9c0` 底白字（保留现行）。
- 按下：统一加 `hover-class="btn-hover"`，`.btn-hover { opacity:.85 }`。
- **禁止**：前端写死 `font-size:18px` 默认；按钮高度不一致。

---

## 5. 文字排版规范
| 类 | 字号 | 字重 | 颜色 | 场景 |
|---|---|---|---|---|
| `.title` | lg(34) | 600 | text | 卡片/页面标题 |
| `.name` | base(28) | 500 | text | 列表主文字 |
| `.muted` | sm(24) | 400 | secondary | 辅助说明 |
| `.tag` | xs(20) | 400 | win | 状态标签 |
| `.win` | base(28) | 600 | win | 过线高亮 |

> ⚠️ `text` 组件**不继承**父级字号，凡展示文字须显式挂语义类或 token。

---

## 6. 组件统一规范
- **卡片 `.card`**：白底、圆角 lg(16)、内距 md(24)、外距 md(24)、阴影统一。
- **列表项 `.list-item` / `.player-row`**：上下内距 md(24)、分割线 `1rpx solid var(--color-border)`、flex 两端对齐、主文字 `.name`、次文字 `.muted`。**首项上方不得出现分割线**——统一用 `border-bottom` + `:last-child { border-bottom: none }`，只在项与项之间画线。
- **表单 `.input` / `.picker`**：灰底 `--color-fill`、圆角 md(12)、字号 base(28)。其中 `.input` 必须固定 `height:80rpx; line-height:80rpx; padding:0 24rpx`，避免微信小程序 input 默认高度不足导致 placeholder/输入文字上下被截断；`.picker` 保持 16rpx 24rpx 内距。
- **表单行 `.form-row` + 左对齐控件**：标签（`.form-label`）居左、**左对齐**、固定 `min-width:80rpx`，保证不同字数标签的左侧在同一条垂线上；右侧控件（选择器 `.picker-right` / `.picker-value` 或 input）占满剩余宽度，容器左侧也在同一条垂线上。选择器内部值（`.picker-text`）与表单行内 input 的文字/placeholder 均**左对齐**，箭头（`.picker-arrow`）在最右侧。用于「赛季 / 牌副数」等独立表单项，避免整行文本忽左忽右、标签列不齐；80rpx 按 2 个 28rpx 中文字 + 少量留白计算，既能容纳常见两字标签，又不会让标签与控件之间留白过大。
- **标签 `.tag`**：浅绿底 `--color-primary-light`、绿字 `--color-win`、圆角 sm(8)、字号 xs(20)、内距 4rpx 12rpx。
- **分割线**：统一 `1rpx solid var(--color-border)`，禁止散写 `#f0f0f0`。
- **页面根容器 `.page`**：**不设置 `min-height:100vh` / `min-height:100%`**。微信带 tabBar 的页面里，`page` 根容器即使写 `100%` 仍按整屏高度算（tabBar 覆盖在 webview 之上），设满屏高度会多出约一截被 tabBar 盖住的高度 → 内容没填满却出现 phantom 滚动条。正确做法：`.page` 高度 = 内容高度（不设强制高度），下方空白由 `page` 背景 `--color-bg` 同色铺满，视觉整屏铺满且无多余滚动条。`.page` 保留 `background/字体/颜色` 继承基准 + `overflow-x:clip`（防横向溢出且不破坏 `position:sticky`）。
- **页内分段导航 `.seg`**：强相关管理功能的二级导航（如「玩家 / 赛季 / 设置」）。`.seg` 为灰底 `--color-fill`、圆角 lg(16) 容器；`.seg-item` 等分项次文字色；`.seg-active` 白底主色字加微阴影。**代替新增 tabBar 项**（见 §8）。
- **头像 `.avatar` / 占位 `.avatar-ph`**：圆形 64rpx；无图时用 `.avatar-ph`（主色浅底 + 首字），保证列表视觉完整。
- **状态胶囊 `.chip`（用于行内布尔状态切换）**：`<view>` 承载、`display:inline-flex`、内容水平垂直居中（`justify-content:center`）、胶囊圆角 `--radius-round`、字号 sm(24)、灰底 `--color-fill` 次文字色、`min-width:88rpx`。激活态 `.chip.active` 用主色浅底 + 主色字区分——**禁止用 `font-weight` 加粗区分**（加粗会使激活态字宽略增、胶囊宽度变化，导致点亮/非点亮宽度不一致）；特殊语义（如 MVP）可用 `.chip.mvp.active`（暖橙 `#ff9c00` + 浅橙底 `#fff7e6`）。典型场景：计分页「已出完 / 未出完」「MVP」切换，替代裸 `<text>`。
- **行内操作区 `.player-actions`**：用于把「已出完 / MVP / 删除」等右侧操作整体右对齐。`display:flex; gap:--space-sm; margin-left:auto; flex-shrink:0`，父级 `.player-row` 用 flex 布局即可自动把操作区推到最右。
- **得分输入 `.score-input`**：在 `.player-row` 内应设 `flex:1; min-width:120rpx; max-width:240rpx`，**占据「选择玩家」与右侧 `.player-actions` 之间的剩余空间**，避免与「已出完」等操作之间出现过大空隙（固定窄宽度 + 右侧操作区 `margin-left:auto` 会把空白挤到中间）。占位文字用「得分」、固定高度 72rpx + line-height 72rpx 防截顶。
- **玩家选择器 `.player-row picker / .picker.sm`**：在计分页玩家行内必须固定宽度（外层 picker 组件 `flex:0 0 216rpx`，内部 view `width:100%`），**不随玩家昵称长度伸缩**，避免选中短名（如 `BUG`）时选择器变窄、未选时「选择玩家」又变宽，导致整行忽宽忽窄。216rpx 按 28rpx 字号 + 16rpx 左右内距计算，刚好容纳 6 个汉字并留少量呼吸空间。内容居中、超长用省略号截断；玩家昵称同时限制最多 6 个字符（含中文），从数据源保证不溢出。
- **赛季卡片 `.season-card`**：管理页（「我的 → 赛季」）每个赛季是一张独立卡片（`.card.season-card`），整卡 `padding:0; overflow:hidden`，**头部为全幅背景 banner**（与玩家卡一致）：① `.season-card__header`（`position:relative; height:220rpx; padding:var(--space-md); background:#0f5132`）与玩家卡头部等高，内含 `.season-card__header-bg`（`<image mode="aspectFill">`，有背景图时显示）或 `.season-card__header-pattern`（默认 felt 绿底 + 白点阵 `::after`）；有图时叠加 `.season-card__header.has-photo::after` 暗色蒙层；`.season-card__header-inner`（`z-index:2`）内含 `.season-card__head`（`display:flex; justify-content:space-between`），左 `.name`（赛季名称，反白 `#fff`），右 `.season-card__flags`（仅 `.tag`「当前」，取消「进行中/已归档」状态徽章）；其下 `.season-card__note`（**始终渲染**，有说明时反白显示真实说明，无说明时显示占位「暂无说明」并加 `.season-card__note--placeholder` 类——淡色 + 斜体；`margin-top:16rpx`，最多 2 行并加省略号，占位保证 `min-height: 3em`，使赛季卡头部与玩家卡头部视觉高度完全统一）；② `.season-card__info`（`padding:var(--space-sm) var(--space-md)`）一行内 `justify-content:space-between` 并列 4 个 `.info-item`，展示开始/结束/对局/玩家，空值 `--` 占位；`.info-item` 内标签与数值 `gap:8rpx`；info 区上下留白与玩家卡 body 一致，保证赛季卡与玩家卡总高度相等；③ 底部 `.season-card__foot`（`margin-top:var(--space-sm); padding:16rpx var(--space-md) 24rpx`，与上方 `.season-card__info` 保持紧凑，`gap:var(--space-sm)`）水平排列操作按钮；注意必须保留底部 `padding-bottom:24rpx`，防止按钮贴底或点击态超出卡片边界（`width:auto; display:inline-flex`），从左到右为「置为当前」（当前赛季该按钮仍显示，但置灰 `btn-disabled` 且 `disabled` 不可点击）/「背景」/「编辑」/「删除」`.btn-danger.mini`；「背景」按钮 `catchtap="uploadSeasonPhoto"` 调 `/api/seasons/:id/photo`（与玩家背景图同一套上传逻辑，`utils/upload.js` 的 `uploadSeasonImage`），上传后整卡头部 banner 即显示该图。删除赛季时后端一并清理 `seasons.photo` 旧文件（与玩家头像/背景一致）。
- **赛季列表头部卡（取消「当前赛季」选择器）**：管理页赛季列表顶部为一张 `.card` 头部卡——标题「赛季（N）」与「+ 新建」按钮用 `.row-between.card-head` 同行（`.card-head` 取消 `.row-between` 默认下外边距，使标题与按钮在卡片内垂直居中；`.card-head button` 设 `margin-left:auto` 保证按钮紧贴右侧，标题行高与按钮高度 56rpx 对齐）；表单展开时同在该卡内，无赛季时卡内显示「还没有赛季，点「+ 新建」创建」`.muted` 提示。**不再设置「当前赛季」下拉选择器**：「当前赛季」概念由已有的「当前」机制表达——当前赛季经后端 `ORDER BY pinned DESC` 排在所有赛季首位、卡片右上角显「当前」标签，用户用「置为当前」按钮把某个赛季标记为当前，且全局有且仅 1 个当前赛季（取消置顶已移除，只能点另一个赛季的「置为当前」来顶替）；取代原独立「当前赛季」选择 UI（原 `currentSeasonId`/`currentSeasonIndex`/`onSeasonChange` 已移除，不影响其它页面的赛季过滤器默认判定，那些页仍用 `pickCurrentSeason` 作兜底默认）。
- **赛季编辑/新建表单**：点击赛季卡片底部「编辑」按钮，隐藏 `.season-card__foot` 并展开内联编辑表单 `.season-edit`（顶部 `1rpx` 分割线与展示区分隔），含名称（≤8字）、开始/结束、说明；开始/结束用 `<picker mode="date">` 并**左右并排**在同一 `.form-row.form-row--inline` 内（两个 `.form-field` 各占 50%），其 `.form-label--inline` 统一保持 `min-width:80rpx`、`margin-right:var(--space-md)`、`text-align:left`，与上方「名称」标签左侧对齐，确保四行标签/占位文字整体向左齐平；**结束时间默认填充「当年当月最后一天」**（如 `2026-10-31`，表示「本月赛季」），开始时间留空时显示灰色占位「开始时间」；说明改用 `<textarea class="textarea" auto-height>` 多行输入，最小高度约 140rpx、最大 320rpx，文字/placeholder 左对齐；底部「保存」`.btn-primary.mini` + 「取消」`.btn-ghost.mini`。后端：新建 `createSeason` 与更新 `updateSeason` 均把结束时间默认设为函数 `currentMonthEnd()`（返回当年当月最后一天，格式 `YYYY-MM-DD`），即前端未填或清空保存时都落库为当年当月最后一天；仅当 `status=archived` 且原无结束时间时优先写为归档当天。
- **表单输入长度限制**：赛季名称最多 **8 个字符**（含中文），输入框 `maxlength="8"`、提交前 JS 校验、后端 `str(..., { max: 8 })` 兜底；玩家昵称维持 6 字符。
- **计分页阵营卡 `.camp-card`**：与网页端统一，固定 4 套预设（红队 `#d64545` / 蓝队 `#3b7dd8` / 绿队 `#2f9e63` / 紫队 `#b165d4`）。卡片左侧用 8rpx 实色竖条 + 标题前圆点标识阵营色；默认前两个阵营为红/蓝，新增第三、四个依次为绿/紫。阵营名可编辑，但颜色随位置固定（红/蓝/绿/紫不可被用户改色，避免与网页端不一致）。**删除规则**：① 红队(0)/蓝队(1) 固定不可删除；② 第3、第4 阵营颜色固定（绿/紫），不受删除影响；③ **「删除」按钮只出现在最后一个阵营上**，且必须按 第4 → 第3 依次删除（JS `removeCamp` 守卫：长度≤2 拦截、下标≤1 拦截、下标≠最后一个 拦截），保证红/蓝永远保留、且不会出现「删了第3 却留下第4」的乱序。

---

## 7. 业务场景模板（强语义场景，禁止退化为通用列表）

### 7.1 排行榜（ranking）
强排名语义场景，**禁止**只套 `.list-item` 平铺。
- **结构**：标题卡 + 榜单卡（`.card` 包裹 `wx:for`）；每行 `.list-item.rank-item`。
- **名次徽章 `.rank-no`**：圆形 48rpx，默认灰底次文字；Top3 用奖牌色：
  | 名次 | 类 | 底色 | 字色 |
  |---|---|---|---|
  | 1 | `.rank-no-1` | `--color-medal-gold` | #fff |
  | 2 | `.rank-no-2` | `--color-medal-silver` | `--color-text` |
  | 3 | `.rank-no-3` | `--color-medal-bronze` | #fff |
- **布局（上下两行，前 3 名与第 4 名及以后完全一致）**：第一行 `.rank-top`（徽章 + 姓名 + 阵营占比条，三者水平排列，独占一行）；第二行 `.rank-meta`（8 项属性，占满整行、两端分布，每项竖排「数字在上、标签在下」用 `.meta-item > .meta-val + .meta-label`）：出场、胜场、胜率、出完率、总得分、场均得分、最高得分、MVP。8 项按内容宽度分配空间：`.meta-narrow`（出场/胜场/MVP，flex:5）/ `.meta-mid`（胜率/出完率，flex:6）/ `.meta-wide`（总得分/场均得分/最高得分，flex:8）。当前排序项的 `.meta-active .meta-val` 放大为主色、更醒目，标签不跟随高亮。
- **领奖台（前 3 名）**：`.podium` 容器内每个 `.podium-card` 复用与 `.rank-item` 完全相同的两行布局（`.rank-top` + `.rank-meta`），唯一区别是序号圆标用金银铜（`.rank-no-1/2/3`）；`.podium-card` 自身提供卡片背景（`--color-card` 圆角 + 浅阴影），不再单独展示大号分值（`.podium-score` / `.podium-rank` / `.podium-name` / `.podium-meta` 已移除）。
- 类名落位：`.rank-item / .rank-top / .rank-main / .rank-no(-1/2/3) / .rank-meta`，全部引用 Token，定义在 `pages/leaderboard/leaderboard.wxss`。

### 7.2 玩家资料（player profile）
强身份语义场景，承载头像与背景图「上传 + 查看」入口。
- **结构**：进入方式 = 「我的 → 玩家」列表行点按 `navigateTo` 到 `pages/player/player`；非 tabBar 页。
- **封面 `.profile-cover`**：高度 280rpx，有背景图（`photoUrl`）时铺满，无图时主色浅底；底部渐变遮罩保证文字可读。
- **头像叠加 `.profile-avatar`**：120rpx 圆形、白描边，叠加在封面左下；无图用 `.profile-avatar-ph`（主色底白字首字）。
- **资料卡**：玩家 ID / 签名。
- **图片管理卡**：头像、背景图各一个「更换」`.btn-ghost.mini` 按钮，调用 `utils/upload.uploadPlayerImage(id, kind)`（kind = `avatar` / `photo`），与 Web 端共用 `/api/players/:id/:kind`。
- **「我的 → 玩家」列表结构（参考赛季列表卡片化）**：顶部一个 `.card` 头部卡——标题「玩家（N）」与「+ 新建」按钮用 `.row-between.card-head` 同处一行（与赛季头部卡一致，标题/按钮在卡片内垂直居中、按钮紧贴右侧），新建表单展开也在该卡内；其下每位玩家是独立的 `.card.player-card`，作为头部卡的兄弟节点依次纵向排列（每个玩家卡独占一行），与赛季列表「头部卡 + 多个独立 `.season-card`」结构一致。玩家卡片使用 `.card.player-card` 提升优先级，左右外边距压缩为 `var(--space-sm)`（上下保持 `var(--space-md)`），减少屏幕两侧空白。① 头部 `.player-card__header` 直接以背景图（`photoUrl`）为「头像 + 玩家编号 + 玩家签名」三者的背景——高度固定 `220rpx`、内容垂直居中，确保所有玩家卡背景显示尺寸一致；有图时 `<image class="player-card__header-bg">` 铺满并叠加 `.has-photo::after` 暗色蒙层保证文字可读；无图时渲染 `<view class="player-card__header-pattern">`，复用 Web 端 felt 绿底（`linear-gradient(135deg, #0f5132, #1f7d4d)`）+ 白色半透明点阵（`radial-gradient`），文字、头像占位、签名 tag 统一反白，与 Web 默认玩家卡效果一致。头像（96rpx 圆、白描边 + 轻投影）置于头部内、不再负边距上叠；头部内含 `.player-card__top`（头像 + 名称 + 子信息 `#ID` / 签名 `.tag-soft`）。`.player-card__top` 右侧当 `mvps > 0` 时显示 `.player-card__mvp` 徽章 `🏆*N`（N = 该玩家历史获得 MVP 次数，由 `mine.js` 用 `bootstrap.matches` 汇总 `e.is_mvp` 得到；MVP 数为 0 时不显示）；徽章用 `position: absolute` 绝对定位到头部右上角（`top/right` 各 `var(--space-sm)`）、字号加大（`--font-size-md` + 字重 600）、半透明黑底 + 白字胶囊样式，确保在默认绿底和背景图上均可读且醒目。下方 `.player-card__bio`（**无签名时显示占位「暂无签名」**，保证所有卡片头部高度一致；最多 2 行、超长截断并加省略号，占位态使用更淡字色 + 斜体以区分真实签名）。② 成绩与登记时间移至 `.player-card__body`：`.player-card__body` 内边距为 `var(--space-sm) var(--space-md)`（上下 16rpx、左右 24rpx），成绩行复用 `.season-card__info` 但由 `.player-card__body .season-card__info { padding: 0; }` 覆盖，避免与 body 内边距叠加导致上下留白过大；四列 `.info-item` 展示出场 / 胜局 / 胜率 / 总得分（数据来自 `mine.js` 用 `bootstrap.matches` 客户端汇总，口径与 Web `computePlayerStats` 一致：总得分只算「出完牌」的局）。不再显示「登记于 …」行（`.player-card__meta` 样式已移除），玩家卡 body 仅含成绩行，与赛季卡 body（info + foot）结构对齐、尺寸完全一致。③ 底部 `.player-card__foot`（`flex-end`、`flex-wrap: wrap`、顶部分割线）放「头像」「背景」「编辑」`.btn-ghost.mini` + 「删除」`.btn-danger.mini`；`margin-top: var(--space-sm)`，`padding: var(--space-sm) var(--space-md) var(--space-md)`，保证按钮不贴顶部分割线、底部也不贴卡片边界（均 `catchtap` 防冒泡到卡片点按，卡片整体 `bindtap` → `viewPlayer` 跳详情页）。**删除按钮禁用规则**：玩家有对局记录（`games > 0`，`games` 即该玩家在 `scores` 中的出场次数，与后端 `deletePlayer` 的 `scores WHERE player_id` 判定完全一致）时，删除按钮置灰（`disabled` + `.btn-disabled` 类）不可点；前端 `deletePlayer` 也随之加防御兜底（直接 toast 提示「该玩家已有对局，无法删除」），与赛季卡片「有对局则删按钮置灰」保持同一交互。**编号（ID）显示**：玩家卡头部 `#编号` 显示 `player_code`（后端「玩家 ID」字段，留空时按 `GT-xxx` 自动生成），回退 `item.id`；与编辑字段对应，可经「编辑」修改。**编辑玩家**：卡片底部「编辑」按钮（`catchtap="openEditPlayer"`）点按后隐藏 `.player-card__foot` 并展开内联编辑表单 `.player-edit`（包裹层 `catchtap="noop"` 阻止冒泡到卡片整体 `bindtap` 触发 `viewPlayer`），含「昵称」（≤6字）、「ID」（`player_code`，≤40字、留空不修改）、「签名」（`<textarea class="textarea" auto-height>` 多行、≤300字）三项；底部「保存」`.btn-primary.mini` + 「取消」`.btn-ghost.mini`。保存调 `PUT /api/players/:id`（后端 `updatePlayer`：未传字段保留原值）。

- **玩家新建表单**：展开后采用与赛季新建表单一致的 **`.form-row` 左标签右控件** 布局，左侧固定 `min-width:80rpx` 标签列，右侧输入框占满剩余宽度并左对齐。依次包含：① **昵称**（必填，≤6 字）；② **编号**（可选，`type="number"`、`maxlength="3"`），占位文字「001-999（可选）」，前端校验必须为 `001-999` 的三位数字，提交时自动拼成 `GT-XXX` 作为 `player_code`；留空时后端仍按注册顺序自动生成 `GT-001` 等编号；③ **签名**（可选）。后端 `createPlayer` 校验 `player_code` 符合 `GT-\d{3}` 格式并检查是否已存在，重复则返回错误提示。保存按钮仍使用 `.btn-primary.mini` 置于表单底部。

---

## 8. 导航规范（tabBar 与页内分段导航）
微信 tabBar **硬上限 5 个**；当前已用满 5 个（计分 / 对局 / 高光 / 排名 / 我的），**不得再新增底部 tab**。

- **管理类功能用页内 seg**：「我的」作为管理 hub，内部用 `.seg` 分段导航分为 **玩家 / 赛季 / 设置**，满足"把我的拆成玩家和赛季"的诉求，且不突破 5 个限制。
- **查看类页面走 navigateTo**：玩家资料等详情页注册到 `app.json` 的 `pages`，但**不入 `tabBar`**（微信 tabBar 上限 + 详情页非一级入口）。
- **新增一级入口的判定**：只有当某功能确实是一级、高频、且现有 5 个 tab 无法容纳时，才考虑**合并现有 tab**（如将「高光」并入「对局」腾出位置），再新增；禁止直接堆到第 6 个。
- **查看类页面统一赛季上下文**：对局 / 高光 / 排名三个查看页，以及计分页，顶部统一使用 `.form-row` + 赛季 `picker`。
  - **查看页（对局 / 高光 / 排名）**：赛季下拉最前固定插入「全部赛季」（id=null，表示不过滤）并作为默认选中项，由 `utils/season.js` 的 `withAllSeason(seasons)` 注入；默认展示全部赛季数据，切换真实赛季即按该季过滤。
  - **计分页**：**不下拉「全部赛季」**（无法把一局录进「全部赛季」）——只列真实赛季，默认选中「当前赛季」（优先 `pinned=1`，否则取首个；判定收敛到 `pickCurrentSeason`）。**录入时必须选定一个具体赛季**，`submit` 守卫 `if (!seasonId)` 拦截空赛季并提示「请先选择赛季」。
  - **赛季当前**：「我的 → 赛季」支持标记 1 个「当前」赛季；后端 `pinSeason` 保证全局有且仅 1 个当前赛季（无「取消」操作，只能被另一个赛季顶替）。所有赛季选择器继承后端 `/api/bootstrap` 的排序 `ORDER BY pinned DESC, status ASC, id DESC`，**当前赛季始终排在真实赛季首位**。
  - 当前赛季判定还用于「未关联赛季的高光归属到 active 赛季」等辅助逻辑，统一收敛到 `pickCurrentSeason`。
- 所有导航相关类名（`.seg / .seg-item / .seg-active`）统一在 `app.wxss` 定义，引用 Token。

### 8.1 tabBar 图标（增强切换反馈）
纯文本 tabBar 切换仅靠文字变色，反馈弱；引入线性图标后，图标 + 颜色双信号显著提升辨识度与切换确认感。

- **资源**：统一存放于 `miniprogram/assets/tabbar/`，由脚本（PIL 线性绘制，可复现）生成，双态成对命名 `tab-<name>.png`（灰态）/ `tab-<name>-active.png`（深绿态）。
- **尺寸 / 格式**：81×81px 透明 PNG（微信推荐规格），线性风格，描边宽度统一 5px。
- **双态配色**：灰 `#999999`（与 tabBar `color` 一致）/ 深绿 `#0f5132`（与 `selectedColor` 一致）；选中态图标与文字**同时**变深绿。
- **语义映射（不可随意更改）**：
  | tab | 图标 | 语义 |
  |---|---|---|
  | 计分 | 计分板（圆角框 + 两行记分横线） | 计分记录 |
  | 对局 | 双圆交叠 | 双方面对面 |
  | 高光 | 四角闪光星 | 精彩时刻 |
  | 排名 | 领奖台（中高左右低） | 名次 |
  | 我的 | 人像 | 个人 / 管理 hub |
- **约束**：图标随 tab 增删必须成对新增 / 删除；`iconPath` 与 `selectedIconPath` 必须同时在 `app.json` 配置，禁止只配其一；新增 tab 图标需先满足 §8 的 5 个上限前提。

---

## 9. 本次落地清单（已据本规范统一）

**v1.0 基础规范**：Token 体系、按钮矩阵、字号/圆角/间距收口（见历史记录）。

**v1.1 排行榜场景**：纳入规范 §7.1；新增 `leaderboard.wxss`（名次徽章/Top3 奖牌色/分数突出，全部 Token 化）；`leaderboard.wxml` 由朴素列表升级为「徽章 + 分数突出」结构。

**v1.2 导航与玩家资料（本轮）**
- **规范**：新增 §8 导航规范（tabBar ≤ 5；管理功能用页内 seg；详情页走 navigateTo）；§6 补 `.seg` / `.avatar-ph` 组件；§7 补「7.2 玩家资料」场景模板；设计原则补第 7 条「导航有上限」。
- **导航落地**：「我的」改为管理 hub，页内 `.seg` 分段导航 **玩家 / 赛季 / 设置**（底部 tabBar 仍为 5，未突破上限）。
- **背景图上传补接**：`utils/upload.js` 新增 `uploadPlayerImage(id, kind)`，封装选图+压缩+post 到 `/api/players/:id/avatar|photo`；复用服务端既有 `photo` 字段与路由（Web 端互通）。「我的 → 玩家」每行新增「背景」按钮，玩家资料页新增「更换背景」入口。
- **查看入口**：新增 `pages/player/player`（封面背景图 + 头像叠加 + 资料卡 + 图片管理），`app.json` 注册该页（不入 tabBar）；「我的 → 玩家」列表行点按 `navigateTo` 进入。
- **头像占位**：无头像时用 `.avatar-ph` 首字占位，列表视觉完整。
- 颜色/字号/圆角/间距全部 Token 化，无散写（仅保留禁用灰 `#b9c9c0`、白字 `#fff`、封面遮罩 `rgba`，均为固定合法值）。

**v1.3 导航图标（本轮）**
- **规范**：§8 新增「8.1 tabBar 图标」——双态线性图标、81×81 透明 PNG、灰/深绿双态配色、语义映射表与成对约束；纯文本切换反馈弱的根因被修正。
- **资源生成**：脚本（PIL 线性绘制，可复现）生成 10 张 PNG 至 `assets/tabbar/`（5 图标 × 双态），统一描边 5px、语义映射见 §8.1。
- **挂载**：`app.json` tabBar 每项补 `iconPath` / `selectedIconPath`，切换时图标 + 文字同步变深绿，反馈显著增强。

**v1.4 查看页赛季上下文（本轮）**
- **问题**：对局 / 高光 / 排名三个查看页原本**无赛季选择器**，数据跨季混显；排行榜跨季累加，多赛季后名次失真。
- **规范**：§8 新增「查看类页面统一赛季上下文」——三页顶部统一 `.form-row.head-filters` + 赛季 `picker`，默认「全部赛季」、可切换到任意赛季；`.head-filters` 通过 `margin: 0 var(--space-sm) var(--space-sm); padding: 0 var(--space-md);` 与 `.card` 内容的左右边距对齐，避免选择器行比标题卡更靠左/右；其内部 `.picker-text` 文字**右对齐**，贴近右侧下拉箭头，强化「可下拉选择」的暗示。当前赛季判定收敛到 `utils/season.js` 的 `pickCurrentSeason`（仅用于辅助映射），与「我的」共用；「全部赛季」选项由 `withAllSeason` 统一注入。
- **落地**：`pages/matches`、`pages/highlights`、`pages/leaderboard` 的 `.js/.wxml` 增加赛季选择器与按 `season_id` 过滤；排行榜改为按当前赛季聚合；高光未关联赛季的归属当前赛季以免数据被隐藏。对局行移除冗余的 `season_name`（已按季过滤）。

**v1.5 计分页玩家行 UI 修复（本轮）**
- **问题**：用户截图反馈「添加玩家」区域 UI 异常——首行玩家头顶出现多余横线；「已出完 / 未出完」「MVP / —」像纯文本不像可点切换；新玩家默认 `score: 0` 直接显示 `0`，像报错。
- **规范**：§6 明确 `.list-item` / `.player-row` 分割线统一用 `border-bottom` + `:last-child { border-bottom: none }`，禁止首项顶线；新增 `.chip` 状态胶囊组件规范（字号 sm(24)、`<view>` 承载）与 `.player-actions` 行内右对齐操作区规范。
- **落地**：`app.wxss` 修复 `.player-row` 分割线逻辑，新增 `.chip` / `.chip.active` / `.chip.mvp.active` / `.player-actions`，并将 `.score-input` 改为固定高度 72rpx + line-height 72rpx 防止占位文字截顶；`pages/scoring/scoring.{js,wxml}` 将状态切换改为 `<view class="chip">`、操作区用 `.player-actions` 右对齐、默认得分改为空字符串以显示「得分」占位，并在计算/提交时转换为 `Number`。`scoring.js` 语法校验通过。

**v1.6 赛季行与置顶（本轮）**
- **问题**：用户截图反馈赛季列表「删除」按钮太宽（与玩家行不一致）；赛季名称未做长度限制；需要支持置顶 1 个赛季并在所有选择器里优先显示。
- **规范**：§6 新增 `.season-row / .season-main / .season-actions` 组件规范，要求右侧操作区用 `margin-left:auto`，删除按钮只由内容撑宽；新增「表单输入长度限制」——赛季名称最多 8 字符；§8 明确赛季置顶排序规则（后端 `ORDER BY pinned DESC, status ASC, id DESC`）。
- **落地**：后端 `lib/db.js` 新增 `pinned` 列与 `ensureSeasonPinnedColumn` 迁移；`lib/api.js` 限制赛季名 8 字符并新增 `pinSeason`；`server.js` 注册 `POST /api/seasons/:id/pin`；`app.wxss` 新增 `.season-row` 系列；`pages/mine/mine.{wxml,js}` 赛季行改为 `.season-row` + `.season-actions`（置顶 + 删除），输入框 `maxlength="8"`；所有赛季选择器继承后端排序，置顶赛季自然排在首位。

**v1.7 赛季卡片化（本轮）**
- **问题**：用户要求「信息扩充 + 连续卡片」的赛季列表只改小程序端（网页端还原），并明确排序规则：置顶最上、非置顶按赛季开始时间倒排（最新在前）。
- **规范**：§6 原 `.season-row` 行式规范升级为 `.season-card` 卡片式——每个赛季一张独立卡片，分头部（名称 + 置顶标签 + 状态胶囊）/说明/起止时间/统计（对局数、参赛玩家数）四区；状态用 `.badge`（`.badge-active` 绿、`.badge-archived` 灰）区分，替代旧行式的「· 进行中」文本。
- **落地**：**还原**此前误改的网页端三文件（`public/js/views/seasons.js`、`public/js/api.js`、`public/css/style.css` 经 `git checkout` 回到 HEAD 行式布局）；后端 `lib/api.js` `bootstrap` 排序改为 `ORDER BY pinned DESC, started_on DESC, id DESC`（去掉 `status` 中间档），并为每个 season 附带 `matchCount`（该赛季对局数）与 `playerCount`（该赛季参与对局去重玩家数）；小程序 `pages/mine/mine.{wxml,js}` 赛季列表改为每张独立 `.card.season-card`，新建表单新增「说明」输入（提交传 `note`）；`app.wxss` 新增 `.season-card*` / `.badge*` 系列样式。`lib/api.js` 与 `mine.js` 语法校验通过，wxml 无内联 style。

**v1.8 「置顶」概念升级为「当前」赛季（本轮）**
- **需求**：始终必须有一个「当前」赛季取代原「置顶」；原置顶状态改称「当前」；「置顶」按钮改为「置为当前」；取消「取消置顶」操作，只能点另一个赛季的「置为当前」来顶替；无赛季时无当前赛季，创建第一个赛季时默认即为当前。
- **规范**：后端 `seasons.pinned` 列语义由「置顶」改为「当前」（字段名不变，减少迁移成本）；`pinSeason` 不再支持取消，永远先清空再置本季为当前，保证全局有且仅 1 个当前赛季；`createSeason` 在库内无赛季时自动 `pinned=1`；`deleteSeason` 删除后若已无当前赛季但有剩余赛季，自动把最近的一个（`ORDER BY started_on DESC, id DESC` 取首个）置为当前，维持「始终有当前赛季」。Mini 程序端：当前赛季卡片右上角标签由「置顶」改为「当前」；底部按钮仅对非当前赛季显示「置为当前」（当前赛季不显示该按钮，自然无法取消）；`pinSeason` 注释同步更新。
- **落地**：`lib/api.js` 改 `createSeason`（计算 `isFirst` 写入 `pinned`）、`pinSeason`（移除取消分支）、`deleteSeason`（删除后补全当前赛季）；`miniprogram/pages/mine/mine.wxml` 标签改「当前」、按钮 `wx:if="{{!item.pinned}}"` 显示「置为当前」；`miniprogram/pages/mine/mine.js` 注释更新；同步本规范 §6 赛季卡片、§8 赛季当前描述与 v1.6 标题。`node --check lib/api.js` 通过。

**v1.9 当前赛季按钮置灰 + 取消状态徽章 + 头部标题行居中靠右（本轮）**
- **需求**：已置为「当前」的赛季，底部「置为当前」按钮仍保留显示，但置灰不可点击；取消赛季卡片上的「进行中/已归档」状态徽章显示；「我的」页赛季/玩家头部卡中的「+ 新建」按钮要靠右对齐，且标题与按钮在卡片内垂直居中。
- **规范**：`.season-card__foot` 的「置为当前」按钮**对全部赛季都渲染**（不再 `wx:if` 隐藏），当前赛季（`item.pinned`）追加 `btn-disabled` 类并设置 `disabled` 属性，使其置灰且不可点击；非当前赛季保持可点。`season-card__flags` 仅保留 `.tag`「当前」标签，**移除 `.badge` 状态徽章**（不再显示「进行中/已归档」）。头部卡标题行统一使用 `.row-between.card-head`：取消 `.row-between` 默认下外边距，让标题/按钮在卡片 padding 内垂直居中；`.card-head button` 设 `margin-left:auto` 确保按钮紧贴右侧；`.card-head .title` 行高设为 56rpx，与按钮高度对齐。
- **落地**：`miniprogram/pages/mine/mine.wxml` 删除状态徽章 `<text class="badge ...">`，将「置为当前」按钮改为常显 + `disabled="{{item.pinned}}"` + 当前态 `btn-disabled`；为赛季/玩家头部 `.row-between` 增加 `.card-head` 类。`miniprogram/app.wxss` 新增 `.card-head` / `.card-head .title` / `.card-head button` 样式。同步本规范 §6 赛季卡片描述、§7.2 赛季/玩家头部卡描述。`node --check` 通过。

---

## 10. 后续建议
1. wxml 文字尽量挂语义类（`.title/.name/.muted/.tag`），减少裸 `<text>` 无字号。
2. 新增页面严格按本规范选用类，**禁止新增散写样式**；新一级入口先核 §8 是否突破 5 个 tab。
3. 可封装 nav-bar / empty / load-more 为自定义组件，进一步统一（参考组件库）。
4. 其他强语义场景（如对局卡、高光卡）如需专属视觉，请先在本规范 §7 补模板，再实施。
