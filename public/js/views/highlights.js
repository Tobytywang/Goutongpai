/* 高光时刻：时间线记录牌桌上的名场面 */

import { store } from '../store.js';
import { h, avatarEl, fmtDate, debounce } from '../util.js';
import { promptNewHighlight, confirmDeleteHighlight } from '../forms.js';

const ui = { kind: '', keyword: '' };

const KINDS = ['逆风翻盘', '神级配合', '爆分时刻', '默契沟通', '首次达成', '名场面', '精彩瞬间'];

export function renderHighlights(root) {
  root.innerHTML = '';

  const subEl = h('div', { class: 'sub' });

  const searchInput = h('input', {
    class: 'input',
    type: 'search',
    placeholder: '搜索标题 / 内容 / 主角…',
    value: ui.keyword,
    'aria-label': '搜索高光',
    oninput: debounce((e) => {
      ui.keyword = e.target.value.trim();
      paintList();
    }, 180),
  });

  const kindSelect = h(
    'select',
    {
      class: 'select',
      style: { width: 'auto' },
      'aria-label': '按类型筛选',
      onchange: (e) => {
        ui.kind = e.target.value;
        paintList();
      },
    },
    [h('option', { value: '', selected: ui.kind === '' }, '全部类型'), ...KINDS.map((k) => h('option', { value: k, selected: k === ui.kind }, k))]
  );

  const scopeCheck = h('input', {
    type: 'checkbox',
    checked: store.scopeAll,
    onchange: (e) => {
      store.scopeAll = e.target.checked;
      paintList();
    },
  });

  const listArea = h('div');

  function paintList() {
    const seasonId = store.scopeAll ? null : store.currentSeasonId;
    let items = store.highlightsOfSeason(seasonId);

    if (ui.kind) items = items.filter((x) => (x.kind || '精彩瞬间') === ui.kind);
    if (ui.keyword) {
      const kw = ui.keyword.toLowerCase();
      items = items.filter((x) => {
        const names = (x.player_ids || []).map((id) => store.playerById(id)).filter(Boolean).map((p) => p.name).join(' ');
        return [x.title, x.content, x.kind, names].filter(Boolean).join(' ').toLowerCase().includes(kw);
      });
    }

    const scopeLabel = store.scopeAll ? '全部赛季' : store.currentSeason ? store.currentSeason.name : '全部赛季';
    subEl.textContent = `${scopeLabel} · 共 ${items.length} 条记录`;

    listArea.innerHTML = '';
    listArea.append(
      items.length === 0
        ? h(
            'div',
            { class: 'card' },
            h(
              'div',
              { class: 'empty' },
              h('div', { class: 'empty__icon' }, '✨'),
              h('div', { class: 'empty__title' }, ui.keyword || ui.kind ? '没有匹配的记录' : '还没有高光时刻'),
              h('div', { class: 'empty__desc' }, '把那些「最后一轮翻盘」「四张 K 全收」的瞬间记下来，赛季结束时回看最有味道'),
              h(
                'button',
                { 'data-write': '', class: 'btn btn--primary', type: 'button', onclick: () => promptNewHighlight({ defaults: { season_id: store.currentSeasonId } }).then(() => renderHighlights(root)) },
                '记录第一条'
              )
            )
          )
        : h('div', { class: 'timeline' }, items.map((item) => highlightCard(item, root)))
    );
  }

  root.append(
    h(
      'div',
      { class: 'page-head' },
      h('div', {}, h('h1', {}, '高光时刻'), subEl),
      h(
        'div',
        { class: 'head-actions' },
        h('div', { class: 'search-box' }, searchInput),
        h(
          'button',
          {
            'data-write': '',
            class: 'btn btn--primary',
            type: 'button',
            onclick: () => promptNewHighlight({ defaults: { season_id: store.currentSeasonId } }).then(() => renderHighlights(root)),
          },
          '+ 记录高光'
        )
      )
    ),

    h(
      'div',
      { class: 'lb-context' },
      kindSelect,
      h('label', { class: 'check' }, scopeCheck, h('span', {}, '全部赛季'))
    ),

    listArea
  );

  paintList();
}

function highlightCard(item, root) {
  const players = (item.player_ids || []).map((id) => store.playerById(id)).filter(Boolean);
  const player = players[0] || null;
  const match = item.match_id ? store.matches.find((m) => m.id === item.match_id) : null;

  return h(
    'article',
    { class: 'hl' },
    h(
      'div',
      { class: 'hl__head' },
      h('span', { class: 'badge badge--felt' }, item.kind || '精彩瞬间'),
      players.length ? h('span', { class: 'badge' }, `主角 ${players.map((p) => p.name).join('、')}`) : null,
      h('span', { class: 'hl__title' }, item.title),
      h('span', { class: 'hl__date' }, fmtDate(item.happened_on || item.created_at))
    ),

    player
      ? h(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: '9px', marginTop: '9px' } },
          avatarEl(player, 'sm'),
          h('span', { style: { fontSize: '12px', color: 'var(--ink-600)' } }, player.bio || player.name)
        )
      : null,

    item.content ? h('div', { class: 'hl__content' }, item.content) : null,

    item.image ? h('div', { class: 'hl__image' }, h('img', { src: `/uploads/${item.image}`, alt: item.title, loading: 'lazy' })) : null,

    h(
      'div',
      { class: 'hl__foot' },
      match
        ? h(
            'span',
            { class: 'badge badge--info' },
            `关联对局 #${match.id} · ${fmtDate(match.played_at)} · ${(match.camps || [])
              .filter((c) => c.is_winner)
              .map((c) => `${c.name} ${c.total_score} 分`)
              .join(' / ') || '无阵营过线'}`
          )
        : null,
      item.season_id && store.seasonById(item.season_id)
        ? h('span', { class: 'badge' }, store.seasonById(item.season_id).name)
        : null,
      h(
        'button',
        {
          'data-write': '',
          class: 'btn btn--xs btn--ghost',
          style: { marginLeft: 'auto' },
          type: 'button',
          onclick: async () => {
            const done = await confirmDeleteHighlight(item);
            if (done) renderHighlights(root);
          },
        },
        '删除'
      )
    )
  );
}
