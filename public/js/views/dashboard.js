/* 总览：赛季关键数字 + 榜首 + 最近对局 + 最新高光 */

import { store } from '../store.js';
import { computePlayerStats, computeOverview, sortStats } from '../stats.js';
import { h, avatarEl, fmtRelative, fmtDate, pct } from '../util.js';

export function renderDashboard(root) {
  root.innerHTML = '';

  const seasonId = store.currentSeasonId;
  const season = store.currentSeason;
  const overview = computeOverview(store.matches, store.players, seasonId);
  const stats = computePlayerStats(store.matches, store.players, seasonId);
  const ranked = sortStats(stats.filter((r) => r.games > 0), 'wins');

  const recentMatches = store.matchesOfSeason(seasonId).slice(0, 6);
  const recentHighlights = store.highlightsOfSeason(seasonId).slice(0, 4);

  const children = [
    h(
      'div',
      { class: 'page-head' },
      h(
        'div',
        {},
        h('h1', {}, season ? season.name : '总览'),
        h(
          'div',
          { class: 'sub' },
          season
            ? `${fmtDate(season.started_on) || '未填开始日期'} 起 · 共 ${overview.matchCount} 局`
            : '还没有赛季'
        )
      ),
      h(
        'div',
        { class: 'head-actions' },
        h(
          'a',
          { class: 'btn btn--primary', href: '#scoring', style: { textDecoration: 'none' } },
          '去记分'
        ),
        h(
          'a',
          { class: 'btn', href: '#leaderboard', style: { textDecoration: 'none' } },
          '看排行榜'
        )
      )
    ),

    // 关键数字
    h(
      'div',
      { class: 'grid grid--stats' },
      statCard('对局数', overview.matchCount, '局', season ? '当前赛季' : '全部'),
      statCard('出过场的人', overview.activePlayerCount, '人', `共登记 ${overview.playerCount} 人`)
    ),

    h(
      'div',
      { class: 'grid grid--2', style: { marginTop: '16px' } },
      // 榜首
      h(
        'div',
        { class: 'card' },
        h(
          'div',
          { class: 'card__head' },
          h('h2', {}, '赛季榜首'),
          h('span', { class: 'hint' }, '按胜局排序')
        ),
        h(
          'div',
          { class: 'card__body card__body--flush' },
          ranked.length === 0
            ? h(
                'div',
                { class: 'empty' },
                h('div', { class: 'empty__icon' }, '🏆'),
                h('div', { class: 'empty__title' }, '还没有战绩'),
                h('div', { class: 'empty__desc' }, '保存第一局后，这里会显示领先的人')
              )
            : h(
                'div',
                {},
                ranked.slice(0, 5).map((r, i) =>
                  h(
                    'div',
                    { class: 'match-row', style: { display: 'flex', alignItems: 'center', gap: '11px' } },
                    h('span', { class: `rank-medal rank-medal--${i + 1 <= 3 ? i + 1 : 0}` }, String(i + 1)),
                    avatarEl(r.player, 'sm'),
                    h(
                      'div',
                      { style: { flex: '1 1 auto', minWidth: '0' } },
                      h('div', { style: { fontWeight: '600', fontSize: '13px' } }, r.name),
                      h(
                        'div',
                        { class: 'muted', style: { fontSize: '11px' } },
                        `${r.games} 局 · 胜率 ${pct(r.wins, r.games)} · 出完率 ${pct(r.finishedGames, r.games)}`
                      )
                    ),
                    h(
                      'div',
                      { style: { textAlign: 'right' } },
                      h('div', { class: 'mono', style: { fontSize: '17px', fontWeight: '640' } }, String(r.wins)),
                      h('div', { class: 'muted', style: { fontSize: '11px' } }, `总得分 ${r.banked}`)
                    )
                  )
                )
              )
        )
      ),

      // 最近对局
      h(
        'div',
        { class: 'card' },
        h(
          'div',
          { class: 'card__head' },
          h('h2', {}, '最近对局'),
          h('a', { class: 'hint', href: '#matches', style: { textDecoration: 'none' } }, '查看全部 →')
        ),
        h(
          'div',
          { class: 'card__body card__body--flush' },
          recentMatches.length === 0
            ? h('div', { class: 'empty' }, h('div', { class: 'empty__icon' }, '🃏'), h('div', { class: 'empty__title' }, '还没有对局'))
            : h('div', {}, recentMatches.map((m) => recentMatchRow(m)))
        )
      )
    ),

    // 最新高光
    recentHighlights.length
      ? h(
          'div',
          { class: 'card', style: { marginTop: '16px' } },
          h(
            'div',
            { class: 'card__head' },
            h('h2', {}, '最新高光'),
            h('a', { class: 'hint', href: '#highlights', style: { textDecoration: 'none' } }, '查看全部 →')
          ),
          h(
            'div',
            { class: 'card__body' },
            h(
              'div',
              { class: 'grid grid--2' },
              recentHighlights.map((item) => {
                const players = (item.player_ids || []).map((id) => store.playerById(id)).filter(Boolean);
                const player = players[0] || null;
                return h(
                  'div',
                  { style: { display: 'flex', gap: '10px', alignItems: 'flex-start' } },
                  player ? avatarEl(player, 'sm') : h('span', {}, '✨'),
                  h(
                    'div',
                    { style: { minWidth: '0' } },
                    h('div', { style: { display: 'flex', gap: '7px', alignItems: 'center', flexWrap: 'wrap' } },
                      h('span', { class: 'badge badge--felt' }, item.kind || '精彩瞬间'),
                      h('span', { style: { fontWeight: '600', fontSize: '13px' } }, item.title)
                    ),
                    item.content ? h('div', { class: 'muted', style: { fontSize: '12px', marginTop: '3px' } }, item.content.slice(0, 70) + (item.content.length > 70 ? '…' : '')) : null
                  )
                );
              })
            )
          )
        )
      : null,
  ];

  // root.append(null) 会把 "null" 渲染成文本节点，必须过滤
  root.append(...children.filter(Boolean));
}

function statCard(label, value, unit, foot, tone = '') {
  return h(
    'div',
    { class: 'card stat' },
    h('div', { class: 'stat__label' }, label),
    h('div', { class: `stat__value ${tone}` }, String(value), unit ? h('small', {}, unit) : null),
    h('div', { class: 'stat__foot' }, foot || '')
  );
}

function recentMatchRow(m) {
  const winners = (m.camps || []).filter((c) => c.is_winner);
  const summary = winners.length === 1
    ? `${winners[0].name} 赢 ${winners[0].total_score} 分`
    : winners.length === 0
      ? '无阵营过线'
      : '多阵营过线（待核对）';

  return h(
    'div',
    { class: 'match-row', style: { display: 'flex', alignItems: 'center', gap: '11px', flexWrap: 'wrap' } },
    h('span', { class: 'mono muted', style: { fontSize: '11px' } }, `#${m.id}`),
    h(
      'div',
      { style: { flex: '1 1 190px', minWidth: '0' } },
      h('div', { style: { fontSize: '13px', fontWeight: winners.length === 1 ? '600' : '400' } }, summary),
      h(
        'div',
        { class: 'muted', style: { fontSize: '11px' } },
        `${fmtDate(m.played_at)} · ${m.deck_count} 副牌 · ${(m.camps || []).map((c) => `${c.name} ${c.total_score}`).join(' / ')}`
      )
    ),
    h('span', { class: 'muted', style: { fontSize: '11px' } }, fmtRelative(m.played_at))
  );
}
