/* 应用入口：路由、顶栏、初始化 */

import { store } from './store.js';
import { h, notifyErr } from './util.js';

import { renderScoring } from './views/scoring.js';
import { renderDashboard } from './views/dashboard.js';
import { renderLeaderboard } from './views/leaderboard.js';
import { renderMatches } from './views/matches.js';
import { renderPlayers } from './views/players.js';
import { renderHighlights } from './views/highlights.js';
import { renderSeasons } from './views/seasons.js';

const ROUTES = {
  scoring: renderScoring,
  dashboard: renderDashboard,
  leaderboard: renderLeaderboard,
  matches: renderMatches,
  players: renderPlayers,
  highlights: renderHighlights,
  seasons: renderSeasons,
};

const DEFAULT_ROUTE = 'scoring';

/** 各页面自己负责重绘，这里只同步顶栏与导航高亮 */
function paint() {
  const route = ROUTES[store.route] ? store.route : DEFAULT_ROUTE;
  const root = document.getElementById('view');

  document.querySelectorAll('#tabs .tab').forEach((btn) => {
    const on = btn.dataset.route === route;
    btn.classList.toggle('is-active', on);
    if (on) btn.setAttribute('aria-current', 'page');
    else btn.removeAttribute('aria-current');
  });

  root.innerHTML = '';
  try {
    ROUTES[route](root);
  } catch (err) {
    console.error(err);
    root.append(
      h(
        'div',
        { class: 'card' },
        h(
          'div',
          { class: 'empty' },
          h('div', { class: 'empty__icon' }, '⚠️'),
          h('div', { class: 'empty__title' }, '页面渲染出错'),
          h('div', { class: 'empty__desc' }, err.message || String(err)),
          err.stack
            ? h(
                'details',
                { style: { marginTop: '12px', textAlign: 'left', maxWidth: '640px' } },
                h('summary', { style: { cursor: 'pointer', fontSize: '12px' } }, '技术细节'),
                h(
                  'pre',
                  {
                    style: {
                      fontSize: '11px',
                      textAlign: 'left',
                      whiteSpace: 'pre-wrap',
                      background: 'var(--ink-050)',
                      padding: '10px',
                      borderRadius: '6px',
                      marginTop: '8px',
                    },
                  },
                  err.stack
                )
              )
            : null,
          h('button', { class: 'btn', type: 'button', onclick: () => paint() }, '重试')
        )
      )
    );
  }
  // body 现在是滚动容器（见 style.css），回到顶部要滚 body 而不是 window
  document.body.scrollTop = 0;
  document.documentElement.scrollTop = 0;
}

function setRoute(route, { syncHash = true } = {}) {
  if (!ROUTES[route]) route = DEFAULT_ROUTE;
  store.route = route;
  if (syncHash && location.hash !== `#${route}`) {
    location.hash = route;
    return; // hashchange 会触发一次 paint
  }
  paint();
}

function updateSeasonPill() {
  const nameEl = document.getElementById('currentSeasonName');
  if (!nameEl) return;
  const season = store.currentSeason;
  if (season) nameEl.textContent = season.name;
  else if (store.seasons.length) nameEl.textContent = '全部赛季';
  else nameEl.textContent = '未创建赛季';
}

function seasonMenuItem(id, name, active, note) {
  return h(
    'button',
    {
      class: `season-menu__item${active ? ' is-active' : ''}`,
      type: 'button',
      role: 'option',
      'aria-selected': active ? 'true' : 'false',
      onclick: () => {
        store.setSeason(id);
        closeSeasonMenu();
      },
    },
    h('span', {}, name),
    h('span', { class: 'muted' }, note)
  );
}

function renderSeasonMenu() {
  const menu = document.getElementById('seasonMenu');
  if (!menu) return;
  menu.innerHTML = '';
  if (store.seasons.length === 0) {
    menu.append(h('div', { class: 'season-menu__empty' }, '还没有赛季'));
    return;
  }
  const allActive = store.currentSeasonId === null || store.currentSeasonId === undefined;
  menu.append(seasonMenuItem(null, '全部赛季', allActive, '含所有赛季'));
  for (const s of store.seasons) {
    menu.append(seasonMenuItem(s.id, s.name, s.id === store.currentSeasonId, s.status === 'active' ? '进行中' : '已归档'));
  }
}

