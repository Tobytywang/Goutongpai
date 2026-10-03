/* 对局记录：逐局查看、账目校验、删除 */

import { store } from '../store.js';
import { auditMatch } from '../stats.js';
import { h, avatarEl, fmtDate, fmtRelative, matchSeqByDay, debounce } from '../util.js';
import { confirmDeleteMatch } from '../forms.js';

/* 「全部赛季」开关放在 store 上（顶栏切赛季时会重置），keyword/expanded 留在本模块 */
const ui = { keyword: '', expanded: new Set() };

export function renderMatches(root) {
  root.innerHTML = '';

  const seasonId = store.scopeAll ? null : store.currentSeasonId;
  let matches = store.matchesOfSeason(seasonId);

  if (ui.keyword) {
    const kw = ui.keyword.toLowerCase();
    matches = matches.filter((m) => {
      const names = (m.camps || [])
        .flatMap((c) => (c.players || []).map((e) => store.playerById(e.player_id)))
        .filter(Boolean)
        .map((p) => p.name)
        .join(' ');
      const campNames = (m.camps || []).map((c) => c.name).join(' ');
      return `${names} ${campNames} ${m.table_name || ''} ${m.note || ''}`.toLowerCase().includes(kw);
    });
  }

  const scopeLabel = store.scopeAll ? '全部赛季' : (store.currentSeason ? store.currentSeason.name : '全部赛季');

  root.append(
    h(
      'div',
      { class: 'page-head' },
      h(
        'div',
        {},
        h('h1', {}, '对局记录'),
        h('div', { class: 'sub' }, `${scopeLabel} · 共 ${matches.length} 局`)
      ),
      h(
        'div',
        { class: 'head-actions' },
        h(
          'div',
          { class: 'search-box' },
          h('input', {
            class: 'input',
            type: 'search',
            placeholder: '搜索玩家 / 阵营 / 桌号…',
            value: ui.keyword,
            'aria-label': '搜索对局',
            oninput: debounce((e) => {
              ui.keyword = e.target.value.trim();
              renderMatches(root);
            }, 180),
          })
        ),
        h(
          'label',
          { class: 'check' },
          h('input', {
            type: 'checkbox',
            checked: store.scopeAll,
            onchange: (e) => {
              store.scopeAll = e.target.checked;
              renderMatches(root);
            },
          }),
          h('span', {}, '全部赛季')
        )
      )
    ),
    h(
      'div',
      { class: 'card' },
      matches.length === 0 ? emptyState() : h('div', {}, matches.map((m) => matchRow(m, root, matchSeqByDay(matches))))
    )
  );
}

function emptyState() {
  return h(
    'div',
    { class: 'empty' },
    h('div', { class: 'empty__icon' }, '📝'),
    h('div', { class: 'empty__title' }, '还没有对局记录'),
    h('div', { class: 'empty__desc' }, '去计分台录入第一局吧')
  );
}

function matchRow(match, root, seq) {
  const audit = auditMatch(match);
  const expanded = ui.expanded.has(match.id);
  const seqNo = seq && seq.get(match.id);

  const head = h(
    'div',
    { class: 'match-row__head' },
    h('span', { class: 'match-row__no' }, `#${match.id}`),
    h('span', { class: 'match-row__time' }, `${fmtDate(match.played_at)}${seqNo ? ` · 第 ${seqNo} 局` : ''}`),
    h('span', { class: 'muted', style: { fontSize: '11px' } }, fmtRelative(match.played_at)),
    h('span', { class: 'badge' }, `${match.deck_count} 副牌 · 牌库 ${match.deck_total} 分 · 线 ${match.win_line}`),
    match.table_name ? h('span', { class: 'badge badge--info' }, match.table_name) : null,
    audit.winners === 0 ? h('span', { class: 'badge' }, '无阵营过线') : null,
    audit.winners > 1 ? h('span', { class: 'badge badge--win' }, '多阵营过线 · 待核对') : null,
    !audit.balanced ? h('span', { class: 'badge badge--win' }, '账目异常') : null,
    h(
      'button',
      {
        class: 'btn btn--xs btn--ghost',
        style: { marginLeft: 'auto' },
        type: 'button',
        onclick: () => {
          if (expanded) ui.expanded.delete(match.id);
          else ui.expanded.add(match.id);
          renderMatches(root);
        },
      },
      expanded ? '收起明细' : '展开明细'
    )
  );

  const campChips = h(
    'div',
    { class: 'match-row__camps' },
    (match.camps || []).map((camp) => {
      const names = (camp.players || [])
        .map((e) => store.playerById(e.player_id))
        .filter(Boolean)
        .map((p) => p.name);
      return h(
        'span',
        { class: `camp-chip${camp.is_winner ? ' is-winner' : ''}`, style: { '--chip-color': camp.color || 'var(--felt-600)' } },
        h('span', { class: 'camp-tag__dot', style: { background: camp.color || 'var(--felt-600)' } }),
        camp.name,
        h('span', { class: 'score' }, String(camp.total_score)),
        h('span', { class: 'members' }, `${(camp.players || []).length} 人`),
        names.length ? h('span', { class: 'camp-chip__names', title: names.join('、') }, names.join('、')) : null
      );
    })
  );

  const row = h('div', { class: 'match-row' }, head, campChips);

  if (expanded) {
    row.append(detailBlock(match, root));
  }

  return row;
}

