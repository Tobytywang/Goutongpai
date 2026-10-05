/* 排行榜：多口径统计，每个数字都能追溯 */

import { store } from '../store.js';
import { computePlayerStats, computeOverview, sortStats, SORT_KEYS } from '../stats.js';
import { h, avatarEl, pct, debounce } from '../util.js';

/** 页面级 UI 状态放在模块作用域，重绘后仍保留用户的选择
    （「全部赛季」例外：它是全局口径，放在 store 上以便切赛季时重置） */
const ui = {
  sortKey: 'wins',
  minGames: 0,
  keyword: '',
  noteOpen: false,
};

export function renderLeaderboard(root) {
  root.innerHTML = '';

  const scopeLabelEl = h('div', { class: 'sub' });

  const searchInput = h('input', {
    class: 'input',
    type: 'search',
    placeholder: '搜索玩家…',
    value: ui.keyword,
    'aria-label': '搜索玩家',
    oninput: debounce((e) => {
      ui.keyword = e.target.value.trim();
      paintList();
    }, 180),
  });

  const sortSelect = h(
    'select',
    {
      class: 'select',
      style: { width: 'auto', minWidth: '150px' },
      'aria-label': '排序依据',
      onchange: (e) => {
        ui.sortKey = e.target.value;
        paintList();
      },
    },
    SORT_KEYS.map((k) => h('option', { value: k.key, selected: k.key === ui.sortKey }, k.label))
  );

  const hintBadge = h('span', { class: 'badge' });

  const scopeCheck = h('input', {
    type: 'checkbox',
    checked: store.scopeAll,
    onchange: (e) => {
      store.scopeAll = e.target.checked;
      paintList();
    },
  });

  const minGamesInput = h('input', {
    class: 'input',
    type: 'number',
    min: 0,
    max: 99,
    value: ui.minGames,
    style: { width: '76px' },
    'aria-label': '最少出场局数',
    onchange: (e) => {
      ui.minGames = Math.max(0, Math.floor(Number(e.target.value) || 0));
      paintList();
    },
  });

  const toggleBtn = h(
    'button',
    {
      class: 'btn btn--xs btn--ghost',
      type: 'button',
      onclick: () => {
        ui.noteOpen = !ui.noteOpen;
        paintList();
      },
    },
    ui.noteOpen ? '收起' : '展开'
  );

  const resultArea = h('div');

  /* 只重绘结果区（榜单 + 口径说明），搜索框/筛选项留在重建范围外，
     这样 debounce 触发重绘后输入框不会丢焦点（与 players.js 的 paintList 一致）。 */
  function paintList() {
    const scopeLabel = store.scopeAll ? '全部赛季' : store.currentSeason ? store.currentSeason.name : '全部赛季';
    const seasonId = store.scopeAll ? null : store.currentSeasonId;

    const allRows = computePlayerStats(store.matches, store.players, seasonId);
    const overview = computeOverview(store.matches, store.players, seasonId);

    // 只保留在役玩家参与排名（停用玩家仍可在玩家页查看）
    const activeIds = new Set(store.players.filter((p) => p.active).map((p) => p.id));
    let rows = allRows.filter((r) => activeIds.has(r.player_id));

    if (ui.minGames > 0) rows = rows.filter((r) => r.games >= ui.minGames);
    if (ui.keyword) {
      const kw = ui.keyword.toLowerCase();
      rows = rows.filter((r) => {
        const p = r.player;
        return [p.name, p.bio].filter(Boolean).join(' ').toLowerCase().includes(kw);
      });
    }

    const sorted = sortStats(rows, ui.sortKey);
    const sortMeta = SORT_KEYS.find((k) => k.key === ui.sortKey) || SORT_KEYS[0];

    scopeLabelEl.textContent = `统计范围：${scopeLabel} · 共 ${overview.matchCount} 局 / ${overview.activePlayerCount} 人出过场`;
    hintBadge.textContent = sortMeta.hint;

    resultArea.innerHTML = '';
    resultArea.append(
      sorted.length >= 1 ? podium(sorted.slice(0, 3), sortMeta) : null,

      h(
        'div',
        { class: 'card' },
        h(
          'div',
          { class: 'card__head' },
          h('h2', {}, '明细'),
          h('span', { class: 'hint' }, `按「${sortMeta.label}」降序 · 同值依次比较胜局、出场、入账分`)
        ),
        h(
          'div',
          { class: 'card__body card__body--flush' },
          sorted.length === 0
            ? h(
                'div',
                { class: 'empty' },
                h('div', { class: 'empty__icon' }, '📊'),
                h('div', { class: 'empty__title' }, '还没有可统计的对局'),
                h('div', { class: 'empty__desc' }, '去计分台保存一局，这里就会有数据')
              )
            : h('div', { class: 'table-wrap' }, buildTable(sorted, sortMeta))
        )
      ),

      h(
        'div',
        { class: 'card', style: { marginTop: '16px' } },
        h('div', { class: 'card__head' }, h('h3', {}, '每个数字是怎么算的'), toggleBtn),
        ui.noteOpen ? h('div', { class: 'card__body' }, glossary()) : null
      )
    );
  }

  root.append(
    h(
      'div',
      { class: 'page-head' },
      h('div', {}, h('h1', {}, '排行榜'), scopeLabelEl),
      h(
        'div',
        { class: 'head-actions' },
        h('div', { class: 'search-box' }, searchInput),
        h('label', { class: 'check' }, scopeCheck, h('span', {}, '全部赛季'))
      )
    ),

    h(
      'div',
      { class: 'head-filters' },
      h('span', { class: 'muted', style: { fontSize: '12px' } }, '排序依据'),
      sortSelect,
      hintBadge,
      h(
        'label',
        { class: 'check', title: '只统计出场数达到该值的玩家，避免 1 场 100% 胜率挤掉长期稳定的人' },
        h('span', {}, '最少出场'),
        minGamesInput,
        h('span', {}, '局')
      )
    ),

    resultArea
  );

  paintList();
}

