/* 计分台：录入一局分数，实时判定阵营胜负 */

import { store } from '../store.js';
import { api } from '../api.js';
import {
  h,
  appendAll,
  avatarEl,
  notifyOk,
  notifyErr,
  confirmDialog,
  localToday,
  nextMatchSeq,
  debounce,
} from '../util.js';
import { promptNewPlayer } from '../forms.js';

const CAMP_PRESETS = [
  { name: '红队', color: '#d64545' },
  { name: '蓝队', color: '#3b7dd8' },
  { name: '绿队', color: '#2f9e63' },
  { name: '紫队', color: '#b165d4' },
];
const COLORS = ['#d64545', '#3b7dd8', '#2f9e63', '#b165d4', '#c98a00', '#1f7d4d', '#5b6272', '#c2410c'];
const MAX_CAMPS = 4;
const DRAFT_KEY = 'gtp:draft';
const HL_KINDS = ['逆风翻盘', '神级配合', '爆分时刻', '默契沟通', '首次达成', '名场面', '精彩瞬间'];

/* ---------------------------------------------------------------- 草稿 */

function blankCamps() {
  return [
    { name: CAMP_PRESETS[0].name, color: CAMP_PRESETS[0].color, players: [] },
    { name: CAMP_PRESETS[1].name, color: CAMP_PRESETS[1].color, players: [] },
  ];
}

function blankDraft(season) {
  const playedAt = localToday();
  return {
    seasonId: season ? season.id : null,
    deckCount: season ? season.deck_count : 2,
    tableName: '',
    playedAt,
    seq: nextMatchSeq(store.matches, playedAt),
    seqTouched: false, // 用户手改过序号后，换日期不再自动覆盖
    note: '',
    camps: blankCamps(),
    highlights: [],
  };
}

/** 恢复上一次没保存完的草稿，避免录到一半刷新丢了 */
function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.camps)) return null;

    // 过滤掉已被删除的玩家
    const validIds = new Set(store.players.map((p) => p.id));
    parsed.camps = parsed.camps.map((c) => ({
      name: String(c.name || '阵营'),
      color: c.color || '#1f7d4d',
      players: (c.players || [])
        .filter((p) => validIds.has(Number(p.player_id)))
        .map((p) => ({
          player_id: Number(p.player_id),
          score: p.score === '' || p.score === null || p.score === undefined ? '' : String(p.score),
          finished: !!p.finished,
          is_mvp: !!p.is_mvp,
        })),
    }));

    parsed.highlights = Array.isArray(parsed.highlights)
      ? parsed.highlights.map((x) => ({ ...x, player_ids: Array.isArray(x.player_ids) ? x.player_ids : [] }))
      : [];

    // 序号：草稿里没有或非法时，按当天已有对局重新推算
    const seq = Math.floor(Number(parsed.seq));
    if (!Number.isFinite(seq) || seq < 1) {
      parsed.seq = nextMatchSeq(store.matches, parsed.playedAt);
      parsed.seqTouched = false;
    } else {
      parsed.seq = seq;
      parsed.seqTouched = !!parsed.seqTouched;
    }

    const hasContent = parsed.camps.some((c) => c.players.length > 0);
    return hasContent ? parsed : null;
  } catch (_) {
    return null;
  }
}

const saveDraft = debounce((draft) => {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch (_) {
    /* 忽略配额问题 */
  }
}, 350);

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch (_) {
    /* 忽略 */
  }
}

/* ---------------------------------------------------------------- 计分（本地预览用）

   与后端 lib/score.js 同口径：牌库总分 = 副数 × 100，获胜线 = 一半，需「严格超过」。
   这里只负责实时预览，保存后的权威结果以后端返回为准。 */

const POINTS_PER_DECK = 100;

const deckTotalOf = (n) => n * POINTS_PER_DECK;
const winLineOf = (n) => Math.floor(deckTotalOf(n) / 2);
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

/** 得分对齐到最近的 5 的倍数（最小为 0），与小程序计分页规则一致 */
const roundTo5 = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n / 5) * 5;
};

/** 对局只记日期（YYYY-MM-DD），不记具体时刻 */
const fromDateInput = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(s || '') ? s : '');

/** 步进器：− 数字 +，固定宽度贴合内容（避免按钮右侧悬空） */
function makeStepper({ id, label, value, min = 0, max = 99, onSet }) {
  const clamp = (v) => Math.min(max, Math.max(min, Math.floor(Number(v) || min)));
  const input = h('input', {
    id,
    type: 'number',
    min,
    max,
    value,
    'aria-label': label,
    onchange: (e) => {
      const v = clamp(e.target.value);
      e.target.value = v;
      onSet(v);
    },
  });
  const step = (d) => {
    const v = clamp(Number(input.value) + d);
    input.value = v;
    onSet(v);
  };
  return {
    input,
    wrap: h(
      'div',
      { class: 'stepper' },
      h('button', { type: 'button', 'aria-label': `减少${label}`, onclick: () => step(-1) }, '−'),
      input,
      h('button', { type: 'button', 'aria-label': `增加${label}`, onclick: () => step(1) }, '+')
    ),
  };
}

