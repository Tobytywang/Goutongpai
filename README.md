# 沟通牌 · 计分与赛季数据台

一个自托管的在线计分系统：录入每局分数、实时判定阵营胜负、按赛季统计排名，并记录玩家档案与高光时刻。

**零第三方依赖** —— 只用 Node.js 内置模块（`node:http` + `node:sqlite`），不需要 `npm install`，不存在装包失败或本地编译的问题。

---

## 一、计分规则（本系统的口径）

| 项目 | 规则 |
| --- | --- |
| 单副牌分值 | K = 10 分 ×4 张、10 = 10 分 ×4 张、5 = 5 分 ×4 张 → **每副牌正好 100 分** |
| 牌库总分 | 牌副数 × 100（2 副牌 = 200 分，3 副牌 = 300 分） |
| 获胜线 | 牌库总分的一半，且必须**严格超过**（2 副牌需 ≥ 101 分才算赢，正好 100 分不算） |
| 有效分 | 只有**把牌出完**的玩家，其分数才计入阵营总分；若全场都没人出完，有效分为 0 |
| 未出完分 | 没把牌出完的玩家手里的分数，不计入阵营总分、也不计入玩家成绩，仅用于单局对账（防漏录） |
| 胜负判定 | 某阵营满足任一即获胜：① 有效分严格超过获胜线；② 本阵营**全员都出完了牌**，且**存在对手阵营未全员出完**；支持 2～4 个阵营 |

**录入约束**（Web 计分台与小程序计分页实时校验，不满足则禁用保存；界面只显示「MVP 未设置」「获胜条件不满足」两条提示）：

1. 每局**恰好 1 名 MVP**：标记另一人会自动取消原选；
2. 上面两个获胜条件是**独立**的，但**不能两队同时达成**，以下都不合法：
   - 两个队伍都全员出完；
   - 两个队伍的有效分都过半；
   - 一个队伍全员出完、另一个队伍有效分过半。
3. 反过来也**不能一个获胜方都没有**：全场「都」没出完时没有有效分（那些分数只是未出完分），本局没打完，不能结算。

合起来即「**恰好 1 个获胜方，且全员出完的阵营最多 1 个**」；同一阵营既全员出完又过半只算一个获胜方，允许保存。

> 约束只加在两个录入界面（含保存前兜底）。服务端接口不强制，历史对局与演示数据不受影响。

### 对局类型与技能（技能赛）

录入每局时可选**对局类型**：`normal`（普通赛，默认）/ `skill`（技能赛）：

- 只有**技能赛**才会出现玩家技能选择；技能赛要求**每位玩家必选一个技能**，未填满则保存按钮置灰；
- 技能字典在「我的 → 设置 → 技能」独立页维护（新建 / 改名 / 删除，名称 ≤ 8 字），**被对局引用的技能禁止删除**（可改名，历史记录通过外键自动跟随）；
- 已录技能的技能赛**切回普通赛会立即清空所有技能**（先弹二次确认）；编辑对局时同样可以改类型；
- **服务端硬门控**：普通赛即使请求里带 `skill_id`，落库前也一律强制置空（`lib/api.js` 的 `normalizeSkillId`），前端 `wx:if` 被绕过也不会脏数据；
- 「每位玩家必填」按项目既有风格只做前端校验，服务端不强制，避免历史对局无法保存。

界面上每个数字都能对上账，三处闭合关系随时可核对：

```
单局：  出完牌的有效分 + 未出完牌分数 + 未录入分 = 牌库总分
玩家：  总得分 = 只在「把牌出完」的局里拿到的分数之和（未出完牌的分数不计入）
赛季：  Σ各局出完牌有效分 + Σ各局未出完分数 + Σ各局未录入分 = Σ牌库总分
```

对局记录页展开任意一局，都能看到这局的账目明细和闭合校验结果。

---

## 二、功能一览

| 页面 | 能力 |
| --- | --- |
| **计分台** | 选赛季 / 调牌副数 → 牌库总分与获胜线自动算出；左侧玩家池点选加入阵营（支持 2～4 个阵营、可改名换色）；每人录分数 + 勾选「出完后」+ 标记 MVP；阵营总分、是否过线、账目全部实时刷新；录到一半刷新页面不会丢（草稿存本地） |
| **总览** | 赛季关键数字（对局数 / 参与人数 / 总得分 / 未录入分）、赛季榜首、最近对局、最新高光 |
| **排行榜** | 7 种排序口径（胜局 / 胜率 / 总得分 / 场均得分 / 出完率 / MVP / 出场），可设「最少出场局数」门槛、支持跨赛季统计；表头点开有每个指标的口径定义 |
| **对局记录** | 逐局查看阵营比分、每人明细、账目闭合校验、备注；可删除单局；支持按玩家 / 阵营 / 桌号 / 备注搜索 |
| **玩家** | 昵称、玩家 ID、签名、**头像上传**、**个性照片上传**；带对局记录的玩家不允许直接删除，防止战绩缺失 |
| **高光时刻** | 图文时间线，7 种类型（逆风翻盘 / 神级配合 / 爆分时刻…），可关联对局与主角，支持现场配图 |
| **赛季** | 创建 / 编辑 / 归档 / 删除赛季，每赛季独立统计；删除赛季会级联清理对局，关联高光自动解绑保留 |