/* ---------------------------------------------------------------- 子块 */

function podium(top3, sortMeta) {
  return h(
    'div',
    { class: 'podium' },
    top3.map((r, i) => {
      const value = sortMeta.percent ? pct(r.wins, r.games) : r[sortMeta.key];
      return h(
        'div',
        { class: `podium__card${i === 0 ? ' podium__card--1' : ''}` },
        h('span', { class: `rank-medal rank-medal--${i + 1}` }, String(i + 1)),
        avatarEl(r.player, 'md'),
        h(
          'div',
          { class: 'podium__body' },
          h('div', { class: 'podium__name' }, r.name),
          h(
            'div',
            { class: 'podium__stat' },
            `${sortMeta.label} `,
            h('b', { style: { fontSize: '15px', color: 'var(--ink-800)' } }, String(value)),
            `　${r.games} 局 ${r.wins} 胜`
          )
        )
      );
    })
  );
}

function buildTable(rows, sortMeta) {
  const COLS = [
    { key: 'rank', label: '#', cls: '' },
    { key: 'name', label: '玩家', cls: '' },
    { key: 'games', label: '出场', cls: 'num', title: '参与过的对局数' },
    { key: 'wins', label: '胜局', cls: 'num', title: '所在阵营获胜的局数' },
    { key: 'winRate', label: '胜率', cls: 'num', title: '胜局 ÷ 出场' },
    { key: 'banked', label: '入账分', cls: 'num', title: '只在把牌出完的局里拿到的分数之和' },
    { key: 'points', label: '累计分', cls: 'num', title: '所有出场局的分数之和（含作废）' },
    { key: 'wasted', label: '作废分', cls: 'num', title: '因为没把牌出完而白拿的分数' },
    { key: 'finishRate', label: '出完率', cls: 'num', title: '把牌出完的局数 ÷ 出场' },
    { key: 'avg', label: '场均', cls: 'num', title: '累计分 ÷ 出场' },
    { key: 'best', label: '单局最高', cls: 'num', title: '单局拿到的最高分' },
    { key: 'mvp', label: '★MVP', cls: 'num', title: '被标记为 MVP 的次数' },
    { key: 'mainCamp', label: '常驻阵营', cls: '', title: '出场次数最多的阵营' },
  ];

  const head = h(
    'thead',
    {},
    h(
      'tr',
      {},
      COLS.map((c) => h('th', { class: c.cls, scope: 'col', title: c.title || '' }, c.label))
    )
  );

  const body = h('tbody');
  rows.forEach((r, i) => {
    const rank = i + 1;
    body.append(
      h(
        'tr',
        {},
        h('td', {}, h('span', { class: `rank-medal rank-medal--${rank <= 3 ? rank : 0}` }, String(rank))),
        h(
          'td',
          {},
          h('div', { class: 'cell-player' }, avatarEl(r.player, 'sm'), h('div', { class: 'cell-player__name' }, r.name))
        ),
        h('td', { class: 'num' }, String(r.games)),
        h('td', { class: 'num', style: { fontWeight: '620' } }, String(r.wins)),
        h(
          'td',
          { class: 'num' },
          h(
            'div',
            { style: { display: 'flex', alignItems: 'center', gap: '7px', justifyContent: 'flex-end' } },
            h('span', {}, pct(r.wins, r.games)),
            h('span', { class: 'progress', style: { width: '46px' } }, h('i', { style: { width: `${r.winRate * 100}%` } }))
          )
        ),
        h('td', { class: 'num text-up', style: { fontWeight: '620' } }, String(r.banked)),
        h('td', { class: 'num' }, String(r.points)),
        h('td', { class: 'num muted' }, r.wasted ? String(r.wasted) : '0'),
        h('td', { class: 'num' }, pct(r.finishedGames, r.games)),
        h('td', { class: 'num' }, r.games ? r.avg.toFixed(1) : '—'),
        h('td', { class: 'num' }, String(r.best)),
        h('td', { class: 'num' }, r.mvp ? h('span', { class: 'badge badge--mvp' }, String(r.mvp)) : h('span', { class: 'muted' }, '—')),
        h('td', {}, r.mainCamp ? h('span', { class: 'badge' }, r.mainCamp) : h('span', { class: 'muted' }, '—'))
      )
    );
  });

  return h(
    'table',
    { class: 'data' },
    h('caption', { class: 'sr-only' }, `玩家统计明细，按「${sortMeta.label}」降序排列`),
    head,
    body
  );
}

