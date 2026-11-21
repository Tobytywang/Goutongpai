# 沟通牌小程序 UI 设计规范（Design System）

> 适用：微信原生小程序「沟通牌」（`miniprogram/` 目录）
> 状态：v1.46 · 生效日期 2026-11-21
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
| `--font-size-2xl` | 44rpx | 排行榜当前排序口径的高亮数值（列内放大，排行榜专用刻度） |

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
>
> **flex 容器内的 `<button>` 必须显式修复尺寸**：微信原生 `button` 在 flex 容器里会按块级规则撑满可用宽度，仅清 `min-width` 不够，会把同行左侧文字挤成 0 宽、右侧按钮溢出卡片。统一写法（与 `app.wxss` 中 `.season-card__foot button` / `.player-card__foot button` / `.card-head button` 一致）：
> ```css
> .xxx-actions button {
>   min-width: 0;
>   width: auto;
>   display: inline-flex;   /* 或 .card-head button 用 display:block */
>   align-items: center;
>   justify-content: center;
>   flex: 0 0 auto;
> }
> ```
> 新增任何「左文字 + 右按钮」行时先套这段，否则会复现技能页「名称被挤没、删除溢出」的事故。

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
- **表单行 `.form-row` + 左对齐控件**：标签（`.form-label`）居左、**左对齐**、固定 `min-width:80rpx`，保证不同字数标签的左侧在同一条垂线上；右侧控件（选择器 `.picker-right` / `.picker-value` 或 input）占满剩余宽度，容器左侧也在同一条垂线上。选择器内部值（`.picker-text`）在 `.picker-right` 内**靠右**（贴近右侧箭头），无箭头的只读值框挂 `.picker-value--right` 后同样靠右；表单行内 input 的文字/placeholder 左对齐，箭头（`.picker-arrow`）在最右侧。用于「赛季 / 牌副数」等独立表单项，避免整行文本忽左忽右、标签列不齐；80rpx 按 2 个 28rpx 中文字 + 少量留白计算，既能容纳常见两字标签，又不会让标签与控件之间留白过大。
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
- **表单输入长度限制**：赛季名称最多 **8 个字符**（含中文），输入框 `maxlength="8"`、提交前 JS 校验、后端 `str(..., { max: 8 })` 兜底；玩家昵称维持 6 字符；技能名称最多 **8 个字符**（同赛季口径，后端 `createSkill/updateSkill` 兜底，全局唯一）。
- **计分页顶部表单（`.sticky-header`）**：赛季行以下固定 **三行**，顺序为「日期」独占一行 →「第几局 + 牌副数」平分一行 →「类型」独占一行。① 独占行用 `.form-row` + `.form-label--justify`（96rpx + `margin-right:24rpx`，与赛季行同款），picker 内距沿用全局默认 16/24rpx，**四条灰框左边缘全部对齐**；**禁止**给独占行挂 `.form-label--inline`——它是 `.form-row--inline` 的后代选择器（`app.wxss`），脱离并排行后会退回 `.form-label` 的 80rpx，重现 v1.15 的「日期框左移」。② 唯一并排行挂 `.form-row--half`，两列 `flex:1 1 0%`（卡片内容 670rpx − `gap` 16rpx → 各 327rpx，picker 实得 207rpx），并单独把 `.picker-value` 内距压到 16rpx、`.picker-text` 右距 8rpx；独占行不受这两条覆盖影响。宽度核算：独占行 picker 550rpx ≫「2026-11-09」所需 218rpx；并排行文字区约 175rpx ≫ 两位数局号与单个牌副数。**不改 `app.wxss` 全局两列规则**，mine / matches 的 50% 行不受影响。`.form-row--date-seq`（1.35:1）随日期独占行取消，`.form-row--date-type` 更早移除。
- **「第几局」选项文案**：标签已写明「第几局」，picker 的 `range-key="label"` 只给**纯数字** `1 / 2 / 3 …`（`buildSeqOptions` 生成 `label:String(i)`，`value` 仍为数值 `i`，提交取 `value`），**禁止**再拼「第 N 局」造成语义重复；对局卡信息行的「当日第 N 局」是展示态文案，不在此列。
- **条件技能行 `.player-skill-row`（技能赛专属）**：对局类型为 `skill` 时，在每位玩家的 `.player-row` **下方渲染一个独占整行的兄弟节点**（`<block wx:for>` 包裹玩家行 + 技能行），承载「技能」标签（`.skill-label`，v1.46 起 `flex:0 0 216rpx` + `text-align:right`，与上方玩家 picker 共用同一列、「技能」紧贴技能值区形成「标签 → 值」组合，列右边缘与「选择玩家」块右边缘对齐；`--font-size-sm` 次文字色表示从属信息）+ 技能下拉（`.skill-picker{flex:1;min-width:0}`，内部 `.skill-picker-value` 用 `--color-fill` + `--radius-md` + `16rpx 24rpx` 内距 + `.picker-arrow`）。**禁止把技能下拉塞进玩家单行**——录入页 662rpx / 编辑态 622rpx 的单行余量分别只有 22/74rpx，任何 88/140/216rpx 档都会溢出并被 `.page{overflow-x:clip}` 静默裁切；216rpx 玩家 picker、120~240rpx `.score-input`、88rpx `.chip` 的既有硬约束全部保持不变。分割线规则：技能赛时玩家行的 `border-bottom` 交给技能行统一画（`.has-skill .player-row{border-bottom:none}` + `.player-skill-row` 自带 `border-bottom`），同组内不出现双线；普通赛不渲染该行，玩家行零改动。**三态视觉分级（v1.46）**：① 有技能可选 → 灰底 `.skill-picker-value` 选择块（真实控件）；② 技能被其他玩家选完 → `.skill-hint` 纯文字「技能已选完」，次文字色，**禁止套灰底伪输入框**；③ 技能字典为空 → `.skill-add` 次文字灰虚线框「+ 添加技能」，`catchtap="goSkills"`，用虚线区别于真实输入控件、用灰色与「选择技能」未选态同档，避免在深绿主行里跳色。**① 与 ③ 共用 `.skill-picker-value, .skill-add` 尺寸基准**：`flex:1` 撑满值区 + `16rpx 24rpx` 内距 + `--radius-md` + `--font-size-base`，外框严格同宽同高，只有填充与边框语义不同；`.skill-hint` 是文字提示不套框。全局定义在 `app.wxss`，编辑态仅以 `.match-edit-form .player-skill-row{gap:var(--space-xs)}` 收紧间距。
- **技能唯一性：一人一技能（v1.45）**：技能赛同一局内**每个技能只能被一名玩家选取**，四层防线缺一不可。① 每行技能 picker 的 `range` 不是全量字典，而是该行 `p.availableSkills`（`utils/match-form.js:rebuildAvailableSkills` 按行生成：排除其它行已选技能、保留本行已选以便回显；字典为空时保留历史 skillId 不清值）；无技能可选时用 `wx:elif` 显示 `.skill-hint`「技能已选完」，字典为空才走 `.skill-add`「+ 添加技能」。② `onSkillPick` / `editOnSkillPick` 按行内列表取值，并用 `isSkillTaken` 守卫：过期列表 / 草稿残留选中已占用技能时 toast「技能不能重复选取」并 return，不静默改别人的选择。③ 计分页 `validate` / `submit` 与编辑态 `validateForm` 校验重复与技能数量不足（`需 N 个，现有 M 个`），重复时禁用保存 / toast 拦截；技能字典数量必须 ≥ 已选玩家数。④ 服务端 `lib/api.js:assertUniqueSkills` 在 `createMatch` / `updateMatch` 归一化后拒绝同局重复 `skill_id`，普通赛不受影响（`normalizeSkillId` 一律置空）。**顺序红线**：`buildEditState` 必须先 `withSkillIndex` 再 `rebuildAvailableSkills`——前者写全量字典下标、后者写行内下标，反了会让 picker 的 `value` 错位到别的技能。
- **危险操作确认模态框 `<confirm-modal>`**：所有删除 / 移除类操作（删除对局、删除玩家、删除赛季、移除阵营）**必须先弹应用内模态框二次确认**，禁止点击即删；禁止直接用 `wx.showModal` 系统弹窗（样式不受 §3 Token 约束、只能放一段纯文本，无法承载可核对的详情）。组件在 `components/confirm-modal/`，页面 `.json` 注册 `usingComponents` 后在 wxml 挂 `<confirm-modal id="confirmModal" />`，JS 统一调 `utils/confirm.js` 的 `confirmOn(this, {...})`（返回 `Promise<boolean>`，仅点确认才为 true）。文案三段式：① `title` 用动词开头（删除本局记录 / 删除玩家 / 移除阵营）；② `content` 点名具体对象；③ `details: [{label, value}]` 列出可核对信息（局号 / 时间 / 比分、玩家 ID / 关联对局数、赛季关联数等）；④ `warning` 说明连带影响与「不可恢复」。按钮：取消用灰底 `.cm-btn--cancel`、确认用 `--color-danger` 红底 + 具体动词（删除本局 / 移除阵营），**默认操作必须是取消**——点遮罩、点取消、页面销毁一律按取消处理。遮罩 `z-index:1000` + `catchtouchmove` 防滚动穿透，样式引用 §3 Token 并带 fallback（组件样式隔离下仍生效）。组件未挂载时 `confirmOn` 自动降级到 `wx.showModal`（`fail` 也按取消），保证「删除必确认」不漏；删除请求期间用页面级 `_deleting` 防重复提交。
- **计分页阵营卡 `.camp-card`**：与网页端统一，固定 4 套预设（红队 `#d64545` / 蓝队 `#3b7dd8` / 绿队 `#2f9e63` / 紫队 `#b165d4`）。卡片左侧用 8rpx 实色竖条 + 标题前圆点标识阵营色；默认前两个阵营为红/蓝，新增第三、四个依次为绿/紫。阵营名可编辑，但颜色随位置固定（红/蓝/绿/紫不可被用户改色，避免与网页端不一致）。**删除规则**：① 红队(0)/蓝队(1) 固定不可删除；② 第3、第4 阵营颜色固定（绿/紫），不受删除影响；③ **「删除」按钮只出现在最后一个阵营上**，且必须按 第4 → 第3 依次删除（JS `removeCamp` 守卫：长度≤2 拦截、下标≤1 拦截、下标≠最后一个 拦截），保证红/蓝永远保留、且不会出现「删了第3 却留下第4」的乱序。

---

## 7. 业务场景模板（强语义场景，禁止退化为通用列表）

### 7.1 排行榜（ranking）
强排名语义场景，**禁止**只套 `.list-item` 平铺。
- **结构（v1.44）**：标题卡（`.card.title > .head-row`：左「排行榜」`.title`、右 `.head-season-picker` 赛季选择器）+ 排序卡（`.card.filter-card` 内 `.form-row.sort-row`，排序控件独占整行）+ 榜单卡（`.card` 包裹 `wx:for`）；每行 `.list-item.rank-item`。三个查看页（对局 / 高光 / 排名）标题卡结构完全一致：赛季选择器不再单独占一行、也不再与「排序」并排；排行榜独有的排序下沉到标题卡下方独占一行。
- **名次徽章 `.rank-no`**：圆形 48rpx，默认灰底次文字；Top3 用奖牌色：
  | 名次 | 类 | 底色 | 字色 |
  |---|---|---|---|
  | 1 | `.rank-no-1` | `--color-medal-gold` | #fff |
  | 2 | `.rank-no-2` | `--color-medal-silver` | `--color-text` |
  | 3 | `.rank-no-3` | `--color-medal-bronze` | #fff |
- **布局（上下两行，前 3 名与第 4 名及以后完全一致）**：第一行 `.rank-top`（徽章 + 姓名，未出场者追加「未出场」标签，水平排列，独占一行；不展示阵营占比）；第二行 `.rank-meta`（8 项属性，占满整行、两端分布，每项竖排「数字在上、标签在下」用 `.meta-item > .meta-val + .meta-label`）：出场、胜场、胜率、出完率、总得分、场均得分、最高得分、MVP。8 项按内容宽度分配空间，且必须写全 `flex: n 1 0%`（明确 basis 0，防止被长内容撑开、右侧列溢出屏幕）：`.meta-narrow`（出场/胜场/MVP，4 份）/ `.meta-mid`（胜率/出完率，8 份）/ `.meta-wide`（总得分/场均得分/最高得分，8 份）；`.rank-meta` 另设 `gap: 6rpx` 作为列间最小间距。当前排序项**就在原列内放大**，不另设展示位，且 **v1.34 起不使用任何高亮背景色**：实心浅底（v1.23 的 `--color-primary-light`）、渐变底（v1.32 的 `--gradient-meta-active`）、色块 `::before` 及其外扩规则全部移除，只靠字号 / 字重 / 主色突出——用户明确「不用这个背景色了」，两版历史背景方案均作废、不得恢复。8 列全部 `.meta-val / .meta-label` 仍统一 `position:relative; z-index:1` 作为**防御约定**：若未来恢复任何背景装饰，定位背景默认绘制在 static 文字之上，只抬高亮列会重新盖住邻列「4 / 胜场 / 50% / 出完率」（v1.32 真机截图证实）。数值与标签同染主色、字重 700/600（标签跟随高亮）。**放大后的数字必须「下平面对齐」，不是中线对齐**：56rpx 行盒内不同字号垂直居中会让 44rpx 大数字的可见墨迹底边比 24rpx 小数字低 4.19px（= 8.4rpx，无头 Chrome + canvas 字体度量实测，普通 7 列底边离散仅 0.21px），故 `.meta-active .meta-val` 加 `transform:translateY(-8rpx)`、窄列 34rpx 加 `translateY(-4rpx)`（实测差 2.10px）；transform 不占布局，行高 / 列宽 / 盒高 / 列位置全部不变，**不得**改用「改行高 / 改盒高」的方式做底对齐。数值用 `--font-size-2xl`（44rpx）+ `letter-spacing:-2rpx`，窄列（出场/胜场/MVP，4 份宽）降一档到 `--font-size-lg`（34rpx）兼容三位数出场。**⚠️ 放大必须同时设 `width:auto; max-width:none`**：基础 `.meta-val` 的 `width:100% + text-align:center` 在内容超宽时会整块向右溢出，无头 Chrome 实测（375pt、内容区 670rpx、8 列 52 份 + 6rpx gap）48rpx 的「100%」墨迹宽 65.7px、右溢 17.4px，压到右侧「总得分」数字 4.5px；改成 `width:auto` 后由父级 `align-items:center` 居中、超宽部分左右等量溢出。`display:flex; justify-content:center` 可达同样效果，但依赖 `<text>` 组件的 flex 渲染，故不用。**字号上限 44rpx 的依据**：按 8 个排序口径全量实测（各列取最坏值：出场 128、胜率/出完率 100%、总得分 1250），48rpx 时「胜率」列向左溢出会贴上左侧「胜场」窄列 1.4px；44rpx + `letter-spacing:-2rpx` 后最小余量 3.2px（胜率）、其余口径 ≥5.8px，全部不压字；44rpx 比原 34rpx 大 29%，是安全可用的上限。40rpx 只大 18%，不作为定稿。原「34rpx 上限 / 40rpx 会压字」是未做宽度修正前的保守估算，**已作废**，不得再据此回退字号；当前无背景块，44rpx 数字会略微越出列边界，但仍在实测余量内，**不得**为此改列宽或加回底色。**列宽恒定，不得按高亮项动态加权**——加权会改变总份数，使 8 列在切换排序口径时整体左右漂移（最右列实测可达 14px）。**行高同样恒定**：`.meta-val` 所有列统一固定 `height/line-height: 56rpx`（44rpx 字垂直居中且不被裁切；底对齐靠 transform，不靠改行高）、`.meta-label` 固定 `28rpx`（并设为 block）；因为 `.rank-meta` 是 `align-items: flex-end`，容器高度由「最高的那一列」决定，若数值盒随高亮字号变高、或中文标签与「MVP」拉丁字母默认行高不同，卡片高度就会在切换排序时于三档间跳动；统一提到 56rpx 后任一排序口径下高度都一致。
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