> 所有删除 / 移除类操作都要求**模态框二次确认**：Web 端走 `confirmDialog`（`public/js/util.js`），小程序端走统一的 `<confirm-modal>`（`miniprogram/components/confirm-modal/` + `utils/confirm.js`）。确认框会点名对象、列出可核对的详情与连带影响，取消、点遮罩或关闭一律不执行删除。

---

## 三、本地运行

需要 **Node.js ≥ 22.5**（内置 `node:sqlite` 的要求，用 `node -v` 确认）。

```bash
# Windows：双击 start.bat
# Linux / macOS：
sh start.sh

# 或者直接：
node server.js
```

启动后打开 <http://localhost:5178>。手机连同一个 WiFi 时，用电脑局域网 IP 也能访问（`http://192.168.x.x:5178`），记分员用手机录分很方便。

### 想要一份演示数据？

```bash
npm run demo      # 生成 1 个赛季 / 6 名玩家 / 8 局对局 / 4 条高光
```

只在数据库为空时执行。想清空重来，直接删掉 `data/` 目录即可。

### 自检

```bash
npm test          # 计分规则单元测试（9 项）
npm run smoke     # 端到端接口冒烟测试（56 项，用临时数据目录，不碰正式数据）
```

---

## 四、部署到云服务器

项目就是一个 Node 进程，数据和图片都在 `data/` 目录里。

### 方式 A：直接跑（最省事）

```bash
# 1. 上传项目（Git、scp、宝塔面板都行）
scp -r ./goutongpai user@your-server:/opt/

# 2. 服务器上装 Node 22+
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# 3. 启动
cd /opt/goutongpai
PORT=5178 node server.js
```

### 方式 B：用 PM2 常驻（推荐生产环境用）

```bash
npm install -g pm2
cd /opt/goutongpai
PORT=5178 pm2 start server.js --name goutongpai
pm2 save && pm2 startup     # 开机自启
pm2 logs goutongpai         # 看日志
pm2 restart goutongpai      # 更新代码后重启
```

### 方式 C：Docker（服务器环境不明时最稳）

```bash
docker build -t goutongpai .
docker run -d --name goutongpai -p 5178:5178 \
  -v goutongpai-data:/app/data \
  --restart unless-stopped \
  goutongpai
```

`-v` 把数据库和上传的图片挂到卷上，容器重建不会丢数据。

也可以用 `docker-compose.yml`（已随项目提供，只管应用容器 + 数据卷）：

```bash
docker compose build      # 构建镜像（改了代码后重跑）
docker compose up -d      # 起/更新容器，数据在具名卷 goutongpai-data
docker compose down       # 停容器（数据卷不丢）
```

HTTPS / 域名 / Basic Auth 仍在宿主机 Nginx 层做（见下方「配 Nginx 反向代理 + HTTPS」）。`docker-compose.yml` 里端口已绑 `127.0.0.1`，Node 不对外裸暴露。

### 配 Nginx 反向代理 + HTTPS

443 端口对外，Node 只监听本机：

```nginx
server {
    listen 443 ssl http2;
    server_name score.your-domain.com;

    ssl_certificate     /etc/letsencrypt/live/score.your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/score.your-domain.com/privkey.pem;

    client_max_body_size 20m;      # 上传照片需要，别漏

    location / {
        proxy_pass http://127.0.0.1:5178;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

证书用 `certbot --nginx` 一条命令签发即可。

**部署检查清单**

- [ ] `node -v` ≥ 22.5
- [ ] 端口 5178 在安全组 / 防火墙里放行（只走 Nginx 的话，Node 端口不需要对外开放）
- [ ] Nginx 配了 `client_max_body_size`（不配的话上传照片会 413）
- [ ] `data/` 目录有写权限
- [ ] 配了定时备份（见下）
- [ ] 如果要限制外人访问，在 Nginx 上加 Basic Auth：
      `htpasswd -c /etc/nginx/.htpasswd yourname`，然后在 `location /` 里加 `auth_basic` 两行

---

## 五、数据与备份

所有东西都在 `data/` 下：

```
data/
├── goutongpai.db         # SQLite 数据库（赛季/玩家/对局/分数/高光/技能字典）
├── goutongpai.db-wal     # WAL 日志（正常运行中会有）
└── uploads/              # 上传的头像与照片
```

核心表关系：`matches.type`（`normal`/`skill`）→ 技能赛下 `scores.skill_id` 外键指向 `skills(id)`（`ON DELETE SET NULL`）；旧库首次启动会自动幂等迁移补列。

备份 = 复制整个 `data/` 目录。SQLite 开了 WAL，直接 `cp` 也安全；想更稳可以：

```bash
sqlite3 data/goutongpai.db ".backup 'backup-$(date +%F).db'"
```

或用脚本自带的一键备份（Windows / Linux 通用）：

```bash
npm run backup
```

### 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `5178` | 监听端口 |
| `HOST` | `0.0.0.0` | 监听地址 |
| `GTP_DATA_DIR` | `./data` | 数据目录，Docker 挂载卷时用 |
| `BASE_URL` | `http://localhost:<PORT>` | 只影响启动日志里的提示文字 |