function glossary() {
  const items = [
    ['出场', '该玩家参与过的对局数量。同一局只计 1 次。'],
    ['胜局', '所在阵营在该局被判获胜的局数。同一局最多计 1 次。'],
    ['胜率', '胜局 ÷ 出场。出场为 0 时不参与排名，显示「—」。'],
    ['入账分', '只在「把牌出完」的局里拿到的分数之和。这部分分数才计入阵营总分、参与胜负判定。'],
    ['累计分', '所有出场局里拿到的分数之和，包含因没出完牌而作废的部分。'],
    ['作废分', '累计分 − 入账分。也就是「牌没出完、分数白拿」的那部分。'],
    ['出完率', '把牌出完的局数 ÷ 出场。反映打法是否偏激进（压着不出 vs 抢着走）。'],
    ['场均', '累计分 ÷ 出场。'],
    ['MVP 次数', '录入时被勾选 ★ 的次数由记分员主观判定，仅作荣誉记录，不影响胜负。'],
  ];

  return h(
    'div',
    {},
    h(
      'p',
      { style: { fontSize: '13px', color: 'var(--ink-600)', marginBottom: '12px' } },
      '每个玩家的三档分数满足恒等式，页面上的数字都能对上账：',
      h('br'),
      h('span', { class: 'mono', style: { fontSize: '13px' } }, '入账分 ＋ 作废分 ＝ 累计分')
    ),
    h(
      'div',
      { class: 'table-wrap' },
      h(
        'table',
        { class: 'data' },
        h('thead', {}, h('tr', {}, h('th', {}, '指标'), h('th', {}, '口径定义'))),
        h(
          'tbody',
          {},
          items.map(([k, v]) => h('tr', {}, h('td', { style: { whiteSpace: 'nowrap', fontWeight: '600' } }, k), h('td', { style: { whiteSpace: 'normal' } }, v)))
        )
      )
    )
  );
}