/** 计入结算的有效分：只有把牌出完的人算数 */
function campBanked(camp) {
  return camp.players.filter((p) => p.finished).reduce((s, p) => s + num(p.score), 0);
}
/** 未出完牌、不计入阵营总分的分数 */
function campWasted(camp) {
  return camp.players.filter((p) => !p.finished).reduce((s, p) => s + num(p.score), 0);
}

/* ---------------------------------------------------------------- 主渲染 */

export function renderScoring(root) {
  root.innerHTML = '';

  if (store.seasons.length === 0) {
    root.append(
      h(
        'div',
        { class: 'card' },
        h(
          'div',
          { class: 'empty' },
          h('div', { class: 'empty__icon' }, '♠'),
          h('div', { class: 'empty__title' }, '先建一个赛季'),
          h('div', { class: 'empty__desc' }, '赛季用来归组对局、独立统计排行榜。'),
          h(
            'button',
            {
              class: 'btn btn--primary',
              type: 'button',
              onclick: () => {
                import('./seasons.js').then((m) => m.promptAndCreate(() => renderScoring(root)));
              },
            },
            '创建第一个赛季'
          )
        )
      )
    );
    return;
  }

  if (store.players.length === 0) {
    root.append(
      h(
        'div',
        { class: 'card' },
        h(
          'div',
          { class: 'empty' },
          h('div', { class: 'empty__icon' }, '👥'),
          h('div', { class: 'empty__title' }, '还没有玩家'),
          h('div', { class: 'empty__desc' }, '先登记牌友，之后录入对局时就能直接选人。'),
          h(
            'button',
            {
              class: 'btn btn--primary',
              type: 'button',
              onclick: () => promptNewPlayer({ onCreated: () => renderScoring(root) }),
            },
            '登记第一位玩家'
          )
        )
      )
    );
    return;
  }

  let draft = loadDraft();

  // 草稿的赛季若已不存在，回落到当前赛季
  if (draft && !store.seasonById(draft.seasonId)) draft = null;
  if (!draft) draft = blankDraft(store.currentSeason);

  /* ------------------------------------------------------- 页面骨架 */

  const seasonSelect = h(
    'select',
    {
      id: 'f-season',
      class: 'select',
      onchange: (e) => {
        const id = Number(e.target.value);
        const season = store.seasonById(id);
        draft.seasonId = id;
        if (season) draft.deckCount = season.deck_count; // 换赛季时牌副数跟随默认值
        deckInput.value = draft.deckCount;
        // 先落盘再切：store.setSeason 会触发一次整页重绘，重绘是从草稿恢复的
        persist();
        store.setSeason(id);
        refresh();
      },
    },
    store.seasons.map((s) =>
      h('option', { value: String(s.id), selected: s.id === draft.seasonId }, s.status === 'archived' ? `${s.name}（已归档）` : s.name)
    )
  );

  const seqStepper = makeStepper({
    id: 'f-seq',
    label: '第几局',
    value: draft.seq,
    min: 1,
    max: 99,
    onSet: (v) => {
      draft.seq = v;
      draft.seqTouched = true; // 手改过之后，换日期不再自动覆盖
      persist();
    },
  });

  const deckStepper = makeStepper({
    id: 'f-deck',
    label: '牌副数',
    value: draft.deckCount,
    min: 1,
    max: 10,
    onSet: (v) => {
      draft.deckCount = v;
      refresh();
      persist();
    },
  });
  const deckInput = deckStepper.input;

  const tableInput = h('input', {
    id: 'f-table',
    class: 'input',
    placeholder: '可不填',
    value: draft.tableName || '',
    oninput: (e) => {
      draft.tableName = e.target.value;
      persist();
    },
  });

  const timeInput = h('input', {
    id: 'f-time',
    class: 'input',
    type: 'date',
    value: (draft.playedAt || '').slice(0, 10),
    oninput: (e) => {
      draft.playedAt = fromDateInput(e.target.value);
      // 换了日期：没手改过序号就按新日期重新推算「第几局」
      if (!draft.seqTouched) {
        draft.seq = nextMatchSeq(store.matches, draft.playedAt);
        seqStepper.input.value = draft.seq;
      }
      persist();
    },
  });

  // 顺序：赛季 → 日期（默认当天）→ 第几局（默认当天递增）→ 牌副数 → 桌号
  const setupBar = h(
    'div',
    { class: 'setup-bar' },
    h('div', { class: 'field' }, h('label', { for: 'f-season' }, '赛季'), seasonSelect),
    h('div', { class: 'field' }, h('label', { for: 'f-time' }, '对局日期'), timeInput),
    h(
      'div',
      { class: 'field field--tight' },
      h('label', { for: 'f-seq', title: '默认取当天已录入的局数 +1，可手动改' }, '第几局'),
      seqStepper.wrap
    ),
    h(
      'div',
      { class: 'field field--tight' },
      h('label', { for: 'f-deck' }, '牌副数'),
      deckStepper.wrap
    ),
    h('div', { class: 'field' }, h('label', { for: 'f-table' }, '桌号 / 备注位置'), tableInput)
  );

  // 操作条：阵营 / 高光 两个建设性动作成组放在右侧（清空重录取到最底部保存行）
  const actionBar = h('div', { class: 'entry-bar' });
  const campsWrap = h('div', { class: 'camps' });
  const resultBar = h('div', { class: 'result-bar' });

  const hlPanel = buildHighlightsPanel();
  const alertBar = h('div', { class: 'alert-bar' });

  const card = h(
    'div',
    { class: 'card' },
    h(
      'div',
      { class: 'card__head' },
      h('h2', {}, '新建一局'),
      h('span', { class: 'hint' }, '填分数 → 勾选谁把牌出完 → 保存')
    ),
    setupBar,
    campsWrap,
    // 操作条（增加阵营 / 新增高光 / 清空重录）
    actionBar,
    // 高光录入面板：点「+ 新增高光」才展开，收起时靠上面的「高光待存」提示不漏记
    hlPanel.el,
    // 录入校验提示条：实时显示错误/警告，错误时禁用「保存本局」
    alertBar,
    resultBar
  );

  root.append(
    h(
      'div',
      { class: 'page-head' },
      h(
        'div',
        {},
        h('h1', {}, '计分台'),
        h('div', { class: 'sub' }, '牌库总分 = 牌副数 × 100；把「出完牌的人」的分数加起来超过一半即获胜；若某阵营全员出完、且对手没全出完，也算赢。')
      ),
      h(
        'div',
        { class: 'head-actions' },
        h(
          'button',
          {
            class: 'btn',
            type: 'button',
            onclick: () => promptNewPlayer({ onCreated: () => renderScoring(root) }),
          },
          '+ 新玩家'
        )
      )
    ),
    card
  );

  /* ------------------------------------------------------- 阵营渲染 */

  /** 每个阵营的 DOM 引用，便于局部刷新（不打断输入焦点） */
  const campViews = [];

  function unassignedPlayers() {
    const assigned = new Set(draft.camps.flatMap((c) => c.players.map((p) => p.player_id)));
    return store.players.filter((p) => !assigned.has(p.id));
  }

  function rebuildAllSelects() {
    const pool = unassignedPlayers();
    for (const cv of campViews) {
      const current = cv.select.value;
      cv.select.innerHTML = '';
      cv.select.append(h('option', { value: '' }, pool.length ? '选择玩家加入…' : '（暂无可选玩家）'));
      for (const p of pool) {
        cv.select.append(
          h('option', { value: String(p.id), selected: String(p.id) === current }, p.name)
        );
      }
      cv.select.disabled = pool.length === 0;
    }
  }

  function buildScoreRow(index, entry) {
    const camp = draft.camps[index];
    const player = store.playerById(entry.player_id);
    if (!player) return null;

    const scoreInput = h('input', {
      class: 'srow__score',
      type: 'number',
      min: 0,
      step: 5,
      value: entry.score,
      placeholder: '0',
      'aria-label': `${player.name} 的分数`,
      oninput: (e) => {
        entry.score = e.target.value;
        refresh();
        persist();
      },
      onblur: (e) => {
        // 失焦时对齐到 5 的倍数
        const rounded = roundTo5(e.target.value);
        entry.score = String(rounded);
        e.target.value = rounded;
        refresh();
        persist();
      },
      onfocus: (e) => e.target.select(),
    });

    const finishToggle = h(
      'button',
      {
        class: `srow__toggle${entry.finished ? ' is-on' : ''}`,
        type: 'button',
        title: '把牌出完了（只有出完牌，分数才计入阵营总分）',
        'aria-pressed': String(entry.finished),
        onclick: () => {
          entry.finished = !entry.finished;
          finishToggle.classList.toggle('is-on', entry.finished);
          finishToggle.setAttribute('aria-pressed', String(entry.finished));
          row.classList.toggle('is-wasted', !entry.finished);
          refresh();
          persist();
        },
      },
      entry.finished ? '✓' : '○'
    );

    const mvpToggle = h(
      'button',
      {
        class: `srow__toggle is-mvp${entry.is_mvp ? ' is-on' : ''}`,
        type: 'button',
        title: '标记为本局 MVP',
        'aria-pressed': String(entry.is_mvp),
        onclick: () => {
          entry.is_mvp = !entry.is_mvp;
          mvpToggle.classList.toggle('is-on', entry.is_mvp);
          mvpToggle.setAttribute('aria-pressed', String(entry.is_mvp));
          persist();
        },
      },
      '★'
    );

    const row = h(
      'div',
      { class: `srow${entry.finished ? '' : ' is-wasted'}` },
      h('div', { class: 'srow__who' }, avatarEl(player, 'sm'), h('span', { class: 'srow__name', title: player.name }, player.name)),
      scoreInput,
      finishToggle,
      mvpToggle,
      h(
        'button',
        {
          class: 'srow__del',
          type: 'button',
          title: '移出本局',
          'aria-label': `把 ${player.name} 移出本局`,
          onclick: () => {
            camp.players = camp.players.filter((p) => p !== entry);
            rebuildList(index);
            refresh();
            persist();
          },
        },
        '×'
      )
    );
    return row;
  }

  function rebuildList(index) {
    const cv = campViews[index];
    if (!cv) return;
    cv.list.innerHTML = '';

    if (draft.camps[index].players.length === 0) {
      cv.list.append(h('div', { class: 'camp__empty' }, '从下面选一名玩家加入'));
    } else {
      draft.camps[index].players.forEach((entry) => {
        const row = buildScoreRow(index, entry);
        if (row) cv.list.append(row);
      });
    }
    rebuildAllSelects();
  }

  function addPlayerToCamp(index, playerId) {
    const camp = draft.camps[index];
    if (camp.players.some((p) => p.player_id === playerId)) {
      notifyErr('这名玩家已经在本阵营里了');
      return;
    }
    camp.players.push({ player_id: playerId, score: '', finished: false, is_mvp: false });
    rebuildList(index);
    refresh();
    persist();
  }

  function buildCamp(index) {
    const camp = draft.camps[index];

    const totalEl = h('span', { class: 'camp__total' }, '0');
    const metaEl = h('div', { class: 'camp__meta' });
    const listEl = h('div', { class: 'camp__list' });

    const nameInput = h('input', {
      class: 'camp__name',
      value: camp.name,
      'aria-label': `阵营 ${index + 1} 名称`,
      oninput: (e) => {
        camp.name = e.target.value;
        persist();
      },
    });

    const colorBtn = h(
      'button',
      {
        class: 'btn btn--icon',
        type: 'button',
        title: '换个阵营颜色',
        style: { width: '26px', height: '26px', padding: '0', background: camp.color, borderColor: camp.color, borderRadius: '6px' },
        'aria-label': '切换阵营颜色',
        onclick: () => {
          const next = COLORS[(COLORS.indexOf(camp.color) + 1) % COLORS.length];
          camp.color = next;
          colorBtn.style.background = next;
          colorBtn.style.borderColor = next;
          cv.root.style.setProperty('--camp-color', next);
          refresh();
          persist();
        },
      },
      ''
    );

    const removeCampBtn =
      draft.camps.length > 2
        ? h(
            'button',
            {
              class: 'btn btn--icon btn--ghost',
              type: 'button',
              title: `移除「${camp.name}」`,
              'aria-label': `移除「${camp.name}」`,
              onclick: () => removeCampAt(index),
            },
            '🗑'
          )
        : null;

    const selectEl = h('select', { class: 'select', 'aria-label': `选择玩家加入 ${camp.name}` });
    selectEl.append(h('option', { value: '' }, '选择玩家加入…'));

    const addBtn = h(
      'button',
      {
        class: 'btn btn--sm',
        type: 'button',
        onclick: () => {
          const pid = Number(selectEl.value);
          if (!pid) {
            notifyErr('请先在下拉框里选一名玩家');
            return;
          }
          addPlayerToCamp(index, pid);
          selectEl.value = '';
        },
      },
      '加入'
    );

    const quickNewBtn = h(
      'button',
      {
        class: 'btn btn--sm btn--ghost',
        type: 'button',
        title: '现场来了新牌友？直接登记',
        onclick: () =>
          promptNewPlayer({
            onCreated: (player) => {
              addPlayerToCamp(index, player.id);
            },
          }),
      },
      '+ 新建'
    );

    const campEl = h(
      'div',
      { class: 'camp', style: { '--camp-color': camp.color } },
      h(
        'div',
        { class: 'camp__head' },
        colorBtn,
        nameInput,
        // 总分 + 移除按钮成一组贴右（3 个阵营以上才有 🗑，用于移除指定的那一个）
        h('div', { class: 'camp__head-end' }, h('div', { style: { textAlign: 'right' } }, totalEl), removeCampBtn)
      ),
      metaEl,
      listEl,
      h('div', { class: 'camp__foot' }, selectEl, addBtn, quickNewBtn)
    );

    const cv = { camp, root: campEl, totalEl, metaEl, list: listEl, select: selectEl, colorBtn };
    campViews[index] = cv;
    return campEl;
  }

  function addCamp() {
    if (draft.camps.length >= MAX_CAMPS) return;
    const preset = CAMP_PRESETS[draft.camps.length] || { name: `阵营 ${draft.camps.length + 1}`, color: COLORS[draft.camps.length % COLORS.length] };
    draft.camps.push({ name: preset.name, color: preset.color, players: [] });
    renderCampArea();
    refresh();
    persist();
  }

  /**
   * 移除一个阵营。至少保留 2 个；该阵营有玩家时先确认（分数会一起丢弃）。
   * index 省略时移除**最后一个**，也就是最近增加的那个（第三 / 第四阵营），
   * 这样「− 移除阵营」永远先撤销自己加过的，不会误删默认的红队 / 蓝队。
   */
  async function removeCampAt(index = draft.camps.length - 1) {
    if (draft.camps.length <= 2) return;
    const camp = draft.camps[index];
    if (!camp) return;

    if (camp.players.length) {
      const ok = await confirmDialog({
        title: `移除「${camp.name}」`,
        message: `该阵营有 ${camp.players.length} 名玩家，移除后他们的本局得分会一起丢弃。`,
        confirmText: '移除阵营',
        danger: true,
      });
      if (!ok) return;
    }

    draft.camps.splice(index, 1);
    renderCampArea();
    refresh();
    persist();
  }

  function renderCampArea() {
    campsWrap.innerHTML = '';
    campViews.length = 0;
    // 阵营平分整行：2 个各一半、3 个各三分之一（窄屏由媒体查询改为单列）
    campsWrap.style.setProperty('--camp-n', String(draft.camps.length));
    draft.camps.forEach((_, i) => campsWrap.append(buildCamp(i)));
    // 先把每个阵营的玩家列表铺出来（空阵营会显示引导文案）
    draft.camps.forEach((_, i) => rebuildList(i));
    rebuildAllSelects();
  }

  /* ------------------------------------------------------- 本局高光录入 */

  function buildHighlightsPanel() {
    const wrap = h('div', { class: 'card hl-compose' });
    // 默认收起：只有当草稿里已经带着待存高光时才自动展开，避免「录了一半却看不见」
    let open = draft.highlights.length > 0;

    function renderPanel(focusTitle) {
      const matchPlayers = store.players.filter((p) =>
        draft.camps.some((c) => c.players.some((e) => e.player_id === p.id))
      );

      wrap.innerHTML = '';
      wrap.append(
        h(
          'div',
          { class: 'card__head' },
          h('h2', {}, '本局高光'),
          h('span', { class: 'hint' }, '打完顺手记一笔，自动绑定本局与所选玩家')
        )
      );

      const kindSel = h('select', { class: 'select', 'aria-label': '类型' }, HL_KINDS.map((k) => h('option', { value: k }, k)));
      const titleInput = h('input', { class: 'input', placeholder: '标题，例如：最后一轮连抓两张 K 翻盘', 'aria-label': '高光标题' });
      const contentInput = h('textarea', { class: 'input', rows: 2, placeholder: '发生了什么（可选）', 'aria-label': '高光描述' });
      const playerWrap = h(
        'div',
        { class: 'check-grid' },
        matchPlayers.map((p) => {
          const cb = h('input', { type: 'checkbox', value: String(p.id) });
          return h('label', { class: 'check' }, cb, h('span', {}, p.name));
        })
      );

      const addBtn = h(
        'button',
        {
          class: 'btn btn--primary btn--sm',
          type: 'button',
          onclick: () => {
            const title = titleInput.value.trim();
            if (!title) {
              notifyErr('先填个标题');
              titleInput.focus();
              return;
            }
            const playerIds = [...playerWrap.querySelectorAll('input:checked')].map((c) => Number(c.value));
            draft.highlights.push({ kind: kindSel.value, title, content: contentInput.value.trim(), player_ids: playerIds, image: null });
            titleInput.value = '';
            contentInput.value = '';
            persist();
            renderPanel(true); // 连着记多条时不丢焦点
            refresh(); // 同步操作条上的「高光待存 N 条」
          },
        },
        '添加这条'
      );

      wrap.append(
        h(
          'div',
          { class: 'hl-compose__form' },
          h('div', { class: 'hl-compose__row' }, kindSel, titleInput),
          contentInput,
          matchPlayers.length
            ? h('div', {}, h('div', { class: 'muted', style: { fontSize: '12px', marginBottom: '6px' } }, '参与玩家（可多选）'), playerWrap)
            : h('div', { class: 'muted', style: { fontSize: '12px' } }, '加入玩家后才可选参与人'),
          h('div', { style: { textAlign: 'right', marginTop: '8px' } }, addBtn)
        )
      );

      if (draft.highlights.length) {
        const listEl = h('div', { class: 'hl-compose__list' });
        draft.highlights.forEach((hl, i) => {
          const names = (hl.player_ids || []).map((id) => { const p = store.playerById(id); return p ? p.name : null; }).filter(Boolean);
          listEl.append(
            h(
              'div',
              { class: 'hl-pending' },
              h('span', { class: 'badge badge--felt' }, hl.kind || '精彩瞬间'),
              h('span', { class: 'hl-pending__title' }, hl.title),
              names.length ? h('span', { class: 'muted', style: { fontSize: '12px' } }, '· ' + names.join('、')) : null,
              h(
                'button',
                {
                  class: 'btn btn--xs btn--ghost',
                  type: 'button',
                  style: { marginLeft: 'auto' },
                  onclick: () => {
                    draft.highlights.splice(i, 1);
                    persist();
                    renderPanel(false);
                    refresh();
                  },
                },
                '移除'
              )
            )
          );
        });
        wrap.append(h('div', { class: 'hl-compose__added' }, h('div', { class: 'muted', style: { fontSize: '12px', margin: '12px 0 6px' } }, `待保存 ${draft.highlights.length} 条`), listEl));
      }

      if (focusTitle) {
        const el = wrap.querySelector('.hl-compose__row .input');
        if (el) el.focus();
      }
    }

    wrap.hidden = !open;
    if (open) renderPanel(false);

    return {
      el: wrap,
      isOpen: () => open,
      /** 由操作条上的「+ 新增高光 / 收起高光录入」按钮调用 */
      toggle: () => {
        open = !open;
        wrap.hidden = !open;
        if (open) renderPanel(true);
      },
    };
  }

  /* ------------------------------------------------------- 本地结算（与后端同口径） */

  /**
   * 本地预览用的本局结算：与后端 lib/score.js 同口径
   * （牌库总分 = 副数×100；获胜线 = 一半且需严格超过；
   *   全员出完且对手未全员出完即胜）。
   */
  function computeLocalResult() {
    const line = winLineOf(draft.deckCount);
    const perCamp = draft.camps.map((camp) => {
      const players = camp.players;
      const banked = players.filter((p) => p.finished).reduce((s, p) => s + num(p.score), 0);
      const wasted = players.filter((p) => !p.finished).reduce((s, p) => s + num(p.score), 0);
      const finishedCount = players.filter((p) => p.finished).length;
      const allFinished = players.length > 0 && players.every((p) => p.finished);
      return { banked, wasted, finishedCount, allFinished, isWinner: banked > line };
    });
    // 「全员出完即胜」仅在「存在对手阵营未全员出完」时成立
    perCamp.forEach((c, i) => {
      if (c.allFinished && perCamp.some((o, j) => j !== i && !o.allFinished)) c.isWinner = true;
    });
    return { line, perCamp };
  }

  /* ------------------------------------------------------- 刷新计算 */

  function refresh() {
    const deckTotal = deckTotalOf(draft.deckCount);
    const { line, perCamp } = computeLocalResult();

    campViews.forEach((cv, i) => {
      const camp = draft.camps[i];
      if (!camp) return;
      const r = perCamp[i] || { banked: 0, wasted: 0, finishedCount: 0, isWinner: false };
      const banked = r.banked;
      const wasted = r.wasted;
      const finishedCount = r.finishedCount;
      const isWin = r.isWinner;
      const winByFinish = isWin && banked <= line;

      cv.totalEl.textContent = banked;
      cv.totalEl.style.color = isWin ? camp.color : '';
      cv.root.classList.toggle('is-winner', isWin);

      if (camp.players.length === 0) {
        appendAll(cv.metaEl, h('span', { class: 'muted' }, '尚未加入玩家'));
      } else {
        appendAll(
          cv.metaEl,
          h('span', {}, `出完 ${finishedCount}/${camp.players.length} 人`),
          wasted > 0 ? h('span', { class: 'muted' }, `· 未出完 ${wasted} 分`) : null,
          isWin
            ? h('span', { class: 'win-flag' }, winByFinish ? '🏆 全员出完' : '🏆 已过线')
            : h('span', { class: 'win-flag', style: { color: 'var(--ink-400)' } }, `需 > ${line}`)
        );
      }
    });

    // 操作条：左边提示本局高光暂存情况，右边两个建设性动作
    // （牌库总分 / 获胜线已下移到最底部与「保存本局」同一行；清空重录也在那一行）
    actionBar.innerHTML = '';
    actionBar.append(
      h(
        'span',
        { class: 'item' },
        h('span', {}, '高光待存'),
        h('b', {}, draft.highlights.length),
        h('span', {}, '条')
      ),
      h(
        'span',
        { class: 'push' },
        draft.camps.length < MAX_CAMPS
          ? h(
              'button',
              {
                class: 'btn btn--sm',
                type: 'button',
                title: `最多支持 ${MAX_CAMPS} 个阵营`,
                onclick: () => addCamp(),
              },
              '+ 增加阵营'
            )
          : null,
        // 与「+ 增加阵营」配对：默认移除最近增加的那一个（第三 / 第四阵营），红队 / 蓝队保留
        h(
          'button',
          {
            class: 'btn btn--sm',
            type: 'button',
            disabled: draft.camps.length <= 2,
            title:
              draft.camps.length > 2
                ? `移除最近增加的「${draft.camps[draft.camps.length - 1].name}」（红队 / 蓝队始终保留）`
                : '至少要保留 2 个阵营',
            onclick: () => removeCampAt(),
          },
          '− 移除阵营'
        ),
        h(
          'button',
          {
            class: 'btn btn--sm',
            type: 'button',
            title: '打完顺手记一笔，自动绑定本局与所选玩家',
            onclick: () => {
              hlPanel.toggle();
              refresh();
            },
          },
          hlPanel.isOpen() ? '收起高光录入' : '+ 新增高光'
        )
      )
    );

    paintResult(deckTotal, line);
  }

  function paintResult(deckTotal, line) {
    const entries = draft.camps.flatMap((c) => c.players);
    const { perCamp } = computeLocalResult();
    const distributed = entries.reduce((s, p) => s + num(p.score), 0);
    const wasted = entries.filter((p) => !p.finished).reduce((s, p) => s + num(p.score), 0);
    const unclaimed = deckTotal - distributed;
    const winners = perCamp.filter((c) => c.isWinner);

    /* ---- 录入校验：拦截无效对局 ---- */
    const errors = [];
    const warnings = [];
    if (draft.camps.length < 2) errors.push('至少需要 2 个阵营');
    if (draft.camps.some((c) => c.players.length === 0)) errors.push('每个阵营至少要有 1 名玩家');
    if (distributed > deckTotal) errors.push(`总录入分数 ${distributed} 超过牌库总分 ${deckTotal}，请核对分数`);
    const seen = new Set();
    for (const c of draft.camps) {
      for (const p of c.players) {
        const player = store.playerById(p.player_id);
        if (seen.has(p.player_id)) errors.push('同一名玩家不能出现在多个阵营');
        seen.add(p.player_id);
        if (num(p.score) > deckTotal) errors.push(`「${player ? player.name : '?'}」的单人分数 ${num(p.score)} 超过牌库总分`);
      }
    }
    if (winners.length >= 1 && unclaimed > 0) warnings.push(`还有 ${unclaimed} 分未录入，但已分出胜负，可能漏录`);
    if (winners.length > 1) warnings.push('多个阵营同时判定获胜，请核对分数');

    const canSave =
      entries.length > 0 &&
      errors.length === 0 &&
      draft.camps.length >= 2 &&
      draft.camps.every((c) => c.players.length > 0);

    // 校验提示条
    alertBar.innerHTML = '';
    for (const msg of errors) alertBar.append(h('div', { class: 'msg err' }, '⛔ ' + msg));
    for (const msg of warnings) alertBar.append(h('div', { class: 'msg warn' }, '⚠️ ' + msg));

    resultBar.innerHTML = '';

    const campName = (r) => {
      const idx = perCamp.indexOf(r);
      return draft.camps[idx] ? draft.camps[idx].name : '';
    };
    const campColor = (r) => {
      const idx = perCamp.indexOf(r);
      return draft.camps[idx] ? draft.camps[idx].color : '';
    };

    let text;
    if (entries.length === 0) {
      text = h('span', { class: 'muted' }, '把玩家加入阵营后开始录分');
    } else if (winners.length === 1) {
      const w = winners[0];
      text = h(
        'span',
        {},
        '🏆 ',
        h('span', { class: 'ok', style: { color: campColor(w) } }, campName(w)),
        ` 以 ${w.banked} 分拿下本局 `,
        h('span', { class: 'muted' }, `（获胜线 ${line} 分，牌库总分 ${deckTotal} 分）`)
      );
    } else if (winners.length === 0) {
      const best = perCamp
        .map((c, i) => ({ c, i, v: c.banked }))
        .sort((a, b) => b.v - a.v)[0];
      text = h(
        'span',
        {},
        '⚖️ ',
        h('span', { class: 'muted' }, '还没有阵营超过获胜线'),
        best && best.v > 0
          ? h('span', { class: 'muted' }, `　最接近的是 ${draft.camps[best.i].name}（${best.v} 分，差 ${line - best.v + 1} 分）`)
          : null
      );
    } else {
      text = h(
        'span',
        { style: { color: 'var(--warn)' } },
        '⚠️ ',
        `${winners.map((c) => campName(c)).join('、')} 同时判定获胜，请核对分数 —— 牌库总分只有 ${deckTotal} 分。`
      );
    }

    resultBar.append(
      h(
        'div',
        { class: 'facts' },
        h('span', { class: 'item' }, h('span', {}, '牌库总分'), h('b', {}, deckTotal)),
        h('span', { class: 'item' }, h('span', {}, '获胜线'), h('b', {}, line), h('span', {}, '（需超过）'))
      ),
      h('span', { class: 'result-bar__text' }, text),
      h(
        'span',
        { class: 'muted mono', style: { fontSize: '12px' }, title: '已录入的分 = 出完牌的有效分 + 未出完牌的分数' },
        `已录 ${distributed} / ${deckTotal}　未出完 ${wasted}　未录入 ${unclaimed}`
      ),
      h('button', { class: 'btn', type: 'button', onclick: clearEntry }, '清空重录'),
      h(
        'button',
        { class: 'btn btn--primary', type: 'button', disabled: !canSave, onclick: save },
        '保存本局'
      )
    );

    if (!canSave) {
      const btn = resultBar.querySelector('.btn--primary');
      if (btn) btn.title = errors.length ? errors[0] : '每个阵营至少要有 1 名玩家';
    }
  }

  /** 清空本局录入（不动已保存的对局） */
  async function clearEntry() {
    const ok = await confirmDialog({
      title: '清空本局录入',
      message: '当前录入的分数、阵营与玩家分配都会清空（不影响已保存的对局）。',
      confirmText: '清空重录',
      danger: true,
    });
    if (!ok) return;
    draft = blankDraft(store.seasonById(draft.seasonId) || store.currentSeason);
    clearDraft();
    renderScoring(root);
  }

  function persist() {
    saveDraft(draft);
  }

  /* ------------------------------------------------------- 保存 */

  async function save() {
    const btn = resultBar.querySelector('.btn--primary');
    if (btn) btn.disabled = true;

    try {
      const payload = {
        season_id: draft.seasonId,
        deck_count: draft.deckCount,
        table_name: draft.tableName,
        played_at: draft.playedAt,
        seq: draft.seq,
        note: draft.note,
        camps: draft.camps.map((c) => ({
          name: c.name,
          color: c.color,
          players: c.players.map((p) => ({
            player_id: p.player_id,
            score: roundTo5(num(p.score)),
            finished: !!p.finished,
            is_mvp: !!p.is_mvp,
          })),
        })),
      };

      if (!payload.season_id) throw new Error('请先选择赛季');
      for (const c of payload.camps) {
        if (c.players.length === 0) throw new Error(`「${c.name}」还没有玩家，请至少放 1 名玩家`);
      }

      // 第二道保险：总录入分数不可超过牌库总分（牌库只有这么些分）
      const total = payload.camps.flatMap((c) => c.players).reduce((s, p) => s + p.score, 0);
      const cap = payload.deck_count * 100;
      if (total > cap) throw new Error(`总录入分数 ${total} 超过牌库总分 ${cap}，请核对分数`);

      const saved = await api.createMatch(payload);
      const line = saved.win_line;
      const winners = (saved.camps || []).filter((c) => c.is_winner);

      if (winners.length === 1) {
        notifyOk(`已保存：${winners[0].name} 以 ${winners[0].total_score} 分获胜（获胜线 ${line} 分）`);
      } else if (winners.length === 0) {
        notifyOk('已保存：本局没有阵营超过获胜线');
      } else {
        notifyOk('已保存（注意：有多个阵营同时过线，建议复核）');
      }

      if (draft.highlights.length) {
        const happened = (draft.playedAt || '').slice(0, 10);
        await Promise.all(
          draft.highlights.map((hl) =>
            api
              .createHighlight({
                season_id: draft.seasonId,
                match_id: saved.id,
                player_ids: hl.player_ids,
                title: hl.title,
                content: hl.content || '',
                kind: hl.kind || '精彩瞬间',
                happened_on: happened,
                image: hl.image || null,
              })
              .catch((e) => notifyErr(`高光「${hl.title}」保存失败：${e.message || ''}`))
          )
        );
      }

      clearDraft();
      await store.load();
      renderScoring(root);
    } catch (err) {
      notifyErr(err.message || '保存失败');
      if (btn) btn.disabled = false;
    }
  }

  /* ------------------------------------------------------- 启动 */

  renderCampArea();
  refresh();

  // 恢复过草稿就提示一下
  const restored = draft.camps.some((c) => c.players.length > 0);
  if (restored) {
    setTimeout(() => notifyOk('已恢复上次未保存的录入'), 260);
  }
}