---

## 六、目录结构

```
.
├── server.js               # HTTP 服务：路由分发 + 静态资源（零依赖）
├── lib/
│   ├── db.js               # SQLite 连接与建表（node:sqlite）
│   ├── score.js            # 计分核心逻辑（纯函数，带自检）
│   └── api.js              # 业务处理：增删改查 + 图片落盘
├── public/
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── app.js          # 入口与路由
│       ├── store.js        # 全局状态
│       ├── api.js          # 接口封装
│       ├── stats.js        # 统计口径（排行榜每个数字的来源）
│       ├── util.js         # DOM / 压缩 / 弹窗 / 提示
│       ├── forms.js        # 复用表单
│       └── views/          # 7 个页面视图
├── scripts/
│   ├── demo.js             # 演示数据生成
│   ├── smoke.js            # 端到端冒烟测试
│   └── ui-check.js         # 界面回归截图（需 Chrome 调试端口）
├── test/score.test.js
├── data/                   # 运行时生成：数据库 + 上传图片（记得备份）
└── Dockerfile / start.bat / start.sh
```

---

## 七、接口一览

所有接口返回 `{ ok: true, data }` 或 `{ ok: false, error }`。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 健康检查 |
| GET | `/api/bootstrap` | 一次性拉取全部数据（前端启动时用） |
| POST / PUT / DELETE | `/api/players[/:id]` | 玩家增删改 |
| POST | `/api/players/:id/avatar` | 上传头像（body: `{ dataUrl }`） |
| POST | `/api/players/:id/photo` | 上传个性照片 |
| GET / POST / PUT / DELETE | `/api/seasons[/:id]` | 赛季增删改查 |
| GET / POST / PUT / DELETE | `/api/skills[/:id]` | 技能字典增删改查（body: `{ name, sort_order? }`；名称 ≤ 8 字、全局唯一；被 `scores.skill_id` 引用时删除报错，bootstrap 下发 `usageCount`） |
| GET / POST / PUT / DELETE | `/api/matches[/:id]` | 对局增改删查（创建与编辑时后端重新计算阵营总分和胜负，不信任前端；`POST` 可带 `type: normal \| skill`；`PUT` 接受 `type` 与 `camps[].players[].skill_id`，日期 / 局次 / 牌副数 / 赛季 / 阵营结构保持不变，不传 `type` 时保持原值） |
| GET / POST / PUT / DELETE | `/api/highlights[/:id]` | 高光时刻增删改查 |

图片上传走 `data URL` 提交，前端会用 canvas 先压缩（头像长边 320px、照片 1280px），单张上限 8MB。

---

## 八、常见问题

**Q：端口被占用怎么办？**
`PORT=5179 node server.js`，或者按上面清单排查占用进程。

**Q：为什么正好 100 分不算赢？**
规则是「超过一半」。2 副牌总分 200，一半是 100，所以必须 101 分以上。系统严格按这个判定，游戏里会显示「需要 > 100」。

**Q：录入时发现某个玩家不在列表里？**
计分台每个阵营下面有「+ 新建」按钮，可以现场登记新人并直接加入本局。

**Q：录错了怎么办？**
还没保存就直接改；已经保存的，在小程序「对局」页找到那一局，点卡片上的「编辑」按钮内联修改各阵营的玩家、分数、已出完、MVP 与**对局类型**（普通赛 ⇄ 技能赛，切回普通赛会清空技能），保存后后端会重算阵营总分与胜负，排行榜同步更新。日期、当日第几局、牌副数、赛季和阵营结构不可修改。若整局录错，仍可点「删除」后重录（删除会同步从所有排行榜统计中移除）。

**Q：想改玩家的头像/照片？**
「玩家」页每张卡片上都有「换头像」「上传照片」按钮。

**Q：能同时给两个阵营算分吗（三分阵营）？**
可以。计分台右下角有「+ 添加阵营」，最多支持 4 个阵营。

**Q：数据会不会丢？**
数据存在服务器本地的 SQLite 文件里，不依赖任何第三方服务。请定期备份 `data/` 目录，就这么简单。