function detailBlock(match, root) {
  const wrap = h('div', { class: 'match-detail' });
  const camps = match.camps || [];

  // 阵营横向并排：2 个各一半、3~4 个等分（窄屏由媒体查询回落单列）。
  // 列内空间有限，所以每列不再用四列表格，改成「一分一人」的紧凑行：
  // 头像 · 昵称（可省略号截断）· MVP · 分数 · 计入/作废
  const campsRow = h('div', {
    class: 'match-camps',
    style: { '--camp-n': String(Math.max(camps.length, 1)) },
  });

  for (const camp of camps) {
    const rows = (camp.players || []).map((entry) => {
      const player = store.playerById(entry.player_id);
      const name = player ? player.name : `已删除玩家 #${entry.player_id}`;
      return h(
        'div',
        {
          class: `mcamp-row${entry.finished ? '' : ' is-wasted'}`,
          title: entry.finished ? '出完牌：分数计入阵营总分' : '未出完牌：分数作废',
        },
        player ? avatarEl(player, 'sm') : null,
        h('span', { class: 'mcamp-row__name', title: name }, name),
        entry.is_mvp ? h('span', { class: 'badge badge--mvp', title: '本局 MVP' }, '★ MVP') : null,
        h('span', { class: 'mcamp-row__score' }, String(entry.score)),
        h('span', { class: `badge${entry.finished ? ' badge--felt' : ''}` }, entry.finished ? '计入' : '作废')
      );
    });

    campsRow.append(
      h(
        'div',
        { class: `match-camp${camp.is_winner ? ' is-winner' : ''}`, style: { '--camp-color': camp.color || 'var(--felt-600)' } },
        h(
          'div',
          { class: 'match-camp__head' },
          h(
            'span',
            { class: 'camp-tag' },
            h('span', { class: 'camp-tag__dot', style: { background: camp.color || 'var(--felt-600)' } }),
            camp.name,
            camp.is_winner ? h('span', { class: 'badge badge--win' }, '🏆 获胜') : null
          ),
          h(
            'span',
            { class: 'match-camp__total', title: `阵营总分 ${camp.total_score} / 获胜线 ${match.win_line}（需超过）` },
            h('b', {}, String(camp.total_score)),
            h('span', { class: 'muted' }, ` / 线 ${match.win_line}`)
          )
        ),
        h('div', { class: 'mcamp-rows' }, rows)
      )
    );
  }

  wrap.append(campsRow);

  // 账目核对面板已按用户要求从明细里去掉：阵营卡上的「总分 / 线」＋ 每行「计入 / 作废」
  // 已经能看出结果，明细只保留战果本身。（账目异常仍会在列表行的徽章上提示）
  wrap.append(
    h(
      'div',
      { style: { marginTop: '14px', display: 'flex', justifyContent: 'flex-end' } },
      h(
            h(
          'button',
          {
            'data-write': '',
            class: 'btn btn--sm btn--danger',
            type: 'button',
            onclick: async () => {
              const done = await confirmDeleteMatch(match);
              if (done) renderMatches(root);
            },
          },
          '删除本局'
        )
    )
  );

  if (match.note) {
    wrap.append(h('div', { class: 'muted', style: { fontSize: '12px', marginTop: '8px' } }, `备注：${match.note}`));
  }

  return wrap;
}
