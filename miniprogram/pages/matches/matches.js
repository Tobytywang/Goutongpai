// 对局列表（复用 bootstrap.matches，与 Web 端同一数据源；按赛季过滤，默认「全部赛季」）
const { get, put, del, getBootstrap } = require('../../utils/request');
const { confirmOn } = require('../../utils/confirm');
const { withAllSeason } = require('../../utils/season');
const { buildShare, enableShareMenu } = require('../../utils/share');
const matchForm = require('../../utils/match-form');
const { anchoredScrollTop } = require('../../utils/scroll-anchor');

Page({
  data: {
    seasons: [],
    seasonIndex: 0,
    seasonId: null,
    allMatches: [],
    matches: [],
    players: [],
    skills: [],
    loading: true,
    // 卡片内联编辑：同一时刻只允许一张卡展开
    editingId: null,
    edit: null,
    // 编辑抽屉（挂在页脚之后）：max-height 由实测高度给出，见 measureDrawer
    drawerOpen: false,
    drawerMaxHeight: '0px',
  },

  onShow() {
    enableShareMenu();
    // 从技能维护页返回：只同步技能字典，避免整页重刷把未保存的比分冲掉
    if (this._skillsDirty) {
      this._skillsDirty = false;
      if (this.data.editingId != null) {
        this.syncSkills();
        return;
      }
    }
    // 编辑态下不重刷列表，避免正在编辑的卡片被重排、未保存改动丢失
    if (this.data.editingId == null) this.load();
  },

  onPullDownRefresh() {
    if (this.data.editingId != null) {
      wx.stopPullDownRefresh();
      wx.showToast({ title: '请先保存或取消编辑', icon: 'none' });
      return;
    }
    this.load(true).then(() => wx.stopPullDownRefresh());
  },

  async load(force, opts) {
    // 编辑保存后保持用户当前选中的赛季，不跳回「全部赛季」
    const preserve = !!(opts && opts.preserveFilter);
    const keepIndex = preserve ? this.data.seasonIndex : 0;
    const keepId = preserve ? this.data.seasonId : null;
    this.setData({ loading: true });
    try {
      const d = await getBootstrap(force);
      const players = d.players || [];
      const playerMap = new Map(players.map((p) => [p.id, p]));
      const all = (d.matches || []).map((m) => ({
        ...m,
        camps: (m.camps || []).map((c) => ({
          ...c,
          players: (c.players || []).map((p) => ({
            ...p,
            name: (playerMap.get(p.player_id) && playerMap.get(p.player_id).name) || `玩家${p.player_id}`,
          })),
        })),
      }));

      // 计算「当日第 N 局」：按 played_at 分组，组内按 id 升序
      const dateGroup = new Map();
      all.forEach((m) => {
        if (!dateGroup.has(m.played_at)) dateGroup.set(m.played_at, []);
        dateGroup.get(m.played_at).push(m);
      });
      dateGroup.forEach((list) => {
        list.sort((a, b) => a.id - b.id);
        list.forEach((m, i) => (m.daily_index = i + 1));
      });
      this.setData({
        seasons: withAllSeason(d.seasons || []),
        players,
        skills: d.skills || [],
        seasonIndex: keepIndex,
        seasonId: keepId,
        allMatches: all,
        matches: keepId == null ? all : all.filter((m) => m.season_id === keepId),
        loading: false,
      });
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: e.message, icon: 'none' });
    }
  },

  onSeasonChange(e) {
    // 切换赛季会过滤掉正在编辑的卡片，先收起，避免编辑态残留
    if (this.data.editingId != null) this.cancelEdit();
    const i = Number(e.detail.value);
    const id = this.data.seasons[i] ? this.data.seasons[i].id : null;
    const all = this.data.allMatches;
    this.setData({
      seasonIndex: i,
      seasonId: id,
      matches: id == null ? all : all.filter((m) => m.season_id === id),
    });
  },

  // 删除本局：统一走应用内模态框二次确认（展示局号/比分/影响，取消即中止）
  async deleteMatch(e) {
    const id = Number(e.currentTarget.dataset.id);
    if (this._deleting) return;
    const m = (this.data.allMatches || []).find((x) => x.id === id);
    const campText = m
      ? (m.camps || []).map((c) => `${c.name} ${c.total_score} 分`).join(' / ')
      : '—';
    const ok = await confirmOn(this, {
      title: '删除本局记录',
      content: `确认删除第 #${id} 局记录？`,
      details: [
        { label: '对局时间', value: m ? m.played_at : '—' },
        { label: '局次 / 牌副', value: m ? `当日第 ${m.daily_index} 局 · ${m.deck_count} 副` : '—' },
        { label: '本局比分', value: campText },
      ],
      warning: '删除后该局分数将从所有排行榜与赛季统计中移除，关联高光会被解绑，且不可恢复。',
      confirmText: '删除本局',
      danger: true,
    });
    if (!ok) return;
    this._deleting = true;
    try {
      await del(`/api/matches/${id}`);
      wx.showToast({ title: '已删除', icon: 'success' });
      if (this.data.editingId === id) {
        this._edit = null;
        this.setData({ editingId: null, edit: null, drawerOpen: false, drawerMaxHeight: '0px' });
      }
      this.load();
    } catch (err) {
      wx.showToast({ title: err.message || '删除失败', icon: 'none' });
    } finally {
      this._deleting = false;
    }
  },

  // ---------------------------------------------------------------- 卡片内联编辑（仅比分相关）
  noop() {},

  // ------------------------------------------------------------ 滚动锚定 / 贴底钉住
  // 两类位移都要处理：
  // ① 跨卡切换：A 抽屉被 wx:if 立刻销毁，A 卡片变矮 H，文档流里 B 及之后
  //    所有内容（含刚点的按钮）上移 H → 前后各测一次 B 卡片 top，把差值补进 scrollTop。
  // ② 页面贴底（列表最后一张卡）：抽屉撑高 / 收回会改变**页面总高度**，
  //    而 scrollTop 正贴着上限 pageHeight - 视口高。变高时系统「自动贴底」把
  //    scrollTop 拉上去，变矮时又夹回新上限，上方内容整体跳动。这类改写
  //    补一次不够（动画期间逐帧发生），故在展开窗口内把 scrollTop 钉在目标值；
  //    钉住后收起时页面高度回落，scrollTop 正好仍在合法范围内，不会再被夹断。
  // 用卡片顶部而非按钮作锚点：展示态比分块始终保留，卡片顶部到按钮的距离两态一致，
  // 两者位移完全相同，也就不必给按钮另加 id（卡片已有 #match-{{id}}）。
  onPageScroll(e) {
    const s = e && e.scrollTop;
    if (typeof s !== 'number') return;
    this._lastScrollTop = s;
    const pin = this._pinScrollTop;
    if (pin == null) return;
    if (Date.now() > this._pinUntil) { this._pinScrollTop = null; return; }
    if (Math.abs(s - pin) > 1) {
      // duration:0 立刻拉回；pageScrollTo 会再触发本钩子，值相等后自然停下
      wx.pageScrollTo({ scrollTop: pin, duration: 0 });
    }
  },

  // 关键帧主动钉一次（setData 完成、抽屉高度开始变化、动画收尾）
  pinScroll() {
    if (this._pinScrollTop == null || Date.now() > this._pinUntil) return;
    wx.pageScrollTo({ scrollTop: this._pinScrollTop, duration: 0 });
  },

  readAnchor(id) {
    return new Promise((resolve) => {
      const q = wx.createSelectorQuery().in(this);
      q.select('#match-' + id).boundingClientRect();
      q.selectViewport().scrollOffset();
      q.exec((res) => {
        const card = res && res[0];
        const vp = res && res[1];
        resolve(card && vp ? { top: card.top, scrollTop: vp.scrollTop } : null);
      });
    });
  },

  restoreAnchor(id, before, seq) {
    const q = wx.createSelectorQuery().in(this);
    q.select('#match-' + id).boundingClientRect();
    q.selectViewport().scrollOffset();
    q.exec((res) => {
      // 测量是异步的：期间又切了别的卡、已收起、已保存，这次补偿必须作废，
      // 否则会把页面滚到一个和当前界面无关的位置
      if (seq !== this._anchorSeq || this.data.editingId !== id || !before) return;
      const card = res && res[0];
      const vp = res && res[1];
      if (!card || !vp) return;
      const raw = vp.scrollTop + (card.top - before.top);
      const target = anchoredScrollTop(before.top, card.top, vp.scrollTop);
      // 补偿后的 scrollTop 就是接下来展开动画期间要钉住的值
      if (raw < 0) {
        // scrollTop 不够扣（页面已接近顶部），只能补到 0，残余位移用短过渡摊开；
        // 过渡期间不钉住，否则会和滚动动画抢位置
        this._pinScrollTop = null;
      } else {
        this._anchorScrollTop = target;
        this._pinScrollTop = target;
        this._pinUntil = Date.now() + 380;
      }
      if (Math.abs(target - vp.scrollTop) < 1) return;
      // duration 必须显式给 0：默认 300ms 会把补偿变成一段看得见的滚动
      wx.pageScrollTo({ scrollTop: target, duration: raw < 0 ? 160 : 0 });
    });
  },

  // 测量抽屉内容高度后再展开：页脚按钮与其上方内容全程不动，
  // 抽屉从 max-height:0 过渡到实测值，视觉上就是「从按钮下方向下展开」。
  // 不能写死一个大 max-height——折叠动画的前半段会完全看不出变化。
  measureDrawer() {
    const q = wx.createSelectorQuery().in(this);
    q.select('.match-edit-drawer__inner .footer-preview').boundingClientRect();
    q.select('.match-edit-drawer__inner .match-edit-form').boundingClientRect();
    q.select('.match-edit-drawer__inner').boundingClientRect();
    q.exec((res) => {
      // 测量期间用户可能已点「收起」：不能再把折叠中的抽屉撑开
      if (this._drawerClosing || this.data.editingId == null) return;
      const preview = res && res[0];
      const form = res && res[1];
      const inner = res && res[2];
      // 取两块内容的**外包络**（上沿取小、下沿取大），不假设谁在上谁在下：
      // v1.36 起「本局预览 + 保存」从表单上方移到表单下方，原先写死
      // `form.bottom - preview.top` 会得到负值，抽屉直接展不开。
      // 包络高度同时把两块之间的 margin 含进来；inner.height 不含子元素 margin，只作兜底。
      let h = 0;
      if (preview && form) {
        const top = Math.min(preview.top, form.top);
        const bottom = Math.max(preview.bottom, form.bottom);
        h = Math.ceil(bottom - top);
      }
      if (!h && inner) h = Math.ceil(inner.height);
      // 过渡到的高度多留 8px：测量时 __inner 还带着 translateY(-8rpx)（=4px CSS），
      // 内容整体偏上，max-height 卡在实测值时底部的「保存修改」会被裁掉一截
      // （实测裁掉 12.5rpx：8rpx 位移 + 原有的 2px 余量没盖住）。多留的量只影响
      // 展开动画的收尾快慢（差 1%），不影响最终布局——max-height 大于内容时不会撑高盒子。
      this._drawerHeight = h > 0 ? h + 8 : 0;
      this.setData({
        // 测量失败退回 none：宁可没有动画，也不能把编辑内容裁成 0 高
        drawerMaxHeight: h > 0 ? h + 8 + 'px' : 'none',
        drawerOpen: true,
      }, () => {
        // 抽屉高度从 0 变成实测值的这一帧，页面总高度开始增长：贴底时系统会
        // 自动拉走 scrollTop，主动钉一次；动画期间的逐帧改写由 onPageScroll 兜住
        this.pinScroll();
        // 展开动画结束后彻底解除 max-height：之后内容再变高（加玩家 / 切技能赛 /
        // 提示行出现）都不会被裁，也就不需要在 editSync 里反复重量。
        if (!this._drawerHeight) return;
        clearTimeout(this._drawerRelease);
        this._drawerRelease = setTimeout(() => {
          if (!this.data.drawerOpen || this.data.editingId == null) return;
          this.setData({ drawerMaxHeight: 'none' }, () => this.pinScroll());
        }, 320);
      });
    });
  },

  async openEdit(e) {
    const id = Number(e.currentTarget.dataset.id);
    if (this._saving) return;
    if (this.data.editingId === id) { this.cancelEdit(); return; }
    // 切换目标（而非同卡展开）才会引起其它卡片高度变化，只有这条路径需要锚定补偿
    const switching = this.data.editingId != null;
    if (switching) {
      wx.showToast({ title: '已切换编辑目标，上一局未保存的修改已丢弃', icon: 'none' });
    }
    let m;
    try {
      // 编辑前读权威数据：bootstrap 有 8s 缓存，可能不是最新
      m = await get(`/api/matches/${id}`);
    } catch (err) {
      wx.showToast({ title: err.message || '读取对局失败', icon: 'none' });
      return;
    }
    let players = this.data.players || [];
    let skills = this.data.skills || [];
    if (!players.length) {
      try {
        const d = await getBootstrap(true);
        players = d.players || [];
        skills = d.skills || [];
      } catch (err) { players = []; }
    }
    // 第三个参数传技能字典：用于回填 picker 下标，并按新字典清理已失效的历史技能
    this._edit = matchForm.buildEditState(m, players, skills);
    // 所有路径都记锚点：切换时用 restoreAnchor 补偿重排；同卡展开时用它把
    // scrollTop 钉在点击前的值，抵消贴底时「页面变高被自动拉走」的改写。
    // 必须放在 setData 之前、且尽量靠近它：接口请求期间用户可能继续滑动，
    // 早测会拿到过期坐标。
    const anchor = await this.readAnchor(id);
    const seq = (this._anchorSeq = (this._anchorSeq || 0) + 1);
    this._anchorScrollTop = anchor ? anchor.scrollTop : null;
    this._pinScrollTop = anchor ? anchor.scrollTop : null;
    // 覆盖 30ms 测量 + 280ms 展开动画 + 余量；窗口结束即解除，用户可自由滚动
    this._pinUntil = Date.now() + 380;
    // 不再把卡片滚到顶部（原 scrollToCard 是点击编辑时整体位移的根因）。
    // 但「切换目标」时允许一次瞬时 pageScrollTo 补偿，见 restoreAnchor：
    // 它抵消的是上一张卡抽屉销毁造成的重排，补完按钮仍在原屏幕位置。
    // 先以 0 高渲染抽屉，隔一帧测量后改 max-height，transition 才会触发。
    clearTimeout(this._drawerTimer);
    this._drawerClosing = false;
    this._drawerHeight = 0;
    clearTimeout(this._drawerCleanup);
    this.setData({
      editingId: id,
      edit: this._edit,
      drawerOpen: false,
      drawerMaxHeight: '0px',
    }, () => {
      // 视图已按新 editingId 渲染完：切换时补回重排掉的滚动量，
      // 同卡展开则直接把 scrollTop 钉在点击前的值
      if (switching && anchor) this.restoreAnchor(id, anchor, seq);
      else this.pinScroll();
      // 与折叠共用一个 timer 句柄：30ms 内点收起时，测量会被一起取消
      this._drawerTimer = setTimeout(() => this.measureDrawer(), 30);
    });
  },

  cancelEdit() {
    if (this.data.editingId == null) return;
    // 收起期间 editingId 还要留 300ms 供退出动画用，光靠 editingId 守卫挡不住
    // 挂起的锚定补偿，这里显式作废旧序号，避免收起时页面又被滚一下
    this._anchorSeq = (this._anchorSeq || 0) + 1;
    // 解除钉住：折叠时页面高度逐帧回落，scrollTop 若曾被用户滚到更下方，
    // 让它随 maxScroll 自然平滑回位；用户没滚过的话 scrollTop 仍等于点击前的值，
    // 全程都 ≤ maxScroll，不会被夹断，按钮也就不动。
    this._pinScrollTop = null;
    this._edit = null;
    this._drawerClosing = true;
    // 先折叠、后销毁：wx:if 节点必须留到动画播完，否则没有退出动画。
    // 折叠期间 editingId 仍在 → 按钮保持「收起」且位置不动，内容向上收回。
    clearTimeout(this._drawerTimer);
    clearTimeout(this._drawerRelease);
    // 展开动画结束后 max-height 已被置为 none，而 none → 0px 不可插值（会直接跳没），
    // 所以先落回实测高度、下一帧再归零，才保留「向上收回」的动画。
    if (this._drawerHeight > 0) {
      this.setData({ drawerMaxHeight: this._drawerHeight + 'px' }, () => {
        this._drawerTimer = setTimeout(() => {
          // 同时摘掉 is-open：opacity 1→0 与 translateY 回退跟折叠并行，才有「向上收回」的观感
          this.setData({ drawerOpen: false, drawerMaxHeight: '0px' });
        }, 20);
      });
    } else {
      this.setData({ drawerOpen: false, drawerMaxHeight: '0px' });
    }
    this._drawerCleanup = setTimeout(() => {
      this._drawerClosing = false;
      this.setData({ editingId: null, edit: null, drawerOpen: false, drawerMaxHeight: '0px' });
    }, 300);
  },

  // 统一刷新编辑态：可用玩家下拉、锁定标记、小计、实时预览与校验
  editSync(camps) {
    if (!this._edit) return;
    const ed = this._edit;
    // 锁定标记按「当前阵营数 + 行号」重算：增删玩家会让后续行前移，必须每次刷新，
    // 否则删掉第 4 行后第 4 行（原第 5 行）仍带着可删状态
    ed.camps = matchForm.calcCampSubtotals(
      matchForm.applyPlayerLocks(matchForm.rebuildAvailable(this.data.players || [], camps, ed.skills))
    );
    ed.result = matchForm.computePreview(ed.camps, ed.deckCount);
    const v = matchForm.validateForm(ed.camps, ed.deckCount, ed.type, ed.skills);
    ed.hardErrors = v.hardErrors;
    ed.constraintWarns = v.constraintWarns;
    ed.ruleWarnText = v.ruleWarnText;
    ed.canSubmit = v.canSubmit;
    // 不再在内容变化后重量抽屉：展开动画结束即把 max-height 置为 none（见 measureDrawer），
    // 内容长高不会被裁，也就省掉了「每改一次结构就查一次选择器」的开销。
    this.setData({ edit: ed });
  },

  // 切换对局类型：技能赛 → 普通赛时立即清空已选技能，有值先二次确认（与计分页同口径）
  async editOnTypeChange(e) {
    if (!this._edit) return;
    const ed = this._edit;
    const typeIndex = Number(e.detail.value);
    const next = (ed.typeOptions[typeIndex] || {}).value;
    if (!next || next === ed.type) return;
    let camps = ed.camps;
    if (next === 'normal') {
      const hasSkill = camps.some((c) => c.players.some((p) => p.skillId != null));
      if (hasSkill) {
        const ok = await confirmOn(this, {
          title: '切换为普通赛',
          content: `第 #${ed.id} 局将改为普通赛，已录入的技能会被清空。`,
          details: [{ label: '对局类型', value: '技能赛 → 普通赛' }],
          warning: '所有已为玩家选择的技能将全部清除，保存后不可恢复。',
          confirmText: '清空并切换',
          danger: true,
        });
        if (!ok) return;
      }
      camps = matchForm.clearSkills(camps);
    }
    ed.type = next;
    ed.typeIndex = typeIndex;
    // 类型变化会改变「每位玩家必填」这条硬校验，必须走 editSync 刷新保存按钮
    this.editSync(camps);
  },

  editOnSkillPick(e) {
    if (!this._edit) return;
    const ed = this._edit;
    const ci = Number(e.currentTarget.dataset.camp);
    const pi = Number(e.currentTarget.dataset.pi);
    const idx = Number(e.detail.value);
    const row = ed.camps[ci].players[pi];
    // 与计分页同一口径：下拉只列未被占用的技能，选中时再守一道防过期列表
    const s = (row.availableSkills || [])[idx];
    if (!s) return;
    if (matchForm.isSkillTaken(ed.camps, s.id, ci, pi)) {
      wx.showToast({ title: matchForm.WARN_SKILL_DUP, icon: 'none' });
      return;
    }
    const camps = ed.camps.slice();
    const players = camps[ci].players.slice();
    players[pi] = Object.assign({}, players[pi], {
      skillId: s.id, skillIdx: idx, skillName: s.name,
    });
    camps[ci] = Object.assign({}, camps[ci], { players });
    // editSync 会重建所有行的可用技能，刚选中的技能立即从其它行下拉消失
    this.editSync(camps);
  },

  // 编辑态里技能字典为空时的入口：跳到独立技能页，返回后只同步字典
  goSkills() {
    this._skillsDirty = true;
    wx.navigateTo({
      url: '/pages/skills/skills',
      fail: (err) => {
        this._skillsDirty = false;
        console.error('navigateTo skills failed', err);
        wx.showToast({ title: err.errMsg || '打开失败', icon: 'none' });
      },
    });
  },

  // 只刷新技能字典并重算已选下标：不重建列表、不动玩家与比分
  async syncSkills() {
    try {
      const d = await getBootstrap(true);
      const skills = d.skills || [];
      this.setData({ skills });
      const ed = this._edit;
      if (!ed) return;
      ed.skills = skills;
      this.editSync(matchForm.withSkillIndex(ed.camps, skills));
    } catch (e) {
      // 拉取失败保持原状，用户仍可继续编辑，下次 onShow 会再试
    }
  },

  editAddPlayer(e) {
    if (!this._edit) return;
    const ci = Number(e.currentTarget.dataset.camp);
    const camps = this._edit.camps.slice();
    if (camps[ci].players.length >= 5) {
      wx.showToast({ title: '每个阵营最多5人', icon: 'none' });
      return;
    }
    camps[ci] = Object.assign({}, camps[ci], {
      players: camps[ci].players.concat(matchForm.emptyPlayer()),
    });
    this.editSync(camps);
  },

  editRemovePlayer(e) {
    if (!this._edit) return;
    const ci = Number(e.currentTarget.dataset.camp);
    const pi = Number(e.currentTarget.dataset.pi);
    const camps = this._edit.camps.slice();
    const players = camps[ci].players.slice();
    // 与计分页（scoring.js:removePlayer）同一兜底：最小玩家行不可删。
    // 界面上这些行的 ✕ 已渲染成 visibility:hidden 的占位，正常点不到
    if (!players[pi] || players[pi].locked) return;
    players.splice(pi, 1);
    camps[ci] = Object.assign({}, camps[ci], { players });
    this.editSync(camps);
  },

  editOnPlayerPick(e) {
    if (!this._edit) return;
    const ci = Number(e.currentTarget.dataset.camp);
    const pi = Number(e.currentTarget.dataset.pi);
    const availIdx = Number(e.detail.value);
    const row = this._edit.camps[ci].players[pi];
    const p = row.available[availIdx];
    if (!p) return;
    const camps = this._edit.camps.slice();
    const players = camps[ci].players.slice();
    players[pi] = Object.assign({}, players[pi], {
      playerId: p.id,
      playerName: p.name,
      playerIdx: p.id,
      available: [],
      availIdx: -1,
    });
    camps[ci] = Object.assign({}, camps[ci], { players });
    this.editSync(camps);
  },

  editOnScore(e) {
    if (!this._edit) return;
    const ci = Number(e.currentTarget.dataset.camp);
    const pi = Number(e.currentTarget.dataset.pi);
    const camps = this._edit.camps.slice();
    const players = camps[ci].players.slice();
    players[pi] = Object.assign({}, players[pi], { score: e.detail.value });
    camps[ci] = Object.assign({}, camps[ci], { players });
    this.editSync(camps);
  },

  // 失焦时把任意分数对齐到最近的 5 的倍数（与服务端 toScore 一致）
  editOnScoreBlur(e) {
    if (!this._edit) return;
    const ci = Number(e.currentTarget.dataset.camp);
    const pi = Number(e.currentTarget.dataset.pi);
    const raw = e.detail.value;
    const camps = this._edit.camps.slice();
    const players = camps[ci].players.slice();
    players[pi] = Object.assign({}, players[pi], {
      score: raw === '' ? '' : String(matchForm.roundTo5(raw)),
    });
    camps[ci] = Object.assign({}, camps[ci], { players });
    this.editSync(camps);
  },

  editOnFinished(e) {
    if (!this._edit) return;
    const ci = Number(e.currentTarget.dataset.camp);
    const pi = Number(e.currentTarget.dataset.pi);
    const camps = this._edit.camps.slice();
    const players = camps[ci].players.slice();
    players[pi] = Object.assign({}, players[pi], { finished: !players[pi].finished });
    camps[ci] = Object.assign({}, camps[ci], { players });
    this.editSync(camps);
  },

  editOnMvp(e) {
    if (!this._edit) return;
    const ci = Number(e.currentTarget.dataset.camp);
    const pi = Number(e.currentTarget.dataset.pi);
    const wasOn = !!this._edit.camps[ci].players[pi].mvp;
    // 每局恰好 1 名 MVP：全局单选，再点一次可取消
    const camps = this._edit.camps.map((c) => Object.assign({}, c, {
      players: c.players.map((p) => Object.assign({}, p, { mvp: false })),
    }));
    camps[ci].players[pi] = Object.assign({}, camps[ci].players[pi], { mvp: !wasOn });
    this.editSync(camps);
  },

  async submitEdit() {
    const ed = this._edit;
    if (!ed || this._saving || !ed.canSubmit) return;
    this._saving = true;
    ed.submitting = true;
    this.setData({ edit: ed });
    try {
      await put(`/api/matches/${ed.id}`, matchForm.buildPayload(ed));
      wx.showToast({ title: '已保存', icon: 'success' });
      this._edit = null;
      this.setData({ editingId: null, edit: null, drawerOpen: false, drawerMaxHeight: '0px' });
      // put 成功后 request.js 已失效 bootstrap 缓存；保留当前赛季筛选
      await this.load(true, { preserveFilter: true });
    } catch (err) {
      const msg = err.message || '保存失败';
      if (/对局不存在/.test(msg)) {
        // 编辑期间该局被他人删除，收起并刷新
        this._edit = null;
        this.setData({ editingId: null, edit: null, drawerOpen: false, drawerMaxHeight: '0px' });
        await this.load(true);
      }
      wx.showToast({ title: msg, icon: 'none' });
    } finally {
      this._saving = false;
      if (this._edit) {
        this._edit.submitting = false;
        this.setData({ edit: this._edit });
      }
    }
  },

  // 转发：全站统一分享内容（固定宣传语 + 落地排行榜），见 utils/share.js
  onShareAppMessage() {
    return buildShare();
  },
});