### 7.3 对局卡（match card）
对局列表每张 `.card` 自上而下为**信息行 → 展示内容 → 底部操作栏三段结构**；编辑态在页脚之后**追加第四段「编辑抽屉」**（`pages/matches/matches.wxml` + `pages/matches/matches.wxss`）：
- 第一段 `.match-header`（普通块级，只包 `.match-header-left`，仅保留 `margin-bottom: var(--space-sm)`，**不再用 flex column**）：局号 `.match-id-tag` + 日期（`YYYY-MM-DD`）+「当日第 N 局」+「N 副」+ 技能赛标记 `.match-type-tag`，用 `·` 分隔、`gap: var(--space-xs)`，独占整行 670rpx 内容宽；`flex-wrap: wrap` + `overflow: hidden` 兜底超长数据。7 段信息下 8rpx gap 的最宽组合约 604rpx、余量约 66rpx，**不放宽到 16rpx**（余量仅约 18rpx，真机字体差异会折行）。
- 第二段展示态 `<block>` 的 `.camp-block` **始终渲染**（v1.35 起编辑时不再隐藏）：**同一张卡**编辑时上方信息行 / 比分块 / 分割线 / 操作按钮相对屏幕位置全部不变，只读比分块兼作编辑对照；跨卡切换目标时的重排按下方「编辑抽屉」条 ⑥ 的滚动锚定补偿处理。`.form.season-edit.match-edit-form` 已移到第四段抽屉内，不再与展示块互斥；表单自带**顶部** `border-top`（§6），与页脚线之间隔着按钮行与预览行，不构成双线。
- 第三段 `.match-footer` **只包 `.match-actions`**：`.match-footer { margin-top:var(--space-md); padding-top:var(--space-sm); border-top:1rpx solid var(--color-border) }`。**分割线与上间距只由这一层提供**，`.match-actions` 不再自带 `border-top / padding-top / margin-top`，否则出现双线。展示态它是 `.card` 最后一个子节点；**编辑态其后只允许一个 `.match-edit-drawer`**。两态都保留操作栏（**不同于**「我的」页 `.player-card__foot` / `.season-card__foot` 编辑态隐藏的范式）。**编辑态绝不往页脚里插 `.footer-preview`**——那会把「收起 / 删除」往下推，破坏按钮位置不变。
- **编辑抽屉 `.match-edit-drawer`（v1.35，视觉稳定性；内部顺序 v1.36 调整）**：编辑态挂在 `.match-footer` **之后**，内部为 `.match-edit-drawer__inner` → `.form.season-edit.match-edit-form` + `.footer-preview`（预览 + 保存修改）。**v1.36 起预览 / 保存在表单之后（抽屉最后一项）**，不再放表单上方——用户原话「保存还是要放在最后」；表单在上更合阅读顺序（先改后存），保存按钮落在抽屉底部，与上方「删除」右边缘仍同为 710rpx。① **锚点**：上方所有内容与三颗按钮都不在抽屉内，抽屉高度变化不影响它们的布局位置——展开从按钮**下方向下长**，收起向按钮方向**向上收**，按钮与上方内容全程不动。② **动画**：`max-height` 由 `measureDrawer()` 用 `createSelectorQuery` 实测`.footer-preview` 与 `.match-edit-form` 的**外包络高度**（`Math.max(bottom) - Math.min(top)`，含两块之间的 margin）后以内联 px 给出，`0px → 实测值+8px → none`；配 `transition: max-height 280ms ease, opacity 200ms ease`；`opacity` 与 `__inner` 的 `translateY(-8rpx)→0` 给出方向感。**+8px 余量与收尾置 `none` 都是硬要求（v1.37）**：测量发生时 `__inner` 还带着 `translateY(-8rpx)`（4px CSS），内容整体偏上，若把 `max-height` 精确卡在实测值，**底部的「保存修改」会被裁掉一截**（用户截图实测按钮只渲染 59.5rpx，应为 72rpx，缺 12.5rpx）；展开 280ms 后再把 `max-height` 置 `none`，从此内容怎么长都不会被裁，也不需要反复重量。收起时 `none → 0px` 不可插值，故先落回实测高度、20ms 后再归零，动画不丢。**不得写回 `form.bottom - preview.top`**：v1.36 起保存行在表单下方，那个式子会得到负值、抽屉直接展不开，必须用包络算法（不假设谁上谁下）。**禁止**写死固定大 `max-height`（折叠动画前半段毫无变化），也**禁止**用 `wx:if` 直接销毁节点（没有退出动画）——收起先折叠、300ms 后再清 `editingId`。③ **时序与竞态**：展开先以 `0px` 渲染、隔 30ms 测量后改高度（与折叠共用 `_drawerTimer`，30ms 内点收起会被 `clearTimeout` 取消），`measureDrawer` 回调再用 `_drawerClosing` 守卫；测量失败退回 `max-height:none`，宁可没动画也不能把内容裁成 0 高。④ **内容变高靠「收尾置 `none`」兜住（v1.37，取代 v1.36 的结构指纹重量）**：`max-height` 一旦锁死，增删玩家 / 切技能赛 / 提示行出现都会被裁，而**被裁掉的正是底部唯一的保存入口**。v1.36 用「各阵营人数 + 类型 + 是否有提示行」的指纹触发重量，v1.37 改成展开动画结束后直接 `max-height:none`——内容怎么长都不会裁，也不再需要每改一次结构就查一次选择器（`editSync` 每输入一个字符都会跑）。**不要**再在 `editSync` 里调 `measureDrawer()`：那会把 `max-height` 重新锁成具体值，重新引入裁剪窗口。⑤ **去掉 `scrollToCard`**：原 `openEdit` 会把卡片滚到距顶 12rpx，是点击编辑时上方内容整体位移的根因，抽屉化后不再需要。⑥ **切换编辑目标必须做滚动锚定（v1.38）**：抽屉在页脚之后只保证「**同一张卡**」内部不位移；从已展开的 A 切到 B 时，A 抽屉被 `wx:if` 立即销毁（切换路径不走 `cancelEdit()` 的折叠动画），A 卡片变矮 H，文档流里 B 及之后所有内容上移 H，刚点的按钮也跟着跳——这是**其它卡片高度变化**引起的重排，抽屉结构本身管不了。修法：`openEdit` 判定 `switching = editingId != null`（**仅切换路径**），在 `setData` 前用 `readAnchor(id)` 测「B 卡片顶部 `top` + `scrollTop`」，`setData` 回调里用 `restoreAnchor()` 重测，按 `utils/scroll-anchor.js` 的 `anchoredScrollTop(before, after, scrollTop) = max(0, scrollTop + (after - before))` 做**一次** `wx.pageScrollTo({duration:0})` 补回。用卡片顶部作锚点即可（展示态比分块始终保留，卡片顶部到按钮的距离两态一致），不必给按钮加 id；`#match-{{id}}` 复用现成 id。**同卡展开 / 收起 / 保存 / 删除一律不补偿**；`_anchorSeq` 序号 + `editingId` 双守卫防止异步测量期间又切换或收起导致乱滚，`cancelEdit()` 也要递增序号（它 300ms 后才清 `editingId`，单靠 `editingId` 守卫挡不住）。`duration` 必须显式写 0，默认 300ms 会把补偿变成一段看得见的滚动。**边界**：`scrollTop < H` 时扣不到 0（`scrollTop` 不能为负），按钮仍有 `H - scrollTop` 的残余上移，用 160ms 短过渡摊开；要 100% 固定只能让旧抽屉等高占位不撤（会留一块空白）或把抽屉改成 `absolute` 浮层脱离文档流（牺牲内联展开观感），当前均不采用。⑦ **页面贴底（列表最后一张卡）必须钉住 `scrollTop`（v1.39）**：⑥ 补的是「跨卡重排」，本条补的是「页面总高度变化」。抽屉撑高 / 收回会改变 `pageHeight`，而滚到列表底部时 `scrollTop` 正贴着上限 `pageHeight − 视口高`：变高时系统「自动贴底」把 `scrollTop` 拉上去（**展开跳**），变矮时又夹回新上限（**收起跳**）——两次跳动同源，且随 280ms 动画逐帧发生，补一次不够。做法：`openEdit` **所有路径**（不只 `switching`）都 `readAnchor()`，把点击前的 `scrollTop` 记为 `_pinScrollTop` / `_anchorScrollTop`，钉住窗口 `_pinUntil = Date.now() + 380`（覆盖 30ms 测量 + 280ms 展开动画）；新增 `onPageScroll(e)`（v1.35 曾移除，此处恢复）在窗口内把任何偏离 >1px 的 `scrollTop` 用 `wx.pageScrollTo({duration:0})` 拉回，`pinScroll()` 在「`setData` 完成 / 抽屉高度开始变化 / 动画收尾置 `none`」三个关键帧各主动钉一次。切换路径的 `restoreAnchor()` 要把补偿后的 `target` **同步写回** `_pinScrollTop`（不能继续钉在补偿前的 `s0`）；`raw < 0`（补偿不足走 160ms 过渡）时**禁止钉住**，否则和滚动动画抢位置。`cancelEdit()` 必须解除钉住：用户没滚过时 `scrollTop` 仍等于点击前的值，收起后 `maxScroll` 恰好回落到该值，**不会被夹断、按钮不动**；用户编辑期间滚到更下方时，让 `scrollTop` 随折叠动画逐帧平滑回位即可。**窗口只有 380ms**，过期即解除，用户可自由滚动；代价是这 380ms 内主动滚动会被拉回（很短，且正好是展开动画期间）。`wxml` / `wxss` / 抽屉动画 / 接口零改动。
- `.match-actions` 自身只负责排按钮：`display:flex; justify-content:flex-end; align-items:center; flex-wrap:wrap; gap:var(--space-xs)`，「编辑 / 收起」`.btn-ghost.mini` +「删除」`.btn-danger.mini` 靠右分组；**不写左右 `padding`、不写 `padding-bottom`**——外层 `.card` 已有左右 24rpx 与底部 16rpx 留白，再加会让按钮组相对上方 `.camp-block` 边框盒右缩进 24rpx、卡片底部过空。不复用全局未使用的 `.match-foot`（其 `space-between` 语义不符）。
- 按钮尺寸**不覆盖**，统一继承全局 `.mini`（56rpx / 24rpx / `0 24rpx` / md 圆角，见 §4.2）；6 条 `flex-shrink:0; margin:0; width:auto; display:inline-flex; align-items:center; justify-content:center` 修正必须保留，且**选择器前缀改用 `.match-actions`**（`.match-actions .btn-danger.mini.match-del, .match-actions .btn-ghost.mini.match-edit`）：搬移后按钮不再是 `.match-header` 后代，沿用旧前缀会整块失效、被微信 `button` 默认 min-width 撑宽。`.mini` 的 `min-width:0 !important` 继续生效。
- **技能赛标记**：信息行末尾在 `item.type === 'skill'` 时追加 `.match-type-tag`（主色底白字、`2rpx 10rpx` 内距、`--radius-sm`）；展示态玩家胶囊在技能赛且该玩家有技能时追加 `.player-skill-half`（`--color-fill` 底、次文字色、最多 160rpx 省略号），插在姓名半格与分数半格之间。普通赛两者均不渲染。
- **MVP 玩家金色主题（v1.24）**：展示态按 `p.is_mvp`（bootstrap 的 `scores.is_mvp` → 布尔）识别本局 MVP，**该玩家整颗胶囊改用金色主题，不再使用 `c.color` 阵营色**（红/蓝/绿/紫），其余玩家维持原样。规格：`.player-score.is-mvp` 金棕描边 `#a86a08` + `0 0 0 2rpx rgba(240,180,41,.35)` 外圈；`.player-name-half.is-mvp` 用 `linear-gradient(135deg,#ffe9a8,#f0b429 55%,#d18f13)` + 深棕字 `#4a2e00`（`600` 字重），昵称保持纯文本 `{{p.name}}`、**不加任何角标 / 徽章**（v1.24 曾加星形角标，v1.28 按用户要求移除）；分数半格改浅金底 `#fff8e6` + 深棕字 `#7a4b00`，技能赛的技能半格同步 `#fff3d1`，避免一颗胶囊里夹一段灰底。金色取自 `--color-medal-gold`(#F0B429) 与编辑态 `.chip.mvp.active`(#ff9c00/#fff7e6) 同一色系；**不用白字**——白字在 #F0B429 上对比度不足 2:1、不可读。与「获胜队」🏆 不混淆：奖杯在 `.camp-line` 阵营行、金色在玩家胶囊内，层级不同，两者可同时出现在同一队。
  - **实现约束（易踩坑）**：非 MVP 的姓名半格背景由内联 `style="background-color: {{c.color}}"` 提供，**内联样式优先级高于 WXSS 类**，所以 WXML 必须写成 `style="{{p.is_mvp ? '' : 'background-color: ' + c.color + ';'}}"`：MVP 时不输出内联背景，`.is-mvp` 的渐变才能接管。**不得**改用 `!important` 覆盖，也不得只在 `.is-mvp` 里写 `background-color`（简写与内联底色会混杂）。姓名半格只渲染 `{{p.name}}` 单个文本节点（不加角标、不拆 `<text>` 子节点），避免 WXML 节点间空白字符处理差异；也不额外改 `.player-name-half` 的 `max-width:240rpx` 与字号，避免长昵称把胶囊撑宽。
  - **数据来源**：`lib/api.js` 的 bootstrap 与 `GET /api/matches/:id` 均返回 `players[].is_mvp = !!s.is_mvp`；`pages/matches/matches.js:load()` 展开 `...p` 时原样保留，展示态无需额外字段转换。Web 端对局明细仍用 `.badge--mvp` 徽章标识（既有实现，不在本轮范围），不涉及阵营色胶囊。
- **编辑态可改对局类型**：编辑表单字段顺序固定为「只读说明 → 赛季只读 → 牌副数 / 获胜线只读两列 → 类型 → 不合规提示 → 阵营卡」（提示行位置见下方 v1.30 条）。类型**独占整行** `.form-row` + `picker`（`editOnTypeChange`），放在两个只读字段**下方**（v1.29 用户要求），不得塞进「牌副数 / 获胜线」只读两列变成三列，也不再紧跟赛季行；技能赛时玩家行按 §6「条件技能行」渲染第二行。**编辑态横向基准修正**（`.match-edit-form` 前缀，页面作用域）：外层 `.season-edit` 与嵌套 `.card` 的 padding/margin 双重叠加会把内容区从 622rpx 压到 534rpx 并右移 48rpx，故 `.match-edit-form .card` 用 `margin-left/right: calc(-1 * var(--space-md))` + `padding-left: var(--space-sm)` 抵消；玩家行 `gap` 收紧为 `--space-xs`、picker 固定 180rpx、`.score-input` `min-width:96rpx`，使 3 组控件在 622rpx 内完整放下。这组 180/96rpx 与负 margin 数值**不得回退**，否则横向溢出复发。
- **玩家删除锁定（与计分页同一口径，v1.19）**：编辑态每队**前 `playersPerCamp(阵营数)` 行不可删**——2 个阵营锁前 3 行、3/4 个阵营锁前 2 行。规则唯一来源是 `utils/score.js` 的 `playersPerCamp`，计分页（`scoring.js`）与编辑页共同引用，**两页不得各留一份**（否则漂移成「录入删不掉、编辑能删掉」）。`utils/match-form.js` 的 `applyPlayerLocks(camps)` 按行号写 `p.locked`，在 `buildEditState` 与每次 `editSync`（增删玩家 / 换人 / 改分 / 切类型）后重跑——删除会让后续行前移，不重算就会出现「删掉第 4 行后，原第 5 行仍带着可删态」。WXML 用 `wx:if="{{p.locked}}"` 渲染 `.del.del--placeholder`（`visibility:hidden`、不绑事件），`wx:else` 才是可点的 `.del`；`editRemovePlayer` 内另有 `if (!players[pi] || players[pi].locked) return` 兜底。**不得改用 `display:none`**：那会让该行右侧塌掉一格，玩家行之间的 ✕ 列不再对齐。
  - 现网 8 局是 4 人、每队 2 人（2 队下限 3 人），故编辑态这些对局的 ✕ 全部隐藏、只能改选玩家不能删——这是规则的自然结果，不是缺陷。
- **只读值右对齐（v1.20）**：「牌副数 / 获胜线」这两个只读 `.picker-value` 额外挂 `.picker-value--right`（`app.wxss`：`.picker-value--right .picker-text{text-align:right;margin-right:0}`），让数值与上方「赛季」、下方「类型」的 picker 值落在同一条右边界。默认 `.picker-text` 是左对齐（配合左侧标签），只读框不挂这个类就会贴左，与上下行明显不齐；`margin-right` 必须归零，因为右侧没有箭头需要让位。**得分输入框 `.score-input` 保持居中**（与计分页同一套全局样式）：它是可输入框，空态 placeholder「得分」跟着 text-align 走，右对齐会让占位文字贴边，故不纳入本条。
- **编辑态只读说明（v1.33 起单行，取代 v1.21 的两行制）**：`.edit-lock-tip` 为**单行**文案「正在编辑 #N 局 · 日期/局次/牌副数/赛季等不可修改」，两句之间用 `·` 分隔，**不再**拆 `.edit-lock-tip__line` 子节点。为压进一行，**斜杠两侧不留空格**（`日期/局次/牌副数`）：留空格的版本实测约 615~625rpx，正好顶到 622rpx 内容边界，会在「修改」两字中间折行；去空格后约 580rpx，留 40rpx 余量。左边界**向下方「赛季」标签对齐**（64rpx，即跟随 `.season-edit` 的 24rpx padding，不加负 margin）——与 v1.31 的「⚠️ 提示行对齐 40rpx」是刻意不同的两个基准，见该条。字号 / 行高 / 颜色仍在 `.edit-lock-tip` 上声明。
- **预览行 + 保存（形似计分页，但适配「卡内」语境）**：编辑态在 `.match-edit-drawer` 内、**`.match-edit-form` 之后（抽屉最后一项，v1.36）** 渲染 `.footer-preview`，因此上下间距是「上方分隔」而非「下方留白」：`display:flex; align-items:center; gap:var(--space-sm); margin-top:var(--space-md); padding-top:var(--space-sm); border-top:1rpx solid var(--color-border)`——沿用卡片内每次「动作区起头」的分割线语言（与 `.match-footer` 一致），底部留白交给 `.card` 的 16rpx padding，**不写 `margin-bottom`**。左侧 `.footer-preview-text` 单行文案「牌库总分 400 · 获胜线 200」（与计分页同为 `.muted` 灰字、单数字号，**单个 `text` 节点**不拆子节点，`white-space:nowrap; overflow:hidden; text-overflow:ellipsis`），右侧「保存修改」`.btn-primary.match-save`（**不带 `.mini`**，沿用 72rpx 标准高，`flex-shrink:0; width:auto; margin:0; padding:0 var(--space-md); white-space:nowrap`）；禁用态 `.match-save[disabled]` 灰底 `#e5e5e5` + 深灰字 `#666` + `opacity:1`（不用 `opacity` 压暗，否则文字几乎看不见）。
  - **不照抄计分页的三处**（v1.17 修正；用户原话「不能完全照抄，还是要考虑下上下文」）：① 不再用 `.card` 包裹——那是对局卡内部的**二级卡片**，会带出二级阴影 + 一级 24rpx 左右 padding；② **不用 `align-self:stretch` 纵向撑满**——文案一旦折行就会把按钮顶成高块；③ 不再保留 `.preview-info` / `.title`「本局预览」标题，卡内属重复信息。`width:auto` 必须显式写：微信 `button` 默认块级整行宽，在 flex 行里会挤扁左侧文案。
  - **右边缘对齐是硬判据**：`.footer-preview` 在抽屉内、`.match-actions` 在页脚内，两者都直接占满 `.card` 内容盒 40..710rpx（抽屉与页脚均无左右 padding），故「保存修改」与「删除」右边缘都在 710rpx。若把预览行留在 `.match-edit-form` 内，会被 `.season-edit` 的左右 24rpx padding 再缩一次，右边缘内缩 24rpx（用户截图实测：绿按钮右沿 600px vs 红按钮 620px，按 1px≈1.22rpx 折算恰为 24rpx）。
  - **退出编辑只有一处**：不在预览行放「取消」，统一走页脚「收起」（同调 `cancelEdit()`）；也不在预览行追加「阵营过线」类 `warn`（由下方不合规提示统一承担）。
- **不合规提示（与计分页同一范式，且阻断保存）**：`utils/match-form.js` 的 `validateForm` 返回 `ruleWarnText = hardErrors.concat(constraintWarns).join(' · ')`，页面只渲染一行 `<view wx:if="{{edit.ruleWarnText}}" class="rule-warns"><text class="warn">⚠️ {{edit.ruleWarnText}}</text></view>`（对应 `scoring.wxml:61`）。硬错误在前、记录完整性约束（技能 → 获胜条件 → MVP）在后，顺序与计分页一致。**禁止**再拆成「红字硬错误逐条 + 灰字软提示每条带尾随『；』」两段——那是 v1.16 的旧形态。`.warn` 继承 `--color-danger`；本页**不加** `white-space:nowrap`（计分页是固定短句，编辑态文案会带阵营名与分数），改用 `word-break:break-word` 允许折行。
  - **位置：队伍列表上方（v1.30）**：提示行必须挂在 `.match-edit-form` 内、`wx:for="{{edit.camps}}"` **之前**（对应计分页 `scoring.wxml:58-60` 位于阵营卡列表之前）。它描述的是「整局是否成立」（技能 → 获胜条件 → MVP），属于全局约束，应在用户动手改玩家**之前**就能看到；挂在列表下方会被几屏阵营卡顶出视野，并紧贴页脚分割线。间距交给相邻兄弟的 margin 折叠即可，**不要**给 `.rule-warns` 另加 `margin-bottom`：上方 `.form-row` 的 `margin-bottom:16rpx` 与 `.rule-warns` 的 `margin-top:6rpx` 折叠为 16rpx，下方阵营卡自带 `margin-top:24rpx`。
  - **不合规提示左对齐基准（v1.31，v1.33 收窄适用范围）**：编辑态「不合规提示」`.rule-warns` 的左边界落在**卡片内容盒左边界 40rpx**，与卡头「#N」、阵营卡左边框同一条竖线。它继承 `.season-edit` 的 `padding:24rpx`，默认落在 64rpx，故需 `.match-edit-form > .rule-warns { margin-left: calc(-1 * var(--space-md)) }`。**v1.33 起只对 `.rule-warns` 生效**，`.edit-lock-tip` 已从该选择器移出、回到 64rpx 与「赛季」标签对齐（用户要求，见上条「编辑态只读说明」）——两条文案各自对齐不同基准是有意为之，不要「顺手统一」。**其余元素也不得纳入**：表单字段（赛季 / 牌副数 / 获胜线 / 类型）与阵营卡内文保持 64rpx 不动。必须用**直接子选择器** `>`，否则会波及嵌套层级。
  - **阻断口径（v1.18）**：`canSubmit = hardErrors.length === 0 && constraintWarns.length === 0`，只要提示行非空，「保存修改」就置灰不可点（`.match-edit-drawer button.match-save[disabled]` 灰底 `#e5e5e5` + `#666`，选择器写法与理由见下条 v1.25）。依据：拦下来只是**不改动**，不会破坏已有记录（用户原话「不能保存，但是也不会变更已有的内容」）。
  - **必排除项**：`牌副数 ≥4`、`总人数 ≥6` **不得**纳入编辑态校验——这两条是创建期的结构性事实，牌副数字段只读、人数要凑就得给历史对局塞人。现网 8 局全是 2~3 副 / 4 人，一旦纳入，这 8 局会永久点不动保存，编辑入口直接失效。它们只在计分页（`scoring.js` 的录入校验）生效。
  - **禁用态配色必须与计分页完全一致（v1.25）**：实色 `#e5e5e5` 底 + `#666666` 字 + `opacity:1`，对齐 `scoring.wxss` 的 `.preview-card .btn-primary[disabled]`。**尺寸不要求统一**（编辑页是高 72rpx 的独立按钮、计分页是纵向撑满预览卡），但**颜色必须一致**。选择器必须写成 `.match-edit-drawer button.match-save[disabled]`（祖先类 + 元素 + 类 + 属性，特异性 `(0,3,1)`）：只写 `.match-save[disabled]`（`(0,2,0)`）会被微信 `button` 组件内置的 `button[disabled]` 系列样式压过，真机渲染成 WeUI 的 `#fafafa` 底 + `#969799` 字，与计分页明显不同。**这两条都是回归红线**：去掉祖先 `.match-edit-drawer`、去掉 `button` 元素名、或删掉 `opacity:1`，禁用色都会退回原生灰（v1.35 只是把祖先类从 `.match-footer` 换成抽屉，特异性 `(0,3,1)` 不变）。
  - **表单底部与页脚之间只保留一份间距（v1.26）**：`.season-edit` 自带 `padding-bottom:24rpx`，`.match-footer` 又有 `margin-top:24rpx`，两个独立来源叠加会让「不合规提示」行到分割线出现 48rpx 空白（截图实测 45px @375pt），视觉上像一段没有用途的空档。分割线本身已承担分隔职责，故编辑态用 `.match-edit-form { padding-bottom:0 }` 归零，只保留页脚那 24rpx。**禁止**改成同时削减 `.match-footer` 的 `margin-top`——那会让展示态（`.camp-block` 与页脚之间）失去应有留白，而展示态并不受这条规则影响。**v1.35 注**：抽屉化后表单位于页脚**之后**，两者不再相邻，v1.26 的「间距叠加」前提已消失；但 `padding-bottom:0` 仍保留——抽屉高度按内容实测，多一层内边距会在卡片底部留下无用空白。
- 编辑态「编辑」→「收起」与「删除」同行不变，**页脚自身结构两态完全一致、位置固定**（编辑态只是其后多一个抽屉，不再是卡片最后一个子节点）。v1.35 起「保存修改」随预览行挂在抽屉内，表单内的「取消」`.row-between.edit-actions` 自 v1.16 起已整块移除，退出编辑统一走页脚「收起」（同调 `cancelEdit()`），避免同一张卡出现两处等价的取消入口。卡片 `id="match-{{id}}"` 保留（v1.38 起兼作滚动锚点）；`scrollToCard` 随 v1.35 移除，`onPageScroll` 也一度移除、**v1.39 为贴底钉住恢复**；`openEdit` **同卡展开时**不主动把卡片滚到顶部，但按 ⑥ / ⑦ 允许 `duration:0` 的锚定补偿与钉住滚动。
- **验收判据**：① 展示态 `.match-footer` 是 `.card` 最后一个子节点、下方只剩 16rpx 留白；编辑态其后**恰一个** `.match-edit-drawer`，页脚内只有 `.match-actions`；② 全卡展示态只有页脚 1 条 `border-top`，编辑态另有表单顶部 1 条，二者被按钮行与预览行隔开、**不相邻**（页脚内部不得再出现第二条线）；③「保存修改」（抽屉内）与「删除」「收起」（页脚内）右边缘与内容区右边界 710rpx 对齐、且彼此严格对齐（编辑态实测差值 0rpx），不与 `.camp-block` 产生 24rpx 内缩；④ 信息行「#N / 日期 / 当日第 N 局 / N 副 / 技能赛」在 375pt 最宽组合下仍单行；⑤ 预览行文案在常规数据下**单行**（不折行、不把保存按钮顶高）；⑥ 提示行非空时「保存修改」为灰色禁用态、点不动，提示清空后恢复主色可点；⑦ **展开 / 收起全过程**：信息行、比分块、分割线与三颗按钮的屏幕位置不变，编辑内容向下展开 / 向上折叠有 280ms 过渡，收起后 `wx:if` 节点才销毁；**同卡展开 / 收起时 `scrollTop` 完全不变**（v1.35 判据），**切换编辑目标时允许且仅允许一次 `duration:0` 的 `pageScrollTo` 补偿**（v1.38，见 ⑥），补偿后刚点的按钮屏幕位置不变；⑧ **页面贴底（列表最后一张卡）展开 / 收起**：按钮与上方内容屏幕位置不变，`scrollTop` 在展开窗口内保持点击前的值，收起时不得出现夹断回落造成的二次跳动（v1.39，见 ⑦）。

---

## 8. 导航规范（tabBar 与页内分段导航）
微信 tabBar **硬上限 5 个**；当前已用满 5 个（计分 / 对局 / 高光 / 排名 / 我的），**不得再新增底部 tab**。

- **管理类功能用页内 seg**：「我的」作为管理 hub，内部用 `.seg` 分段导航分为 **玩家 / 赛季 / 设置**，满足"把我的拆成玩家和赛季"的诉求，且不突破 5 个限制。「设置」分段只放**入口行**（`.card.muted.row-between.settings-row`：技能 / 关于沟通牌 / 隐私政策），不承载具体维护表单。
- **二级管理页走 navigateTo**：字段或列表多到内联卡片放不下的维护功能（技能字典 `pages/skills`），注册到 `app.json` 的 `pages` 但**不入 `tabBar`**，由「我的 → 设置」的入口行 `navigateTo` 进入；页面内自成闭环（新建 / 改名 / 删除 + `<confirm-modal>`），返回时上游页面按需刷新字典，不新增 tab。
  - **编辑态走「展示行下方缩进展开」**：展示行常驻不动，编辑表单作为其下方兄弟节点缩进展开，**仅用左侧 `3rpx` 主色浅竖线 + 缩进标明从属，不加底色、不加「正在编辑」提示**（v1.43：浅绿底与白卡割裂不和谐；上方展示行本身就是名字，提示重复且占高）；「编辑 / 收起」按钮位置固定（只换文案），不整行替换、不丢上下文（v1.40 建立，同构于计分台技能行）。
  - **单字段表单按钮收进输入行**：`名称 [输入框] [保存]` 同排，`input{flex:1}`、**按钮必须用固定宽度槽位包裹**（`<view class="btn-slot">{flex:0 0 120rpx}</view>` 内层 button `display:block;width:100%;padding:0;margin:0`）；编辑行的「取消 / 保存」同样收进同一行。间距按「标题→表单 24rpx / 表单内部 16rpx / 表单→脚注 24rpx + 分隔线」分层；脚注左右与卡片内容区对齐、**不缩进**，`text-align:justify` 两端对齐，分隔线横跨整行（v1.40 建立、v1.42 由缩进改为两端对齐）。
  - **禁止直接给 flex 行内的微信 `<button>` 写固定宽度**：截图实测 `width:120rpx + flex:0 0 auto + display:inline-flex` 会被 button 的默认样式 + `.mini` 的 `padding:0 24rpx` 撑到内容宽（约 200rpx+），把 input 挤成竖条、按钮溢出卡片。统一解法是外层 `.btn-slot` 锁 `flex:0 0 120rpx`、内层 button 铺满槽位（v1.41，与 §4.2「flex 容器内 button 必须显式修尺寸」同源，但固定宽度场景必须用槽位而非 `width:auto`）。
- **查看类页面走 navigateTo**：玩家资料等详情页注册到 `app.json` 的 `pages`，但**不入 `tabBar`**（微信 tabBar 上限 + 详情页非一级入口）。
- **例外：已有列表项的轻量编辑走卡片内联展开**（如对局「编辑」按钮），用 `editingId` 控制展示态/表单态切换，不新增页面、不占 tabBar；仅当表单字段多到需要独立页面时才用 `navigateTo`。
- **新增一级入口的判定**：只有当某功能确实是一级、高频、且现有 5 个 tab 无法容纳时，才考虑**合并现有 tab**（如将「高光」并入「对局」腾出位置），再新增；禁止直接堆到第 6 个。
- **查看类页面统一赛季上下文（v1.44 起）**：对局 / 高光 / 排名三个查看页顶部统一为**标题卡内一行** `.head-row`——左侧页面标题 `.title`（`flex:0 1 auto`，超长省略号），右侧 `.head-season-picker`（`flex:0 1 320rpx`，约占 670rpx 内容区的右半行；`.picker-value` 用 `min-height:56rpx` + `var(--space-xs) var(--space-sm)` 紧凑内距，值 `text-align:right` 贴箭头）。赛季选择器**不再**单独占 `.form-row` 筛选行、也**不再**与「排序」并排，标题卡右侧不再放不可点的 `scopeLabel` 灰字。排行榜独有的「排序」在标题卡下方的 `.card.filter-card` 内**独占一整行**（`.form-row.sort-row`：「排序」标签 + `.picker-right` 通栏，`margin-bottom:0` 避免卡片底部多余留白；筛选卡不带 `wx:if`，排序与赛季无关须常显）。计分页仍沿用 `.form-row` + 赛季 `picker`（录入场景不变）。
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

**v1.10 删除类操作统一二次确认模态框（本轮）**
- **需求**：删除对局、删除玩家等危险操作都需要模态框二次确认。
- **问题**：原 4 处删除走 `wx.showModal` 原生系统弹窗（样式与 §3 Token 脱节、只能放一段纯文本，无法展示局号 / 比分 / 连带影响），计分台「删除阵营」完全无确认、误触即丢已录分数；Web 端已有 `confirmDialog` 自定义模态框，两端交互不一致。
- **规范**：§6 新增 `<confirm-modal>` 组件规范（三段式文案、取消为默认、危险色确认、遮罩防穿透、原生兜底）。
- **落地**：新增 `components/confirm-modal/`（js / wxml / wxss / json）与 `utils/confirm.js`；`matches` / `mine` / `player` / `scoring` 四页注册并挂载组件；`deleteMatch`、`mine.deletePlayer`、`mine.deleteSeason`、`player.deletePlayer`、`removeCamp` 全部改走 `confirmOn`，补上对象详情与连带影响文案，并用 `_deleting` 防重复提交。`node --check` 6 个 JS、`JSON.parse` 5 个 JSON 全部通过。Web 端 `forms.js` 的 `confirmDelete*` 已有同类模态框，本次不改。

**v1.11 对局卡头部操作行独立成行（本轮）**
- **问题**：截图反馈卡片头部「编辑 / 删除」偏小；原样式把 3 个头部按钮硬编码为 48rpx / 22rpx / `0 12rpx`，同时违反 §2-4（最小可点 56rpx）、§3.2（禁止 22rpx）、§4.2（`.mini` = 56/24/`0 24rpx`）。按钮放大到规范尺寸后按钮组变宽 28px，而上一轮为保单行只剩 17.4px / 4.4px 余量，中长局号必然换行。
- **规范**：按 §10-4 在 §7 补「7.3 对局卡」模板；头部改两行——信息行独占整行、操作行靠右，按钮尺寸回归全局 `.mini`。
- **落地**：仅 `miniprogram/pages/matches/matches.wxss`（页面作用域）：`.match-header` 改 `flex-direction:column; align-items:stretch`，`.match-actions` 改右对齐，删去 4 条硬编码尺寸（保留 6 条宽度自适应修正）；`matches.wxml` 零改动。全仓其余 24 个 `.mini` 按钮、`app.wxss` 全局 `.mini` 均不动。验证：CSS 花括号配对、`git diff --check`、`npm test` 9 例、无头 Chrome 按 rpx 量化三组数据 × 375/320/414pt。

**v1.12 对局类型（普通赛 / 技能赛）+ 技能门控 + 设置页技能维护（本轮）**
- **需求**：计分录入增加「对局类型」选项（放在日期旁，普通赛 / 技能赛），只有技能赛才录入每位玩家的技能；编辑界面可改对局类型；技能列表在「我的 → 设置」维护；服务端全闭环（字典入库、选中值入库、编辑态回填、Web 端展示）。
- **空间结论**：玩家单行放不下技能下拉（录入页余量 22rpx、编辑态 74rpx，任何档位都溢出且被 `.page{overflow-x:clip}` 静默裁切）→ 采用**条件渲染的第二行**独占整行；日期 + 类型并排采用 60/40 局部变体（严格 50/50 时日期 picker 203rpx < 需求 228~242rpx，纯 60/40 时类型列 138.4rpx < 需求 172rpx，须局部压缩内距 / label 才成立）。
- **规范**：§6 新增「`.form-row--date-type` 两列并排局部变体」与「条件技能行 `.player-skill-row`」两条；§7.3 对局卡补技能赛标记（`.match-type-tag` / `.player-skill-half`）与「编辑态可改对局类型 + 编辑态横向基准修正登记」（v1.11 漏登的 `.match-edit-form` 180/96rpx 与负 margin 修正一并补录）；§8 补「设置」分段承载技能字典维护；技能名长度限制并入 §6 长度限制条目。
- **落地**：数据层 `lib/db.js` 新增 `skills` 表、`matches.type`、`scores.skill_id` 及幂等迁移；服务端 `lib/api.js` 新增技能 CRUD + `usageCount` 下发、`createMatch/updateMatch` 支持 `type` 与 `skill_id`，**普通赛强制 `skill_id=null`（服务端硬门控，绕过 `wx:if` 也无效）**，`server.js` 注册 4 条 `/api/skills` 路由；`miniprogram/pages/mine` 新增技能维护卡片；`miniprogram/pages/scoring` 日期 + 类型并排行、条件技能行、草稿兼容（旧草稿按 normal 恢复）、技能赛全员必填校验、切回普通赛 `confirmOn` 二次确认 + 三字段一起清空；`miniprogram/pages/matches` + `utils/match-form.js` 编辑态可改类型 / 技能回填 / 校验与提交同口径；`app.wxss` 新增 `.player-skill-row` 系列全局样式；Web 端 `views/matches.js` 技能赛 badge + 玩家技能展示、`views/scoring.js` 草稿带 `type`（保持 `WEB_READONLY`）。`scripts/smoke.js` 补 27 项断言（技能 CRUD、类型 POST→GET→PUT 往返、普通赛忽略技能、编辑改类型回填 / 切回清空、被引用禁删），共 56 项全过；`node --check` 10 个改动 JS 全过。

**v1.13 对局卡操作栏移至卡片最底部（本轮）**
- **问题**：v1.11 把操作行放在头部第二行（信息行下方、阵营块上方），用户反馈「很丑，夹在中间不伦不类」，要求移到卡片最下方；并明确编辑态也要保留底部操作栏、底部与上方内容之间加一条细分割线。
- **规范**：§7.3 由「头部两行」重写为「信息行 / 内容区 / 底部操作栏」三段结构，操作栏借鉴「我的」页 foot 的 `border-top:1rpx` + `flex-end` + `flex-wrap`，但**不复用全局未使用的 `.match-foot`**（其 `space-between` 语义不符）；保留页面独占的 `.match-actions` 类名在 `matches.wxss` 内重写；6 条按钮自适应修正的选择器前缀由 `.match-header` 改为 `.match-actions`。信息行 `gap` 保持 `--space-xs`（技能赛标记加入后放宽到 --space-sm 余量仅约 18rpx，真机易折行）。
- **落地**：`matches.wxml` 把 `.match-actions` 整块从 `.match-header` 内搬到卡片末尾（编辑表单 `</view>` 之后、卡片 `</view>` 之前），`wx:if/wx:else` 相邻关系与全部 class / `catchtap` / `data-id` 逐字不变，净增删 5/5 行；`matches.wxss` 改 4 个规则块（`.match-header` 退回块级、`.match-actions` 页脚化、6 条修正换前缀，`.match-header-left` 不动）并重写 3 条失效注释；本文件同步 §7.3 / 版本号 / 本记录。`matches.js` / `matches.json` / `app.wxss` / README / 测试均不改。
- **验证**：限定路径 `git diff --numstat` 与基线对比、`git diff --check`、WXML 标签栈与 `wx:else` 相邻性自检、CSS 花括号配对、`npm test` 9 例、无头 Chrome 按 rpx 量化信息行余量 / 页脚边线 / 两排按钮间距 × 375/320/414pt、微信开发者工具手工走查两态按钮与分割线条数。卡片净增高 25rpx（12.5px @375pt），两态一致。

**v1.14 技能维护从设置页内联卡片改为独立二级页（本轮）**
- **需求**：技能列表不再以卡片形式内联在「我的 → 设置」，改为一个**入口按钮行**，点进去才是完整页面。
- **规范**：§8 的「设置」分段由「承载技能维护卡片」改为「承载技能入口行」——`我的 → 设置` 只保留 `.card.muted.row-between.settings-row`（左「技能」、右「N 个 ›」），点击 `wx.navigateTo` 进入 **`pages/skills/skills`**（二级页，不进 tabBar，5 个 tab 限制不变）。独立页结构：① 顶部 `.card` 放标题「技能（N）」+ **常驻**的名称输入与「保存」按钮（不设折叠开关，与计分台表单一致）+ 顶部分隔线下的灰字说明；② 列表 `.card` 内每行 `.skill-row`（名称 + `· N 条引用` + 编辑 / 删除）。`.skill-row / __main / __usage / __actions / -edit / -empty / -tip` 全部随页面迁移到 `pages/skills/skills.wxss`，`mine.wxss` 只保留 `.settings-meta`（原 `.about-meta` 更名，供「技能」「关于沟通牌」两行共用）与 `.card.settings-row`。
- **顺带的空态可达性**：技能字典为空时，计分页与编辑态的 `.skill-picker-empty` 由纯文案「请先到「我的 → 设置」添加技能」改为**可点的「还没有技能，点此添加」**（`catchtap="goSkills"` 直达 `pages/skills`）；编辑态返回时只 `syncSkills()`（`getBootstrap(true)` → `withSkillIndex` → `editSync`），**不重刷列表**，避免未保存的比分被冲掉（`onShow` 里用 `_skillsDirty` 标记分流）。
- **落地**：新增 `miniprogram/pages/skills/{skills.js,json,wxml,wxss}`；`app.json` 注册页面；`mine.{wxml,js,wxss}` 删掉整套技能 CRUD 与样式（`mine.js` 仅留 `skills` 数量与 `goSkills`）；`scoring.{wxml,js}`、`matches.{wxml,js}` 增加 `goSkills` 与可点空态；`match-form.js` 的 `softWarns` 文案改为「请先添加技能」，`scoring.js` 兜底 toast 改为「请先添加技能（我的 → 设置 → 技能）」；`lib/db.js` / `server.js` 注释、`README.md`、`scripts/smoke.js` 注释同步路径。技能页取数走轻量的 `GET /api/skills`（自带 `usageCount`），不拉整份 bootstrap。
- **技能行必须看得出是下拉**：`.skill-picker-value` 与 `.input` 原本共用「灰底 + 圆角 + 无边框」，右侧空心 `▾` 仅 24rpx，视觉上等同输入框。改为：① 未选时文案走 `.skill-picker-text--empty`（`--color-text-secondary`），与「已填内容」区分；② 箭头换实心 `▼` 并由 `.skill-picker-caret` 控到 20rpx + `margin-left:16rpx`，形成明确的下拉标志；③ 加 `hover-class="skill-picker-value--hover"`（`opacity:.75`）给出按下反馈。输入框不会在右侧放实心三角，这是最低侵入的区分手段，不新增颜色、不改 `.picker-value` 全局样式。
- **表单常驻**：新建技能表单去掉 `+ 新建 / - 收起` 折叠开关（`showForm` / `toggleForm` 一并移除），名称输入与「保存」始终显示，与计分台表单一致；灰字说明由页尾移入「技能（N）」卡片内，用 `border-top` 与表单分隔。保存按钮包一层 `.skill-form-actions`（`flex + justify-content:flex-end`），固定 `width:140rpx` 并清掉微信 button 自带的 `margin-right:auto`，避免块级撑满整行。
- **验证**：`node --check` 8 个 JS、`JSON.parse` 3 个 JSON、四个 wxml 的 `view/block` 标签闭合自检、`npm test` 9 例、`npm run smoke` 56 项；残留引用（`toggleSkillForm / showSkillForm / openEditSkill / about-meta / skill-manage`）全仓零命中。

**v1.15 计分页顶部表单四列对齐 + 字段换位（本轮）**
- **问题**：截图反馈日期框左边缘比赛季框左移。根因是日期行 label 被局部压到 `80rpx + space-sm`（赛季行是 `96rpx + space-md`），差 24rpx；同时两行的第二列起点也不同（日期行 1.35:1、牌副数行 1:1）。
- **规范**：§6 对应条目由「`.form-row--date-type` 局部变体」重写为「计分页顶部两行并排表单」——两行共用 `.sticky-header .form-row--inline`：`gap:space-sm`、两列 `1.35 : 1`、`.picker-value` 内距 `16rpx`、`.picker-text` 右距 `8rpx`，四列框左边缘落在 144rpx / 535.7rpx 两条竖线上；字段顺序调整为「日期 + 第几局」「牌副数 + 类型」，日期列保住 1.35 份额（picker 实得 255rpx ≥ 218rpx）。`.form-row--date-type` 类与全部专属样式移除。
- **落地**：`pages/scoring/scoring.wxml` 交换「第几局」「类型」两个 `.form-field` 块的位置、删掉 `form-row--date-type` 类并更新注释；`pages/scoring/scoring.wxss` 删除 `.sticky-header .form-row--date-type` 的 gap / label 覆盖，改由 `.sticky-header .form-row--inline` 统一控制。`app.wxss` 与其它页面零改动。
- **验证**：CSS 花括号 29/29 配对、wxml 字段顺序目检、宽度核算（内容 670rpx → 第一列 375.7 / 第二列 278.3；第二列文字区 126.3rpx ≥「技能赛」112rpx、「第 12 局」115rpx）。

**v1.16 编辑表单预览卡与保存区复用计分页范式（本轮）**
- **问题**：编辑态末尾是「一张只有标题的空预览卡」+「另起一排 取消 / 保存修改」，两个 `.mini` 按钮因微信默认宽度被撑成各半行，与计分页「预览卡内右侧撑满的保存按钮」完全不像，观感散、重复。
- **规范**：§7.3 新增「本局预览卡（复用计分页范式）」条；第二段描述改为「表单末尾是一张内嵌保存按钮的预览卡」；「编辑态操作」条改为表单区只保留预览卡内的「保存修改」，退出编辑统一走底部「收起」。预览卡结构、按钮撑满规则、禁用态灰底与 §7 计分页一致，两页互为镜像。
- **落地**：`matches.wxml` 把 `.card.preview-card` 与 `.row-between.edit-actions` 合并为单卡——卡内新增 `.btn-primary`「保存修改」（去 `.mini`，保留 `loading/disabled/catchtap="submitEdit"` 绑定），删除「取消」按钮与卡内 `edit.result.unresolved` 那行 `warn`（与上方 `softWarns` 重复）。`matches.wxss` 为 `.preview-card` 补 `.preview-card .btn-primary`（`flex-shrink:0; align-self:stretch; height:auto; padding:0 24rpx; white-space:nowrap`）与 `[disabled]`（`#e5e5e5`/`#666`/`opacity:1`），并删除失效的 `.edit-actions` 两段死代码、改写「编辑态专属」注释。`matches.js`（`cancelEdit` 仍由「收起」调用）、`matches.json`、`app.wxss`、`scoring.*`、README、测试均不改。
- **验证**：WXML 标签栈闭合、`.preview-card` 内恰 1 个 `button`、`.edit-actions` 与 `edit.result.unresolved` 全仓零残留、CSS 花括号配对、限定路径 `git diff --numstat`、`git diff --check`、`npm test` 9 例、无头 Chrome 按 rpx 量化按钮右边缘 343px 与纵向撑满。表单区净矮约 96rpx（48px @375pt）。

**v1.17 页脚化预览行 + 不合规提示统一为「⚠️ 单行」（本轮）**
- **问题**（用户反馈三条）：① v1.16 的预览卡是**卡中卡**，「不能完全照抄计分页，要考虑下上下文」；② 保存按钮右边缘与「删除」右边缘**没对齐**（实测 600px vs 620px ≈ 24rpx 内缩），看着别扭；③「牌库总分 400 · 获胜线 200」被压成两行，把纵向撑满的按钮**顶成一个高块**。另加一条：不合规提示是「红字硬错误逐条 + 灰字软提示每条带尾随『；』」，与计分页的单行 `⚠️ …` 风格不一致。
- **规范**：§7.3 第三段由 `.match-actions` 改为 `.match-footer` 容器（**分割线/上间距只归它管**），`.match-actions` 退回纯排按钮；「本局预览卡」条整条替换为「页脚预览行」+ 三条子规则（不照抄计分页的三处、右边缘对齐硬判据、退出编辑只有一处）；新增「不合规提示（与计分页同一范式）」条；验收判据补「三颗按钮右边缘彼此严格对齐」与「预览文案单行」。
- **落地**：`matches.wxml` 把预览区从 `.match-edit-form` 内移出、改用 `.match-footer > .footer-preview + .match-actions`；预览文案保持**单个 `text` 节点**（不拆成「标签 + 数字」子节点，规避 WXML 对节点间空白的处理差异，也天然单行）；两段提示（`hardErrors` 循环 + `softWarns` 循环）合并为一行 `.rule-warns`。`matches.wxss` 新增 `.match-footer / .footer-preview / .footer-preview-text / .match-save`，`.match-actions` 去掉 `border-top / padding-top / margin-top`，删除 `.preview-card / .preview-info / .preview-card .btn-primary` 与失效的 `.form-tip`，`.rule-warns .warn` 改 `margin-top:0; line-height:1.5; word-break:break-word`。`utils/match-form.js` 的 `validateForm` 增返 `ruleWarnText`（`hardErrors.concat(softWarns).join(' · ')`），并把 `entryConstraintWarns` 的输出顺序调成「获胜条件 → MVP」与计分页一致；`matches.js` 的 `editSync` 透传 `ruleWarnText`。`scoring.*`、`app.wxss`、接口与测试用例不改。
- **验证**：31 个 wxml/wxss/json 结构检查全过（标签栈、CSS 花括号、JSON 可解析）；`npm test` 9/9；`validateForm` 实测输出 `至少 6 名玩家才能录入（当前 4 名） · 获胜条件不满足 · MVP 未设置`（顺序与计分页一致）；`.preview-card / .preview-info` 在 `pages/matches` 零残留。
- **注**：真机右边缘对齐需在微信开发者工具复看——推理值 710rpx 由 `.card`(16rpx margin + 24rpx padding) 与 `.match-footer` 无左右 padding 共同确定；本轮未跑无头 Chrome 复核（用户在真机侧复看更快）。

**v1.18 不合规提示改为阻断保存（保持灰色禁用态）**
- **问题**：v1.17 把提示做成 ⚠️ 单行后，这些约束仍只是提示——按钮照旧绿色可点，「获胜条件不满足 / MVP 未设置」形同虚设。用户要求「还是要置为灰色，不能保存，尽管不能保存，但是也不会变更已有的内容」。
- **规范**：§7.3「不合规提示」条补两条子规则——**阻断口径**（`canSubmit` 同时清空 `hardErrors` 与 `constraintWarns`；提示非空即按钮灰）与**必排除项**（`牌副数 ≥4` / `总人数 ≥6` 不得进编辑态校验，否则历史对局永久不可保存）；验收判据补第 ⑥ 条。
- **落地**：`utils/match-form.js` 的 `validateForm` 把 `softWarns` 更名 `constraintWarns`，删除 `deckCount < 4` / `allIds.length < 6` 两条（连同其软提示定位），`canSubmit` 改为 `hardErrors.length === 0 && constraintWarns.length === 0`；`matches.js` 的 `editSync` 同步改字段名。`matches.wxml/wxss`、按钮禁用态样式（`.match-save[disabled]` 已是 `#e5e5e5`/`#666`）无需改动，`scoring.*` 不受影响。
- **数据依据**：查现网库 `data/goutongpai.db`，8 局全部为 2~3 副 / 4 人 / 0 MVP——若把牌副数与人数也纳入阻断，这 8 局会永久点不动保存（牌副数在编辑态是只读字段），编辑入口等于报废。故只阻断**编辑态可修**的项（技能 / 获胜条件 / MVP）。
- **验证**：`validateForm` 四组断言——4人2副/0MVP → `canSubmit=false`，文案「获胜条件不满足 · MVP 未设置」；补 MVP → 仍 false（只剩获胜条件）；MVP + 一方全员出完 → `true` 且无提示；分数超牌库 → 仍被硬错误拦住。`npm test` 9/9。

**v1.19 玩家删除按钮锁定规则与计分页同源**
- **问题**：计分页的新建录入按「前 N 行不可删」锁定（`playersPerCamp`），编辑页的 ✕ 却无条件可点——同一局数据在两页的删除权限不一致，编辑态可以把阵营人数删到开局下限以下（只靠保存前的硬校验兜着，且现网历史数据本来就不满足该下限）。
- **规范**：§7.3 新增「玩家删除锁定」条——规则唯一来源 `utils/score.js:playersPerCamp`（2 队 3 人 / 3~4 队 2 人），`applyPlayerLocks` 在 `buildEditState` 与每次 `editSync` 后重算，占位用 `visibility:hidden` 不可用 `display:none`；并记入「现网 4 人 × 2 队 → ✕ 全隐藏」的预期表现，避免被当成 bug 复查。
- **落地**：`utils/score.js` 新增并导出 `playersPerCamp`（`Number.isFinite` 兜底）；`scoring.js` 删除本地同名函数、改 `const playersPerCamp = score.playersPerCamp`（行为零变化）；`utils/match-form.js` 新增 `applyPlayerLocks`，`emptyPlayer` 补 `locked:false` 初值，`buildEditState` 串上 `applyPlayerLocks`；`matches.js` 的 `editSync` 串上 `applyPlayerLocks`，`editRemovePlayer` 加锁定兜底；`matches.wxml` 的 ✕ 改为 `wx:if` 占位 / `wx:else` 可点两分支；`matches.wxss` 新增 `.match-edit-form .del--placeholder{visibility:hidden}`。
- **验证**：`node --check` 四个 JS 全过；`applyPlayerLocks` 实测——2 队各 2 人 / 各 3 人全锁、各 5 人锁前 3、3 队各 2 人全锁、4 队各 3 人锁前 2；31 个 wxml/wxss/json 结构检查全过；`npm test` 9/9。

**v1.20 编辑态只读值右对齐（牌副数 / 获胜线）**
- **问题**（用户截图）：「牌副数 4 副」「获胜线 200 分」两个只读值在框内贴左，而上方「赛季 / 类型」的 picker 值靠右（`.picker-right .picker-text`），同一张卡里右边界不齐。
- **规范**：§6 修正原「`.picker-text` 与 input 均左对齐」的过时表述（实现早已是 `.picker-right` 内靠右）；§7.3 新增「只读值右对齐」条，写明修饰类、`margin-right` 归零的原因，以及**得分输入框不纳入**的理由（可输入框空态 placeholder 会跟 text-align 贴边）。
- **落地**：`app.wxss` 新增全局修饰类 `.picker-value--right .picker-text{text-align:right;margin-right:0}`（紧跟 `.picker-right .picker-text`）；`matches.wxml` 的两处只读 `.picker-value` 挂上该类（共 2 处，`picker-value--right` 计数校验）。`scoring.*` 不受影响——计分页这两个字段是 picker，本就右对齐。
- **验证**：31 个 wxml/wxss/json 结构检查全过；`picker-value--right` 在 wxml 恰 2 处、`app.wxss` 定义命中；`npm test` 9/9。

**v1.21 计分页行2改为各占一半 + 局次下拉只显示数字（本轮）**
- **需求**（用户截图）：① 「牌副数」和「类型」各自占一半，**不要**再和上面「日期 + 第几局」那一行的列起点对齐；② 「第几局」的下拉内容显示为 `1 2 3 …` 这样的数字，而不是「第 N 局」。
- **规范**：§6「计分页顶部两行并排表单」条由 v1.15 的「两行共用 1.35:1、四列框对齐」改写为「行1 1.35:1 / 行2 1:1 且刻意不对齐」，并补宽度核算；新增「『第几局』选项文案」条（纯数字，`value` 与 `label` 分离）。v1.15 的「四列对齐」判据**即日起作废**，历史记录保留备查。
- **落地**：`scoring.wxml` 两行分别挂 `.form-row--date-seq` / `.form-row--half` 并重写段注释；`scoring.wxss` 把原 `:first-child/:last-child` 的 1.35:1 规则收窄到 `.form-row--date-seq`，为 `.form-row--half .form-field` 显式写 `flex:1 1 0%; min-width:0`，两行仍共用 gap / picker 内距；`scoring.js` 的 `buildSeqOptions` 改 `label:String(i)`、data 初值 `[{value:1,label:'1'}]`。`app.wxss`、其它页面、Web 端、接口与提交字段（`seqOptions[seqIndex].value`）零改动。
- **验证**：`node --check` 计分页 JS；CSS 花括号配对、wxml `view/text/picker` 标签栈自检；`npm test`；宽度核算（内容 670rpx − gap 16rpx → 行2 两列各 327rpx，picker 实得 207rpx ≥「技能赛」112rpx；行2 第二列起点较行1 左移 48.7rpx，符合「不对齐」）；`第${i}局` / `第1局` 全仓零残留。真机下拉展开与两行宽度需在微信开发者工具复看。

**v1.22 编辑态只读说明拆成两行**
- **问题**（用户截图）：`.edit-lock-tip` 把「正在编辑 #13 局」和「日期 / 局次 / 牌副数 / 赛季 / 阵营不可修改，对局类型可修改」挤在一行，34 个汉字在 622rpx 内容宽里于「修改」两字之间断行，读起来像被截断。
- **规范**：§7.3 新增「编辑态只读说明」条——必须两句两行、每句一个块级 `.edit-lock-tip__line`；禁止再合成一行；字号/行高/颜色只在 `.edit-lock-tip` 声明一次。
- **落地**：`matches.wxml` 把单行 `.edit-lock-tip` 改成容器 + 两个 `.edit-lock-tip__line`（文案按用户给的两句）；`matches.wxss` 仅在 `.edit-lock-tip` 上补注释，无新增声明（子节点继承，两行总高 72rpx 与原折行版本一致）。
- **验证**：31 个 wxml/wxss/json 结构检查全过；第二行按 24rpx 字号核算约 360rpx < 622rpx 可用宽，单行成立。
- **注**：并行写入仍在继续，本轮期间规范已由他人推到 v1.21（计分页行2 等分 + 局次纯数字），故本轮顺延为 v1.22；改动全部按唯一字符串锚定。

**v1.23 排行榜当前排序值在列内放大（本轮）**
- **问题**：用户反馈「每个玩家 8 个数字里突出显示的那一项字体不够大、不够突出」，并附真机截图（胜率 100% / 出完率 100%）指出 34rpx 的「100%」两侧仍有余量，可以再大且不会压到旁边。
- **被否决的方案**：第一版把同一个数值搬到 `.rank-top` 姓名行右侧另做 48rpx 大号主指标（`.rank-primary`）。用户明确否决——诉求是**原列里那个数字本身变大**，不是新增展示位。该方案已完整撤回（wxml / wxss / js 全部回退），不得复用。
- **规范**：§3.2 新增排行榜专用刻度 `--font-size-2xl: 44rpx`；§7.1 把「当前排序项」改写为**列内放大**——`.meta-active .meta-val` 用 2xl(44rpx)/700 + `letter-spacing:-2rpx` 且必须设 `width:auto; max-width:none`，窄列降 lg(34rpx)；整列浅主色底改用 `::before` 绝对定位、左右外扩 20rpx（窄列 8rpx），文字 `position:relative; z-index:1`；`.meta-val` 固定盒高由 42rpx 统一提到 56rpx（所有列一起改，行高仍恒定）。原「34rpx 上限 / 40rpx 会压字」断言作废。
- **几何实测（无头 Chrome，375pt / 670rpx 内容区 / 8 列 52 份 + 6rpx gap）**：48rpx（24px）的「100%」墨迹宽 65.7px，单列仅 48.3px。沿用 `width:100% + text-align:center` 时超宽文本整块右溢 17.4px、与右侧「总得分」重叠 4.5px；改 `width:auto` 后由父级居中、左右等量溢出即可不压字（`display:flex;justify-content:center` 同效但依赖 `<text>` 的 flex 渲染，未采用）。**8 个排序口径全量实测**（各列取最坏值：出场 128、胜率/出完率 100%、总得分 1250）：48rpx 时「胜率」向左溢出仍会贴上左侧「胜场」窄列 1.4px，故定稿 44rpx + `letter-spacing:-2rpx`——最小余量 3.2px（胜率）、其余口径 ≥5.8px，全部不压字，色块也全部包住数值。44rpx 比原 34rpx 大 29%，是安全上限；40rpx 只大 18%，未采用。
- **约束仍成立**：8 列份数恒定、不得按高亮项动态加权（切换排序时最右列漂移实测 14px）；行高恒定（任一排序口径下卡片高度一致）。放大只靠字号 + 宽度修正 + 字距 + 色块外扩，不碰列宽与盒高。
- **落地**：`leaderboard.wxss`（`.meta-val` 盒高 56rpx、`.meta-item.meta-active` 伪元素与 z-index、`.meta-active .meta-val` 44rpx + width:auto + letter-spacing、窄列 34rpx + 8rpx 色块、标签主色 600）、`app.wxss`（2xl token 44rpx）、本规范。`leaderboard.wxml` / `leaderboard.js` 本轮净改动为零。
- **验证**：`node --check`、WXML 标签栈、WXSS 花括号配对、样式断言、`npm test` 9/9、`git diff --check` 全过；Chrome 8 口径几何量化见上。
- **注**：与并行会话同时写入，期间规范已推到 v1.22（编辑态只读说明拆两行），故本轮顺延为 v1.23；全部按唯一字符串锚定，未触碰他人改动。真机字体与无头 Chrome 略有差异，最小余量 3.2px 建议真机复看。

**v1.24 对局卡 MVP 玩家改金色主题（本轮）**
- **问题**（用户截图）：展示态玩家胶囊只按阵营色（红队 `#d64545` / 蓝队 `#3b7dd8`）着色，本局 MVP 在对局列表里完全看不出来。用户要求「给 MVP 玩家显示为金色主题色，而不是既有的蓝色 / 红色」。
- **规范**：§7.3 新增「MVP 玩家金色主题」条——写明整颗胶囊的金色规格、深棕字的可读性理由（白字在 #F0B429 上对比度 < 2:1）、与获胜队 🏆 的区分，以及内联 style 优先级这条实现约束；沿用 `--color-medal-gold` 与编辑态 `.chip.mvp.active` 色系，**不新增全局 token**（页面级专属视觉落在 `matches.wxss`）。
- **落地**：`pages/matches/matches.wxml` 的 `.player-score` / `.player-name-half` 按 `p.is_mvp` 挂 `is-mvp` 修饰类，内联背景改为「仅非 MVP 输出」，昵称前加 `★ `；`pages/matches/matches.wxss` 新增 4 条规则（胶囊金棕边 + 金色外圈、姓名半格金色渐变 + 深棕字、分数半格浅金、技能半格同步浅金）。`matches.js` / `lib/api.js` 零改动——bootstrap 与 `GET /api/matches/:id` 本就返回 `players[].is_mvp`。
- **验证**：WXML/WXSS/API/规范共 15 项静态断言全过（含「MVP 时不输出内联背景」「阵营色标与编辑态圆点仍保留阵营色」「无 `!important` 硬覆盖」）；WXML 标签栈平衡、WXSS 花括号平衡；`node --check` 两个 JS 通过；`npm test` 9/9。渐变色与胶囊排版需在微信开发者工具真机复核（本轮无模拟器环境）。
- **范围**：仅小程序「对局」页展示态；Web 端对局明细用 `.badge--mvp`（★ MVP 徽章）标识玩家，姓名不是阵营色胶囊，不在本次改动内。
- **注**：与并行会话同时写入，期间规范已推到 v1.23（排行榜当前排序值列内放大），故本轮顺延为 v1.24；全部按唯一字符串锚定，未触碰他人改动。

**v1.25 编辑页禁用保存按钮配色对齐计分页（选择器特异性回归）**
- **问题**（用户截图）：编辑态「保存修改」置灰后与计分页置灰按钮观感不同。截图量化：编辑页按钮底 `#fafafa`、字 `#969799`；计分页底 `#e5e5e5`、字 `#666666`。两页 CSS 写的颜色本来一样，差异来自**选择器特异性**——编辑页写的是 `.match-save[disabled]`（`(0,2,0)`），被微信 `button` 组件内置的 `button[disabled]` 系列样式压过；计分页写的是 `.preview-card .btn-primary[disabled]`（`(0,3,0)`），赢了内置样式。
- **规范**：§7.3 新增「禁用态配色必须与计分页完全一致」条——颜色（`#e5e5e5` / `#666666` / `opacity:1`）必须一致，**尺寸不要求统一**（编辑页 72rpx 独立按钮、计分页纵向撑满预览卡，属位置差异）。选择器固定为 `.match-edit-drawer button.match-save[disabled]`（`(0,3,1)`），并写明去掉祖先类 / 元素名 / `opacity` 任一项都会退回原生灰，属回归。
- **落地**：`matches.wxss` 仅把 `.match-save[disabled]` 改为 `.match-edit-drawer button.match-save[disabled]`，三条声明一字未动；`matches.wxml` / `matches.js` / `scoring.*` 零改动。
- **验证**：31 个 wxml/wxss/json 结构检查全过、WXSS 花括号平衡、`npm test` 9/9；截图色值实测见上，改后与计分页同名声明字面一致。真机需在微信开发者工具复看（本环境无模拟器）。
- **注**：计分页自身存在**两套**禁用配色——卡头小「保存」`.card-head .btn-primary.mini[disabled]` 是 `#cccccc` 底白字，底部预览卡是 `#e5e5e5` 底 `#666` 字。本轮统一到**底部预览卡**那套（与编辑页同位同语义）。若日后要统一成 `#cccccc` 白字，两页需一起改。

**v1.26 收紧「不合规提示」到页脚分割线的空白**
- **问题**（用户截图）：`⚠️ 获胜条件不满足 · MVP 未设置` 一行下方到分割线之间空白偏大，用户问「有什么用处吗」。截图量化（`scripts/png-measure.js` 的 `decodePng`，722px 宽 ≈ 750rpx）：提示文字墨迹底部 y≈90、分割线 y=137、差值 45px ≈ 47rpx，与「24rpx + 24rpx」的理论值吻合。
- **根因**：两个独立来源叠加——`.season-edit`（app.wxss:483-488）的 `padding-bottom:24rpx` 与 `.match-footer`（matches.wxss）的 `margin-top:24rpx`。这段空白没有任何信息承载，纯属双层间距。
- **规范**：§7.3 新增「表单底部与页脚之间只保留一份间距」条——编辑态以 `.match-edit-form { padding-bottom:0 }` 归零，只保留页脚 24rpx；**禁止**改为削减 `.match-footer` 的 `margin-top`，那会连带削掉展示态（`.camp-block` 与页脚之间）的留白。
- **落地**：`matches.wxss` 内联编辑区块新增第 4 条规则 `.match-edit-form { padding-bottom: 0 }`（单类，与 `.season-edit` 同特异性但页面样式表后加载，长属性覆盖简写中的对应项）。`matches.wxml` / `matches.js` / `scoring.*` 零改动。
- **效果核算**：提示行墨迹到分割线由 45px 降到约 29px（24rpx + 行盒下沿余量 6rpx），卡片净矮 24rpx（12px @375pt）；分割线下方保持 16rpx `padding-top` 不变，上下比例回到合理区间。
- **验证**：31 个 wxml/wxss/json 结构检查全过、WXSS 花括号平衡、`npm test` 9/9。真机需在微信开发者工具复看（本环境无模拟器）。
- **注**：本轮同样与并行会话同时写入，规范此前已被推到 v1.25（禁用按钮配色对齐），故顺延为 v1.26；改动按唯一字符串锚定。

**v1.27 计分页顶部表单改为三行（日期 / 第几局 + 牌副数 / 类型）**
- **需求**（用户）：计分界面「日期单独一行；第 X 局和牌副数平分一行；牌局类型单独一行」。局次下拉仍按 v1.21 显示纯数字 `1 / 2 / 3 …`，本轮不改文案。
- **规范**：§6「计分页顶部两行并排表单」条整体重写为三行结构（日期 / 类型独占、中间 1:1 平分），补「独占行必须用 `form-label--justify`」的踩坑约束与宽度核算；**v1.21 的「行1 1.35:1 + 行2 牌副数/类型 1:1 且刻意不对齐」判据即日起作废**（v1.15 四列对齐判据更早作废），历史记录保留备查。
- **落地**：`scoring.wxml` 把两行两列重排为三行——日期、类型改为独占 `.form-row`（标签换 `.form-label--justify`），「第几局 + 牌副数」合成唯一的 `.form-row--half`；`scoring.wxss` 删除 `.form-row--date-seq` 的 1.35:1 两条规则并重写段注释，保留 `gap` / 并排行 `flex:1 1 0%` / 内距覆盖。`scoring.js` 零改动（4 个表单 picker 的 `bindchange` 与 `seqOptions` / `deckOptions` / `typeOptions` 全部原样，只换容器）。`app.wxss`、其它页面、Web 端、接口零改动。
- **验证**：`node --check` 计分页 JS；WXML 标签栈平衡（未闭合 0 / 错配 0）、4 个表单 `bindchange` 齐全、字段顺序「日期 → 第几局 → 牌副数 → 类型」递增；WXSS 花括号 28/28；`form-row--date-seq` 在 `scoring.wxml` / `scoring.wxss` 零残留（仅规范历史记录中仍有提及）；`npm test` 9/9；`git diff --check`。真机三行高度与 sticky 头部占位需在微信开发者工具复看。
- **注**：与并行会话同时写入，规范此前已推到 v1.26（编辑态页脚空白收紧），故本轮顺延为 v1.27；改动按唯一字符串锚定，未触碰他人改动。

**v1.28 对局卡 MVP 移除星形角标，只保留金色配色（本轮）**
- **需求**（用户反馈）：「不需要这个星星，配色改了就行」——撤回 v1.24 在 MVP 昵称前附加的角标，金色主题配色原样保留。
- **规范**：§7.3「MVP 玩家金色主题」条改为「昵称保持纯文本 `{{p.name}}`，不加任何角标 / 徽章」；**v1.24 中「昵称前加角标」及「角标在玩家胶囊内」两句落地描述即日起作废**，历史记录保留备查。与获胜队 🏆 的区分改按层级表述（奖杯在阵营行、金色在玩家胶囊内），不依赖角标。
- **落地**：`matches.wxml` 姓名半格由带角标前缀的表达式改回 `{{p.name}}`，段注释同步删掉角标说明；`matches.wxss` 只改段注释，4 条 `.is-mvp` 配色规则与全部色值一字未动；`matches.js` / API 零改动。Web 端既有 `.badge--mvp` 徽章文案不属于本轮范围，未动。
- **验证**：静态断言（WXML / WXSS 无角标字符、姓名为纯 `{{p.name}}`、4 条配色规则与色值齐全）、WXML 标签栈 / WXSS 花括号平衡、`npm test` 9/9、`git diff --check`；真机渐变观感待微信开发者工具复看。
- **注**：并行会话期间规范已推到 v1.27（计分页顶部表单改三行），故本轮顺延为 v1.28；按唯一字符串锚定，未触碰他人改动。

**v1.29 编辑态「类型」移到牌副数 / 获胜线下方（本轮）**
- **需求**（用户截图）：编辑页里「类型」原来夹在「赛季」和「牌副数 / 获胜线」之间，要求放到「牌副数 / 获胜线」下面。
- **规范**：§7.3「编辑态可改对局类型」条补字段顺序硬约束（只读说明 → 赛季 → 牌副数 / 获胜线 → 类型 → 阵营卡），把「赛季只读行下方」改为「两个只读字段下方」；「只读值右对齐（v1.20）」条把「上方赛季 / 类型」修正为「上方赛季、下方类型」。v1.12 起「类型紧跟赛季行」的隐含顺序即日起作废。
- **落地**：`matches.wxml` 把类型 `.form-row` 整块移到 `.form-row--inline` 之后，段注释同步；class / `range` / `range-key` / `value` / `bindchange` 一字未动。`matches.wxss`、`matches.js`、`app.wxss`、计分页、Web 端、接口零改动。
- **验证**：WXML 标签栈平衡、字段位置「赛季 → 牌副数 → 获胜线 → 类型」递增、编辑表单内 3 个 `.form-row` 与 `editOnTypeChange` 绑定齐全、WXSS 花括号配对、`npm test` 9/9、`git diff --check`。真机顺序与间距待微信开发者工具复看。
- **注**：与并行会话同时写入，规范此前已有 v1.28（MVP 移除星形角标），故顺延为 v1.29；头部版本一并从滞后的 v1.27 补到 v1.29。改动按唯一字符串锚定，未触碰他人改动。

**v1.30 不合规提示移到队伍列表上方**
- **需求**（用户原话）：「把这个警告提示，放到队伍列表的上方，就像是计分界面中一样」。计分页的 `.rule-warns` 位于顶部表单卡末尾（`scoring.wxml:58-60`），其下才是阵营卡列表；编辑页此前把它挂在 `wx:for="{{edit.camps}}"` 之后，被几个阵营卡顶到下方，并紧贴页脚分割线。
- **规范**：§7.3 新增「位置：队伍列表上方（v1.30）」条——提示行必须挂在 `.match-edit-form` 内、阵营卡 `wx:for` **之前**；间距交给相邻兄弟 margin 折叠，**不得**给 `.rule-warns` 另加 `margin-bottom`。同页「编辑态可改对局类型」的字段顺序补为「… → 类型 → 不合规提示 → 阵营卡」。
- **落地**：`matches.wxml` 把 `<view wx:if="{{edit.ruleWarnText}}" class="rule-warns">` 整行从阵营循环之后移到类型 `.form-row` 之后、`wx:for="{{edit.camps}}"` 之前，段注释同步改写成位置理由。`matches.wxss` / `matches.js` / `utils/match-form.js` / 计分页 / Web 端 / 接口零改动。
- **间距核算**：上方 `.form-row` 的 `margin-bottom:16rpx` 与 `.rule-warns` 的 `margin-top:6rpx` 折叠为 16rpx；下方阵营卡自带 `margin-top:24rpx`（`.card` 的 `margin:24rpx 16rpx`，左右已被 `.match-edit-form .card` 抵消）。无需新增任何间距声明。
- **验证**：`rule-warns` 在 `matches.wxml` 中恰出现 1 次且行号小于 `wx:for="{{edit.camps}}"`；31 个 wxml/wxss/json 结构检查全过、WXSS 花括号平衡、`npm test` 9/9、`git diff --check`。真机位置待微信开发者工具复看。
- **注**：并行写入继续，规范此前已被推到 v1.29（编辑态「类型」下移），故本轮顺延为 v1.30；全部按唯一字符串锚定，未触碰他人改动。

**v1.31 编辑态「只读说明」与「不合规提示」左移 24rpx 对齐卡头**
- **需求**（用户截图 + 原话）：「正在编辑 XXX 和获胜条件不足的行的向左对齐的线是不是可以和 #13、还有红队的这个卡片的左边对齐」。
- **根因**：卡片 `.card` 是 `margin:16rpx + padding:24rpx`，内容盒左边界 40rpx；`.match-header` 的「#N」和 `.match-edit-form .card`（阵营卡，已用负 margin 抵消）都在 40rpx。而 `.match-edit-form` 继承 `.season-edit` 的 `padding:24rpx`，表单内纯文字默认落在 64rpx，于是出现两条竖线。截图实测（462px 宽）：`#13` 起于 x≈32、红队卡左边框 x≈31、只读说明与 ⚠️ 起于 x≈46-49，差值约 24rpx，与推算一致。
- **规范**：§7.3 新增「文字块左对齐基准（v1.31）」条——两块纯文字必须回到 40rpx；表单字段与阵营卡内文保持 64rpx；必须用直接子选择器 `>`。
- **落地**：`matches.wxss` 新增 `.match-edit-form > .edit-lock-tip, .match-edit-form > .rule-warns { margin-left: calc(-1 * var(--space-md)) }`，紧跟在 `.edit-lock-tip` 规则之后。`matches.wxml` / `matches.js` / 计分页 / Web 端 / 接口零改动。负 margin 恰好用完卡片自身的 24rpx padding，文字不会越出卡片边框；块级 `auto` 宽度同步增加 24rpx，右边界仍在 686rpx 之内，不溢出。
- **验证**：两元素在 `matches.wxml` 中确为 `.match-edit-form` 直接子节点；31 个 wxml/wxss/json 结构检查全过、WXSS 花括号平衡、`npm test` 9/9、`git diff --check`。真机对齐待微信开发者工具复看。
- **注**：本轮无并行冲突（规范仍为 v1.30），直接顺延为 v1.31。

**v1.32 排行榜高亮列：渐变底 + 层级降低 + 数字下平面对齐**
- **需求**（用户截图 + 原话）：「虽然数字没有遮挡，但是背景遮挡了；考虑将背景设置为一个从上到下，从深到白的一个渐变效果，同时层级降低，不会遮挡旁边的文字；被加重显示的数字和其他数字的下平面对齐，而不是中线对齐」。v1.23 的实心 `--color-primary-light` 色块外扩 20rpx，只把**高亮列自己**的文字抬到 `z-index:1`，邻列文字仍是 static，被定位伪元素压在下面；同时 44rpx 与 24rpx 在 56rpx 行盒里垂直居中，呈中线对齐、大数字明显下沉。
- **被否决的方案**：用 `display:flex; align-items:flex-end` 改 `.meta-val` 做底对齐——依赖 `<text>` 组件的 flex 渲染，且行盒底对齐仍含 descent 空白、并非可见墨迹底边对齐；改 `line-height` / 盒高配平基线则依赖字体度量系数（约 0.4×字号差），真机字体一变就失准。两者均未采用。
- **规范**：§3.1 新增 `--gradient-meta-active`（180deg，主色 18% → 6% → #ffffff）；§7.1「当前排序项」条改写为渐变背景 + 色块 `z-index:0` + 8 列全部文字 `position:relative; z-index:1`，以及 `transform:translateY(-8rpx)` / 窄列 `-4rpx` 的下平面对齐规则；原「为不让浅底盖住文字，只抬高亮列」的表述即日起作废，历史记录保留备查。
- **量化依据（无头 Chrome + canvas `measureText` 字体度量，375pt / 670rpx 内容区）**：中线对齐时普通 7 列墨迹底边 y=38.14px（离散仅 0.21px），高亮「100%」y=42.33px，**偏下 4.19px = 8.4rpx**；上移 8rpx 后残差 <0.2px。窄列 34rpx 偏下 2.10px = 4.2rpx → 上移 4rpx 后残差 0.00px。`rank-meta` 高度改前改后均 44.00px，行高恒定。computed style 验证：新方案 16 个数值/标签 `z-index` 全为 1、色块为 0 且背景是 linear-gradient；旧方案邻列为 `z-index:auto / position:static`（会被定位伪元素覆盖）。
- **约束仍成立**：8 列份数恒定、列宽不随排序口径变化；行高恒定；44rpx + `width:auto` + `letter-spacing:-2rpx` 的放大方案与 8 口径不压字结论不变（本轮只做垂直位移与背景层调整，不动水平几何）。
- **落地**：`leaderboard.wxss`（`.meta-val` / `.meta-label` 基础规则加 `position:relative; z-index:1`；`::before` 改 `z-index:0` + `var(--gradient-meta-active)`、移除高亮列专属 z-index 规则；`.meta-active .meta-val` 与窄列加 transform；段注释重写）、`app.wxss`（渐变 Token）、本规范。`leaderboard.wxml` / `leaderboard.js` 本轮净改动为零。
- **验证**：`node --check`、WXML 标签栈、WXSS 花括号配对、样式断言、`npm test` 9/9、`git diff --check`；Chrome 字体度量与层级 computed style 见上。真机字体度量略有差异，底对齐残差与渐变深浅待微信开发者工具复看。
- **注**：并行写入继续，期间规范由 v1.30 推到 v1.31（编辑态只读说明与不合规提示左移 24rpx），故本轮顺延为 v1.32，头部版本同步；全部按唯一字符串锚定，未触碰他人改动。

**v1.33 编辑态只读说明改回单行（·分隔）并向「赛季」标签左对齐**
- **需求**（用户截图 + 原话）：「这里正在编辑和日期/局次还是写在一行，中间用·隔开；向左边和它下面的赛季对齐」。
- **背景**：v1.21 因「一行会在修改两字中间折行」拆成两句两行，v1.31 又把它与 `.rule-warns` 一起用负 margin 拉到 40rpx 对齐卡头「#N」。本轮用户要求回到单行、并与表单标签（64rpx）对齐——两个基准都被推翻，故选择器与文案同时收窄。
- **关键取舍（文案去空格）**：单行整句在 24rpx 字号下，「日期 / 局次 / 牌副数」带空格约 615~625rpx，正好顶到 622rpx 内容边界，正是 v1.21 折行的原因；去掉斜杠两侧空格后约 580rpx（19 个汉字 ≈ 456rpx + `#13`/斜杠/`·`/少量空格），留 40rpx 余量，一行放得下且不需要 `nowrap` 兜底（真机字体更宽时会自然折行，不会溢出）。
- **落地**：`matches.wxml` 把容器 + 两个 `.edit-lock-tip__line` 换回单个 `<view class="edit-lock-tip">正在编辑 #{{item.id}} 局 · 日期/局次/牌副数/赛季等不可修改</view>`；`matches.wxss` 把 `.match-edit-form > .edit-lock-tip, .match-edit-form > .rule-warns` 收窄为 `.match-edit-form > .rule-warns`（`.edit-lock-tip` 回到 64rpx），并重写两段注释。`.edit-lock-tip__line` 全仓零残留。
- **验证**：31 个 wxml/wxss/json 结构检查全过、WXSS 花括号平衡、`npm test` 9/9。宽度为字体度量推算（本机无头 Chrome 截图本轮被沙箱拦截，未能出图），真机请确认这一行未折行。
- **注**：并行写入继续（规范本轮开始时已是 v1.32，v1.32 为排行榜高亮列），故顺延为 v1.33；顺带把 v1.32 标题里的「（本轮）」去掉，避免两轮都自称本轮。

**v1.34 排行榜高亮列移除全部背景色**
- **需求**（用户原话）：「算了，其他保留，但是不用这个背景色了」——保留 44rpx 放大、下平面对齐、层级处理，撤掉 v1.32 刚加的渐变背景块。
- **规范**：§3.1 删除 `--gradient-meta-active` Token；§7.1「当前排序项」条改为**不使用任何高亮背景色**（v1.23 实心浅底、v1.32 渐变底、色块 `::before` 及外扩规则全部作废、不得恢复），只靠字号 / 字重 / 主色突出；8 列文字统一 `position:relative; z-index:1` 改列为**防御约定**保留（未来若恢复背景，定位背景默认会盖住 static 文字，见 v1.32 遮挡问题）；补「不得为越出列边界的数字改列宽或加回底色」约束。
- **落地**：`leaderboard.wxss` 删除 `.meta-item.meta-active`（仅作色块定位容器）、`.meta-item.meta-active::before`、`.meta-narrow.meta-active::before` 三条规则及其注释，段注释重写为「列内数值直接放大（无背景块）」；`app.wxss` 删除渐变 Token；本规范。`leaderboard.wxml` / `leaderboard.js` 零改动。
- **保留不动**：`--font-size-2xl: 44rpx`、`width:auto / max-width:none`、`letter-spacing:-2rpx`、字重 700/600 + 主色、`transform:translateY(-8rpx)`（窄列 `-4rpx`）下平面对齐、8 列全部文字 `z-index:1`、`height/line-height:56rpx` 与 `28rpx` 固定盒高、8 列份数恒定。水平几何一字未动，v1.23 的「8 口径不压字 / 最小余量 3.2px」结论继续成立。
- **验证**：WXSS 花括号配对、WXML 标签栈、样式断言（`::before` 与渐变 Token 零残留、transform 仍在）、`node --check`、`npm test` 9/9、`git diff --check`；无头 Chrome 复看无底色渲染，高亮数字与邻列仍不重叠。
- **注**：并行写入继续，规范本轮开始时已由 v1.32 推到 v1.33（编辑态只读说明改回单行），故顺延为 v1.34；写入期间并行会话又把头部状态推到 v1.35，故**不回退头部**，保留对方的 v1.35。全部按唯一字符串锚定，历史 v1.23 / v1.32 记录保留备查。

**v1.35 编辑态改为页脚下方抽屉展开（视觉稳定性）**
- **需求**（用户截图 + 原话）：点击「编辑」后，新内容从编辑 / 删除按钮上方的横线下展开，保持上方相对界面位置不变、下面的内容向下展开；点击「收起」后保持收起按钮位置不变，内容向按钮方向折叠。方案确认时用户选择「**保留展示内容**」。
- **结构**：`matches.wxml` 展示态 `<block>` 去掉 `wx:if` 始终渲染；`.match-footer` 只留 `.match-actions`（预览 + 保存移出）；编辑表单整块移到页脚之后，包进 `.match-edit-drawer > .match-edit-drawer__inner`，内部顺序 `.match-edit-form` → `.footer-preview`（初版预览在上，v1.36 按用户要求把「保存修改」移到抽屉最后一项，见下条）。抽屉高度变化不影响上方任何节点，因此按钮与上方内容全程不动。
- **落地**：`matches.js` 新增 `drawerOpen` / `drawerMaxHeight` 与 `measureDrawer()`（初版实测 `form.bottom - preview.top`；v1.36 起因保存行移到表单下方，改为两块内容的外包络 `max(bottom) - min(top)`，并在 `editSync` 里按结构指纹重测，避免内容变高被裁掉），`openEdit` 去掉 `scrollToCard`、改为「0px 渲染 → 30ms 后测量 → 展开」，`cancelEdit` 改为「先折叠 → 300ms 后清 `editingId`」；`_drawerTimer` / `_drawerClosing` 防止 30ms 内点收起时测量回调把抽屉重新撑开。`matches.wxss` 新增抽屉过渡（`max-height` 280ms + opacity 200ms + `translateY(-8rpx)→0`）、把禁用态选择器祖先类改为 `.match-edit-drawer`（特异性 `(0,3,1)` 不变）、重写页脚 / 表单底部注释。`app.wxss`、计分页、Web 端、接口零改动。
- **规范**：§7.3 由三段结构改为「三段 + 编辑态第四段抽屉」，新增「编辑抽屉」条；页脚预览行 / 右边缘对齐 / 禁用态选择器 / v1.26 间距条 / 验收判据同步；**v1.17 起「页脚是卡片最后一个子节点」「预览行挂在页脚内」「openEdit 后 scrollToCard 定位」三条判据即日起作废**，历史记录保留备查。
- **验证**：`node --check` matches.js；WXML 标签栈 0 未闭合 / 0 错配、WXSS 花括号 58/58；页脚在抽屉之前、展示态无条件渲染、预览行在抽屉内、页脚只含 actions、`drawerMaxHeight` 绑定、`confirmModal` id 未误改、旧禁用选择器零残留；`npm test` 9/9；`git diff --check`。真机动画时长与抽屉测量精度需在微信开发者工具复看。
- **注**：与并行会话同时写入，头部状态已同步为 v1.35，本轮记录即落 v1.35；全部按唯一字符串锚定，未触碰他人改动。

**v1.36 「本局预览 + 保存修改」移到抽屉最后（表单下方）**
- **需求**（用户截图 + 原话）：「保存还是要放在最后」。v1.35 抽屉化时把预览 / 保存放在 `__inner` 首项，实际渲染出来是一打开编辑、保存按钮就先出现在表单上方，读起来像「先存后改」。
- **结构**：`matches.wxml` 把 `.footer-preview` 从 `__inner` 首项移到 `.match-edit-form` **之后**（`__inner` 的最后一项），成为抽屉内容的收尾。
- **连带修的两处（不改会直接坏功能）**：
  1. `measureDrawer()` 原公式 `form.bottom - preview.top` 假设「预览在上、表单在下」，顺序一换会得到**负值**，`max-height` 变成 0、抽屉展不开。改为**外包络** `Math.max(preview.bottom, form.bottom) - Math.min(preview.top, form.top)`，不假设谁上下，同时仍把两块之间的 margin 含进来。
  2. 抽屉 `max-height` 是打开时一次性测的，内容变高就会被裁；保存按钮现在正好在抽屉最底部，**被裁掉的就是唯一保存入口**（v1.35 时裁掉的是阵营卡，危害小得多）。`editSync` 的 `setData` 回调按「各阵营人数 + 对局类型 + 是否有提示行」的结构指纹比对，变了才重新 `measureDrawer()`；不能用「每次都量」——`editSync` 每个 keystroke 都跑，会变成每敲一个字就查一次选择器 + 一次 setData。
- **样式**：`.footer-preview` 由「向下留白」改为「向上分隔」——`margin-bottom:var(--space-sm)` 换成 `margin-top:var(--space-md); padding-top:var(--space-sm); border-top:1rpx solid var(--color-border)`，与 `.match-footer` 的分割线语言一致；底部留白交给 `.card` 的 16rpx padding。
- **不变**：`.match-edit-drawer button.match-save[disabled]` 祖先仍是抽屉，特异性 `(0,3,1)`、`#e5e5e5`/`#666` 不变；「保存修改」与「删除」右边缘仍在 710rpx（预览行仍在 `.match-edit-form` 之外）。
- **验证**：`node --check` matches.js、31 个 wxml/wxss/json 结构检查全过、WXSS 花括号平衡、`npm test` 9/9、`git diff --check`；WXML 中 `match-footer` → `match-edit-drawer` → `match-edit-form` → `footer-preview` 的顺序已逐行确认。真机请复看：展开抽屉后保存按钮应在最底部；再点「+ 添加玩家」，抽屉应跟着长高、保存按钮不被裁。
- **注**：并行写入继续（本轮开始时规范已是 v1.35，v1.35 为抽屉化），故顺延 v1.36；顺带去掉 v1.35 标题里的「（本轮）」。

**v1.37 抽屉底部「保存修改」被裁掉 12.5rpx（max-height 收尾置 none）**
- **问题**（用户截图 + 原话）：「这个按钮下面明明被截断了」。解码截图实测：按钮渲染高度只有 **59.5rpx**（应为 72rpx），缺 12.5rpx；按钮下方到卡片底仍有 16rpx 白边，说明裁的是**抽屉**（`.match-edit-drawer` 的 `max-height` + `overflow:hidden`），不是卡片。
- **根因**：`measureDrawer()` 在抽屉尚未展开（`__inner` 仍带 `translateY(-8rpx)`）时取值，`boundingClientRect` 含 transform，使内容整体偏上 8rpx；而 `max-height` 恰好卡在「实测值 + 2px」，两者相抵后底部露出被裁的一刀。8rpx（位移）+ 4rpx（2px 余量被吃掉）= 12rpx，与实测 12.5rpx 吻合。
- **修法**（同时解决「内容变高被裁」）：① 过渡目标改为实测值 + 8px，盖住 `translateY` 位移，动画收尾快 1%（不影响最终布局——`max-height` 大于内容时不撑高盒子）；② 展开 280ms 后把 `max-height` 置 `none`，此后内容再长也不会被裁；③ 收起时先把 `max-height` 落回实测高度、20ms 后再归零，避免 `none → 0px` 不可插值导致动画丢失；④ 删掉 v1.36 的结构指纹重量（`_drawerSig`）——已被 ② 取代，留着反而会把 `max-height` 重新锁死。计时器拆成 `_drawerTimer`（30ms 测量 / 20ms 归零）与 `_drawerCleanup`（300ms 清 `editingId`）两个句柄，互不覆盖。
- **验证**：`node --check`、31 个 wxml/wxss/json 结构检查全过、`npm test` 9/9、`git diff --check`；`_drawerSig` 全仓零残留，`_drawerHeight` / `_drawerRelease` / `_drawerCleanup` 引用成对。真机请复看：展开后按钮完整（72rpx）、下方只有卡片 16rpx 留白；点「+ 添加玩家」抽屉跟着长高；「收起」仍有向上收回的动画。
- **注**：并行写入继续（本轮开始时规范为 v1.36），故顺延 v1.37。

**v1.38 切换编辑目标时的滚动锚定补偿（视觉稳定性补漏）**
- **问题**（用户原话）：「如果上面已经打开了一个编辑页面，我再划到下面，再点击另一个对局的编辑，这个『固定按钮位置』的实现，就失效了，有修补方案吗？」v1.35 把抽屉移到页脚之后，只保证了**同一张卡**内部不位移；跨卡切换时上方卡片 A 的 `wx:if` 抽屉被立即销毁（切换路径不走 `cancelEdit()` 的折叠动画），A 卡片变矮 H，文档流里 B 及之后所有内容上移 H，刚点的按钮也跟着跳。
- **判定**：抽屉位于按钮下方这一结构本身没错，也不该回退到「自动滚到卡片顶部」的 `scrollToCard`（那会让整屏跳动）。缺的是对**其它卡片高度变化**的滚动锚定，等价于浏览器的 scroll anchoring。
- **落地**：新增 `miniprogram/utils/scroll-anchor.js`（纯函数 `anchoredScrollTop`，便于单测）；`matches.js` 增 `readAnchor()` / `restoreAnchor()`，`openEdit` 仅在 `switching`（`editingId != null`）时于 `setData` 前后各测一次 `#match-{{id}}` 视口 top，做一次 `wx.pageScrollTo({duration:0})` 补足差值；`cancelEdit()` 递增 `_anchorSeq` 作废挂起补偿。**`matches.wxml` / `matches.wxss` / `app.wxss` / 接口零改动**，展示态与抽屉动画完全不变。
- **边界（如实记录）**：`scrollTop < H`（页面接近顶部）时 `scrollTop` 不能为负，只能补到 0，按钮仍有 `H - scrollTop` 的残余上移，用 160ms 短过渡摊开。要 100% 固定只能让旧抽屉等高占位不撤（会留一块空白）或把抽屉 `absolute` 浮层化脱离文档流（牺牲内联展开观感），两者均未采用。
- **规范**：§7.3「编辑抽屉」条追加 ⑥「切换编辑目标必须做滚动锚定」；第二段说明与第 216 行补上「同卡 / 跨卡」限定；**验收判据 ⑦ 的「页面 `scrollTop` 不因点击编辑而改变」改为两态口径**——同卡零变化，跨卡允许且仅允许一次 `duration:0` 补偿。v1.35 的历史记录保留不改。
- **验证**：`node --check` 两个 JS 文件；纯函数 4 个场景（A 在上 / A 在下无重排 / scrollTop 不足 / 正向位移）+ 几何闭环「补偿后按钮视口坐标 300 → 300」全过；`npm test` 9/9；`git diff --check`；WXML 标签栈 0 未闭合 / 0 错配、WXSS 花括号配对；调用链静态断言（引入、仅切换路径测量、双守卫、cancelEdit 作废、duration 显式 0、无 scrollToCard 方法/调用）复核全过。真机需在微信开发者工具复看：A 展开 → 下滑点 B 编辑，B 按钮应停在原处、B 抽屉仍向下展开。
- **注**：并行写入继续，本轮开始时规范为 v1.37，故顺延 v1.38；全部按唯一字符串锚定。

**v1.39 列表最后一张卡展开 / 收起仍跳动（贴底 `scrollTop` 钉住）**
- **问题**（用户原话）：「当我点击列表最后一个对局的时候，也会出现跳动」。追问时点后确认为**展开时**与**收起时**都跳，**不涉及跨卡切换**。
- **根因**：与 v1.38 的文档流重排无关。抽屉撑高 / 收回改变 `pageHeight`，而页面滚到底部时 `scrollTop` 正贴着上限 `pageHeight − 视口高`：变高被系统「自动贴底」拉上去、变矮又被夹回新上限 → 上方内容整体位移。**两次跳动是同一个滚动位置被改写再回落**。v1.38 只在切换路径补偿，且「变矮」时上限已降、根本补不回来。
- **修法**：把 `scrollTop` 在展开窗口（380ms）内钉在点击前的值 —— 恢复 `onPageScroll` 逐帧拉回，并在 `setData` 完成 / 抽屉高度开始变化 / 动画收尾三个关键帧用 `pinScroll()` 主动各钉一次。钉住后收起时页面高度回落，`maxScroll` 恰好回到该值，不再夹断，**收起跳一并消失**。
- **落地**：`matches.js` 全路径 `readAnchor()`（不再只限切换）；新增 `onPageScroll()` / `pinScroll()`；`restoreAnchor()` 把补偿后的 `target` 写回钉住目标、`raw < 0` 时禁用钉住；`cancelEdit()` 解除钉住；`measureDrawer()` 两处关键帧补钉。**`wxml` / `wxss` / 抽屉动画 / 接口零改动**，v1.35 的内联展开观感完全保留。规范 §7.3 追加 ⑦ 条与验收判据 ⑧，第 216 行注明 `onPageScroll` 为 v1.39 恢复（v1.35 曾移除）。
- **代价 / 边界**：380ms 窗口内用户主动滚动会被拉回（很短，且正好是动画期间）；编辑期间用户滚到更下方再收起时，`scrollTop` 会随折叠动画逐帧平滑回位，属内容变矮的必然回位，不是硬跳。
- **验证**：模拟小程序环境（`Page` / `wx` mock）8 个断言全过——自动拉高钉回、无递归重复滚动、窗口过期解除、切换补偿 `target=400` 且钉住同步、过期序号作废、补偿不足不钉住、收起解除；另有 `node --check`、`npm test` 9/9、`git diff --check`、WXML 标签栈 / WXSS 花括号、调用链静态断言全过。真机需复看：滚到底 → 点最后一张「编辑」展开、再点「收起」，两处按钮都不动。
- **注**：并行写入继续，本轮开始时规范为 v1.38，故顺延 v1.39；全部按唯一字符串锚定。

**v1.40 技能页视觉整理：编辑态缩进展开 + 按钮收进输入行（本轮）**
- **需求**（用户原话）：「功能基本可用了，但是界面有点丑（增加界面各元素各归其位但整体丑；列表编辑点击后变化突兀）」，随后确认「按建议方案修改」。
- **诊断**：配色/字号/圆角本就符合 §3/§5，「丑」来自两处结构问题——单字段表单的「保存」脱离输入行独占第二行（视觉重心散），以及编辑态用整行替换丢掉从属关系（按钮从「编辑/删除」变「取消/保存」、高度跳变）。
- **落地**（仅 `pages/skills/skills.wxml` / `skills.wxss`，`skills.js` 与数据层/API 零改动）：
  1. 新建表单改为 `名称 [input flex:1] [保存 120rpx]` 同排，删掉 `.skill-form-actions` 独占行；编辑行「取消/保存」同排收进 `.skill-edit__form`，总高约 88rpx（原 160rpx+）。
  2. 编辑态改为展示行下方缩进展开：`.skill-item` 包住展示行与 `.skill-edit`，展示行常驻；「编辑」按钮在编辑态原地变「收起」（位置不跳、上下文还在）；编辑区 `margin-left:24rpx + padding-left:24rpx + border-left:3rpx rgba(15,81,50,.35)` + `--color-primary-light` 底，加「正在编辑：{{item.name}}」提示。
  3. 间距分档：标题→表单 `24rpx`、表单内部 `16rpx`、表单→脚注 `24rpx + border-top`；脚注用 `padding-left:calc(96rpx + var(--space-md))` 对齐输入列，分隔线仍横跨整行。
  4. 列表分割线改画在 `.skill-item + .skill-item` 的 `border-top`，不再画在 `.skill-row` 底部——编辑区展开时线仍在整项末尾，不会重复或跳动。保留 `.skill-row__main{min-width:0}` / `.skill-row__actions .mini{width:auto;display:inline-flex}` 的防挤压补丁。
- **规范**：§8「二级管理页走 navigateTo」下新增「编辑态走展示行下方缩进展开」与「单字段表单按钮收进输入行」两条；§7.3 对局「编辑抽屉」经验复用，但技能页字段少、不需要 max-height 动画，故用静态展开。
- **验证**：WXML 标签栈 0 未闭合 / 0 错配、8 个事件处理函数与 JS `async` 定义全部匹配、7 个 CSS 变量均在 `app.wxss` 定义、`npm test` 9/9、`npm run smoke` 56/56、`git diff --check` 全过。真机需在微信开发者工具复看展开/收起的视觉柔和度。

**v1.41 技能页表单按钮尺寸失控修复（截图反馈）**
- **问题**（用户截图 + 原话）：「新建部分的按钮的输入框的按钮尺寸有明显问题；编辑栏目下同样存在很多问题」。实测截图：保存按钮被撑到约 200rpx+（远超设定的 120rpx），输入框被挤成竖条，编辑区保存按钮溢出卡片右缘被裁切。
- **根因**：v1.40 直接给 flex 行内的 `<button class="btn-primary mini">` 写 `width:120rpx; flex:0 0 auto; display:inline-flex`。微信原生 button 的默认样式 + `.mini` 的 `padding:0 24rpx` 会让按钮按内容宽撑开，固定宽度约束失效；button 争到的空间反过来挤压 `flex:1 1 0` 的 input。
- **修法**：引入固定宽度槽位 `.btn-slot{flex:0 0 120rpx; min-width:0}`，把 3 个按钮（新建保存 / 编辑取消 / 编辑保存）各包一层 `<view class="btn-slot">`；内层 button 改 `display:block; width:100%; min-width:0; padding:0; margin:0` 铺满槽位。槽位是普通 view，flex 布局行为可预测，不受 button 默认样式影响。新建表单行无 gap（label 自带 margin-right），给它的槽位单独补 `margin-left:var(--space-sm)`；编辑区由 `.skill-edit__form` 的 gap 负责间距。
- **同步**：§8 单字段表单条改写为「必须用固定宽度槽位包裹」，新增一条「禁止直接给 flex 行内 button 写固定宽度」的禁令（与 §4.2 同源但固定宽度场景必须用槽位）。
- **验证**：WXML 标签栈 0 未闭合 / 错配、8 个事件函数与 JS 全匹配、7 个 CSS 变量全定义、WXSS 花括号配对、3 个按钮槽位全包裹、`btn-slot` 固定 basis 与 input `flex:1 1 0` 断言通过、`npm test` 9/9、`npm run smoke` 56/56、`git diff --check` 全过。真机需复看：两个表单的保存按钮应与「编辑 / 删除」同宽（约 120rpx），输入框占满剩余，无溢出。

**v1.42 技能页脚注说明改为左右两端对齐（截图反馈）**
- **问题**（用户截图 + 原话）：「我截图的这个内容，要向两边对齐，现在左边空隙太大了」。v1.40 把灰字脚注用 `padding-left:calc(96rpx + var(--space-md))` 缩进到输入列，左侧空出 120rpx，在窄卡片里显得空荡。
- **修法**：`.skill-tip` 去掉左缩进（`padding:var(--space-md) 0 0`），文字铺满卡片内容区左右边界，并加 `text-align:justify` 两端对齐；分隔线仍横跨整行，靠 `border-top` + 上间距与表单区分，不靠缩进表达从属。
- **规范**：§8 单字段表单条的脚注描述由「缩进到输入列」改为「左右与卡片内容区对齐、不缩进、两端对齐」。
- **验证**：WXSS 花括号配对、缩进已移除与 `text-align:justify` 断言通过、`npm test` 9/9、`git diff --check`。真机需复看灰字左右贴齐卡片内容区。

**v1.43 技能页编辑区去掉提示与底色（截图反馈）**
- **问题**（用户截图 + 原话）：「这里不需要提示：正在编辑，因为上面就是它的名字，为什么它采用了一个不同的底色？这很不和谐」。
- **修法**：`skills.wxml` 删掉 `<view class="skill-edit__hint">正在编辑：{{item.name}}</view>`；`skills.wxss` 删掉 `.skill-edit__hint` 整条样式、`.skill-edit` 去掉 `background:var(--color-primary-light)` 与 `border-radius`，只保留 `border-left:3rpx` 竖线 + 缩进标明从属。
- **规范**：§8「编辑态走展示行下方缩进展开」条改为「仅竖线 + 缩进，不加底色、不加正在编辑提示」。
- **验证**：WXML 标签闭合、渲染节点零 `正在编辑` / 零 `skill-edit__hint`（仅注释保留说明）、底色已移除、竖线保留、WXSS 花括号配对、`npm test` 9/9、`git diff --check`。

**v1.44 查看页头部统一：赛季并入标题卡右半行 + 排行榜排序独占一行（本轮）**
- **需求**（用户截图 + 原话）：「统一对局，高光，排名的 head 区域的格式……排名多一个排序，单独把排序作为一行，然后把赛季选择直接集成到现在的 header 的右半部分」。
- **问题**：改前对局 / 高光是「标题卡 + 赛季筛选裸行（`.form-row.head-filters`）」，排名是「标题卡（右侧只是不可点的 `scopeLabel` 灰字）+ 筛选卡（赛季 / 排序两格并排）」——三页头部不同构，且「全部赛季」在两处重复出现。
- **落地**：① `app.wxss` 用 `.head-row / .head-row > .title / .head-season-picker` 取代已无引用的 `.head-filters`；标题卡内一行左标题、右赛季 picker（`flex:0 1 320rpx`，`.picker-value` 紧凑内距 + `min-height:56rpx` 满足最小可点高度，值右对齐贴箭头）。② `matches.wxml` / `highlights.wxml` 删掉独立赛季筛选行，picker 移入标题卡；`leaderboard.wxml` 同构改造并删掉 `scopeLabel` 灰字。③ 排行榜筛选卡只保留 `.form-row.sort-row`（排序标签 + `.picker-right` 通栏），排序独占整行；`wx:if="{{seasons.length}}"` 从筛选卡移除（排序须常显）。④ `leaderboard.wxss` 删 `.lb-title-row / .filter-row / .filter-cell`，新增 `.sort-row{margin-bottom:0}`；`leaderboard.js` 删 `scopeLabel` 数据与 `recompute()` 中的计算。数据口径（全部赛季默认、按季过滤、排序键）零改动。
- **规范**：§7.1「结构」条、§8「查看类页面统一赛季上下文」条同步改写；历史 v1.4 记录保留备查（描述的是当时的实现）。
- **验证**：3 个 WXML 标签栈 0 未闭合 / 0 错配；`app.wxss` 150/150、排行榜 25/25、对局 58/58 花括号配对；三页各 1 个 `.head-row` + 1 个 `.head-season-picker`、仅排行榜多 1 个 `.sort-row`；`.head-filters / .lb-title-row / .filter-row / .filter-cell / scopeLabel` 全仓零残留；`node --check`、`npm test` 9/9、`npm run smoke` 56/56、`git diff --check` 全过。真机需在微信开发者工具复看：三页标题卡左标题 / 右赛季选择器对齐一致、8 字赛季名不折行，排行榜排序控件通栏独占一行。
- **注**：本轮开始时规范状态为 v1.43（技能页编辑区去底色），顺延 v1.44；全部按唯一字符串锚定，未触碰工作区中并行会话的其它改动。

**v1.45 技能赛一人一技能（截图需求：记分台技能不能重复选取）**
- **需求**（用户原话）：「记分台中，技能不能重复选取」。改前技能 picker 的 `range` 直接用全量 `skills` / `edit.skills`，同一技能可被多个玩家重复选；服务端 `createMatch` / `updateMatch` 也不校验重复。
- **落地**：① `utils/match-form.js` 新增 `isSkillTaken` / `rebuildAvailableSkills`（逐行可用技能 + 先到先得消重 + 字典空时保留历史值），`rebuildAvailable(players, camps, skills)` 扩展第三参数；`validateForm` 增加重复与技能不足硬错误，导出 `WARN_SKILL_DUP`。② 计分页 `scoring.wxml/js`：picker 改挂 `p.availableSkills`，`wx:elif` 提示「无可用技能」；`onSkillPick` 按行内列表取值 + 占用守卫 + 一次 setData 重建；`rebuildAvailable()` 同步重建技能下拉；`validate` / `submit` 按「未添加 → 数量不足 → 重复 → 未选」优先级拦截。③ 对局编辑页同口径：`matches.wxml/js` 行内列表、`editOnSkillPick` 守卫、`editSync` 传 `ed.skills` 重建；`buildEditState` 修正 `withSkillIndex` 与 `rebuildAvailableSkills` 的先后（否则行内下标错位）。④ `lib/api.js` 增 `assertUniqueSkills`，create / update 两处调用；普通赛继续强制置空。⑤ `scripts/smoke.js` 技能字典增至 5 个（第 5 个专供删除测试）、技能赛对局改用 4 个不同技能，新增「同一局内技能重复被拒绝」断言。
- **规范**：§6「条件技能行」后新增「技能唯一性」条，写明四层防线与下标顺序红线。历史 v1.12 技能门控记录保留备查。
- **验证**：纯函数断言 7/7（逐行排除、本行回显、重复消重、占用守卫、重复/不足校验、正常放行）；服务端断言 5/5（create 拒绝、正常创建、update 拒绝、普通赛放行）；`node --check` 4 个 JS、`npm test` 9/9、`npm run smoke` 57/57、WXML 标签栈平衡且两页均无残留全量字典 picker、`git diff --check` 全过。真机待复看：连选两行不同技能后第一行下拉不再出现已选技能、末行无技能时提示「技能已选完」且保存按钮置灰。

**v1.46 技能行 UI：共享列网格 + 三态视觉分级（截图反馈：「技能」提示突兀）**
- **需求**（用户原话）：「优化记分台每个玩家的信息录入界面，尤其是『技能』提示有点突兀」。截图显示改前技能行是「80rpx 裸标签 + 通栏灰底长条」，与上方「216rpx 选择玩家块 + 得分块」不同列、比例失衡；空态「还没有技能，点此添加」复用真实选择器的灰底大块，像已填字段而非动作入口。
- **诊断**：① 列错位——标签 80rpx vs 玩家 picker 216rpx，两行不共用列网格；② 语义错位——空态伪装成输入框；③ 三态同貌——有技能 / 选完 / 无字典都用灰底块，无法区分。
- **落地**（`app.wxss` + 两页 `.wxml`，JS / 数据层零改动）：① `.skill-label` 改 `flex:0 0 216rpx` + `text-align:right` + `--font-size-sm`，与玩家 picker 共用列、「技能」紧贴技能值区形成「标签 → 值」组合，列右边缘与「选择玩家」块右边缘对齐，值区起点 232rpx 与「得分」框对齐；② 三态拆成独立 class——`.skill-picker-value`（灰底真实控件）/ `.skill-hint`（纯文字「技能已选完」）/ `.skill-add`（与选择框同尺寸的次文字灰虚线框「+ 添加技能」，`catchtap="goSkills"`），删除 `.skill-picker-empty`；③ 计分台与对局编辑页同步改造，保持两处同构。
- **验证**：两页 WXML 标签栈 0 未闭合 / 0 错配、`wx:if → wx:elif → wx:else` 链条完整；WXSS 花括号 151/151、28/28、58/58；旧类名与旧文案全仓零残留；`npm test` 9/9、`npm run smoke` 57/57、`git diff --check` 全过。真机待复看三态视觉与 216rpx 列对齐。

---

## 10. 后续建议
1. wxml 文字尽量挂语义类（`.title/.name/.muted/.tag`），减少裸 `<text>` 无字号。
2. 新增页面严格按本规范选用类，**禁止新增散写样式**；新一级入口先核 §8 是否突破 5 个 tab。
3. 可封装 nav-bar / empty / load-more 为自定义组件，进一步统一（参考组件库）。
4. 其他强语义场景（如对局卡、高光卡）如需专属视觉，请先在本规范 §7 补模板，再实施。