function openSeasonMenu() {
  const menu = document.getElementById('seasonMenu');
  const btn = document.getElementById('seasonPillBtn');
  if (!menu || !btn) return;
  renderSeasonMenu();
  menu.hidden = false;
  btn.setAttribute('aria-expanded', 'true');
}

function closeSeasonMenu() {
  const menu = document.getElementById('seasonMenu');
  const btn = document.getElementById('seasonPillBtn');
  if (menu) menu.hidden = true;
  if (btn) btn.setAttribute('aria-expanded', 'false');
}

function updateFooter() {
  const el = document.getElementById('serverMeta');
  if (!el) return;
  el.textContent = `服务器时间 ${store.meta.serverTime || ''}`;
}

function loadingScreen() {
  return h(
    'div',
    { class: 'empty' },
    h('div', { class: 'empty__icon' }, '♠'),
    h('div', { class: 'empty__title' }, '正在加载数据…')
  );
}

function errorScreen(err) {
  return h(
    'div',
    { class: 'card' },
    h(
      'div',
      { class: 'empty' },
      h('div', { class: 'empty__icon' }, '🔌'),
      h('div', { class: 'empty__title' }, '读不到数据'),
      h('div', { class: 'empty__desc' }, err.message || String(err)),
      h(
        'button',
        {
          class: 'btn btn--primary',
          type: 'button',
          onclick: () => {
            location.reload();
          },
        },
        '重新加载'
      )
    )
  );
}

async function boot() {
  const root = document.getElementById('view');
  root.append(loadingScreen());

  try {
    await store.load();
  } catch (err) {
    console.error(err);
    root.innerHTML = '';
    root.append(errorScreen(err));
    return;
  }

  // 网页端只读：显示顶部提示条
  if (store.readonly) {
    const banner = document.getElementById('roBanner');
    if (banner) banner.hidden = false;
  }

  // 导航
  document.querySelectorAll('#tabs .tab').forEach((btn) => {
    btn.addEventListener('click', () => setRoute(btn.dataset.route));
  });
  // 点击 Logo（沟通牌）直接回到总览
  const brand = document.querySelector('.brand');
  if (brand && brand.dataset.route) {
    const goDashboard = () => setRoute(brand.dataset.route);
    brand.addEventListener('click', goDashboard);
    brand.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        goDashboard();
      }
    });
  }
  window.addEventListener('hashchange', () => setRoute(location.hash.slice(1) || DEFAULT_ROUTE, { syncHash: false }));

  // 赛季快速切换下拉
  const pillBtn = document.getElementById('seasonPillBtn');
  if (pillBtn) {
    pillBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const menu = document.getElementById('seasonMenu');
      if (!menu || menu.hidden) openSeasonMenu();
      else closeSeasonMenu();
    });
  }
  document.addEventListener('click', (e) => {
    const sw = document.getElementById('seasonSwitcher');
    if (sw && !sw.contains(e.target)) closeSeasonMenu();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSeasonMenu();
  });

  store.subscribe((_, event) => {
    updateSeasonPill();
    // 切赛季会改变所有列表的数据口径（总览 / 排行榜 / 对局记录 / 玩家 / 高光），
    // 必须整页重绘；只更新右上角的名字会让人以为「点了没反应」。
    if (event && event.type === 'season') paint();
  });

  const initial = location.hash.slice(1);
  store.route = ROUTES[initial] ? initial : DEFAULT_ROUTE;

  updateSeasonPill();
  updateFooter();

  if (location.hash !== `#${store.route}`) {
    location.hash = store.route;
  } else {
    paint();
  }

  // 全局兜底：未捕获的 Promise 错误给个提示，避免「点了没反应」
  window.addEventListener('unhandledrejection', (e) => {
    console.error(e.reason);
    notifyErr(e.reason && e.reason.message ? e.reason.message : '操作失败，请重试');
  });
}

boot();
