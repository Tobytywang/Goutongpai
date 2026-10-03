/* 赛季管理 */

import { store } from '../store.js';
import { h, notifyOk, notifyErr, fmtDate, localToday } from '../util.js';
import { promptNewSeason, promptEditSeason, confirmDeleteSeason } from '../forms.js';
import { computePlayerStats, sortStats } from '../stats.js';

/** 供其它页面复用的「新建赛季」入口 */
export async function promptAndCreate(onCreated) {
  const season = await promptNewSeason({ onCreated });
  if (onCreated && season) onCreated(season);
  return season;
}

export function renderSeasons(root) {
  root.innerHTML = '';

  const list = h('div', { class: 'season-list' });

  root.append(
    h(
      'div',
      { class: 'page-head' },
      h(
        'div',
        {},
        h('h1', {}, '赛季'),
        h('div', { class: 'sub' }, '每局归属一个赛季，排行榜按赛季独立统计')
      ),
      h(
        'div',
        { class: 'head-actions' },
        h(
          'button',
          {
            class: 'btn btn--primary',
            type: 'button',
            onclick: () => promptNewSeason({ onCreated: () => renderSeasons(root) }),
          },
          '+ 新建赛季'
        )
      )
    ),
    list
  );

  if (store.seasons.length === 0) {
    list.append(
      h(
        'div',
        { class: 'card', style: { gridColumn: '1 / -1' } },
        h(
          'div',
          { class: 'empty' },
          h('div', { class: 'empty__icon' }, '🗓'),
          h('div', { class: 'empty__title' }, '还没有赛季'),
          h('div', { class: 'empty__desc' }, '赛季是统计的容器，先建一个再开始记分'),
          h(
            'button',
            { class: 'btn btn--primary', type: 'button', onclick: () => promptNewSeason({ onCreated: () => renderSeasons(root) }) },
            '创建赛季'
          )
        )
      )
    );
    return;
  }

  for (const season of store.seasons) {
    const matches = store.matches.filter((m) => m.season_id === season.id);
    const players = new Set();
    for (const m of matches) {
      for (const c of m.camps || []) {
        for (const e of c.players || []) players.add(e.player_id);
      }
    }

    // MVP：该赛季被标记为本局 MVP 次数最多的玩家（同次数按胜局、入账分兜底）
    const ranked = sortStats(computePlayerStats(matches, store.players, season.id), 'mvp');
    const mvpRow = ranked.find((r) => r.mvp > 0);
    const mvpText = mvpRow ? `${mvpRow.name} · ${mvpRow.mvp} 次` : '—';

    const isCurrent = season.id === store.currentSeasonId;

    list.append(
      h(
        'div',
        { class: 'card season-row' },
        h(
          'div',
          { class: 'season-row__main' },
          h(
            'div',
            { class: 'season-row__title' },
            h('h3', {}, season.name),
            h('span', { class: `badge ${season.status === 'active' ? 'badge--felt' : ''}` }, season.status === 'active' ? '进行中' : '已归档'),
            isCurrent ? h('span', { class: 'badge badge--info' }, '当前赛季') : null
          ),
          h(
            'div',
            { class: 'season-row__meta' },
            `${fmtDate(season.started_on) || '未填'} → ${season.ended_on ? fmtDate(season.ended_on) : '进行中'}`
          ),
          season.note ? h('div', { class: 'season-row__meta' }, season.note) : null
        ),
        h(
          'div',
          { class: 'season-row__stats' },
          stat('对局数', `${matches.length} 局`),
          stat('参与玩家', `${players.size} 人`),
          stat('MVP', mvpText)
        ),
        h(
          'div',
          { class: 'season-row__actions' },
          isCurrent
            ? null
            : h(
                'button',
                { class: 'btn btn--xs', type: 'button', onclick: () => store.setSeason(season.id) },
                '设为当前'
              ),
          h('button', { class: 'btn btn--xs', type: 'button', onclick: () => promptEditSeason(season).then(() => renderSeasons(root)) }, '编辑'),
          h(
            'button',
            {
              class: 'btn btn--xs btn--danger',
              type: 'button',
              onclick: async () => {
                const done = await confirmDeleteSeason(season);
                if (done) renderSeasons(root);
              },
            },
            '删除'
          )
        )
      )
    );
  }
}

function stat(label, value) {
  return h(
    'div',
    { class: 'season-row__stat' },
    h('div', { class: 'stat__label' }, label),
    h('div', { class: 'stat__value' }, value)
  );
}
