/* 玩家管理：基础信息、头像、个性照片、ID */

import { store } from '../store.js';
import { api } from '../api.js';
import { computePlayerStats } from '../stats.js';
import { h, avatarEl, notifyOk, notifyErr, pct, debounce, fmtDate, IMAGE_PRESETS, describeImage } from '../util.js';
import { promptNewPlayer, promptEditPlayer, pickImage, confirmDeletePlayer } from '../forms.js';

export function renderPlayers(root) {
  root.innerHTML = '';

  let keyword = '';

  const listWrap = h('div', { class: 'grid grid--cards' });

  const searchInput = h('input', {
    class: 'input',
    type: 'search',
    placeholder: '搜索昵称 / ID / 签名…',
    'aria-label': '搜索玩家',
    oninput: debounce((e) => {
      keyword = e.target.value.trim().toLowerCase();
      paintList();
    }, 160),
  });

  const scopeToggle = h(
    'label',
    { class: 'check', title: '默认只看当前赛季，勾选后统计全部赛季' },
    h('input', {
      type: 'checkbox',
      checked: store.scopeAll,
      onchange: (e) => {
        store.scopeAll = e.target.checked;
        paintList();
      },
    }),
    h('span', {}, '全部赛季')
  );

  root.append(
    h(
      'div',
      { class: 'page-head' },
      h(
        'div',
        {},
        h('h1', {}, '玩家'),
        h('div', { class: 'sub' }, `共 ${store.players.length} 名登记牌友 · 头像与照片可稍后随时补充`)
      ),
      h(
        'div',
        { class: 'head-actions' },
        h('div', { class: 'search-box' }, searchInput),
        scopeToggle,
        h(
          'button',
          {
            'data-write': '',
            class: 'btn btn--primary',
            type: 'button',
            onclick: () => promptNewPlayer({ onCreated: () => renderPlayers(root) }),
          },
          '+ 新增玩家'
        )
      )
    ),
    listWrap
  );

  function paintList() {
    const seasonId = store.scopeAll ? null : store.currentSeasonId;
    const stats = computePlayerStats(store.matches, store.players, seasonId);
    const statMap = new Map(stats.map((s) => [s.player_id, s]));

    const filtered = store.players.filter((p) => {
      if (!keyword) return true;
      const hay = [p.name, p.bio].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(keyword);
    });

    listWrap.innerHTML = '';

    if (filtered.length === 0) {
      listWrap.append(
        h(
          'div',
          { class: 'card', style: { gridColumn: '1 / -1' } },
          h(
            'div',
            { class: 'empty' },
            h('div', { class: 'empty__icon' }, '🔍'),
            h('div', { class: 'empty__title' }, keyword ? '没有匹配的玩家' : '还没有玩家'),
            h('div', { class: 'empty__desc' }, keyword ? '换个关键词试试' : '登记牌友后就能在计分台直接选人了')
          )
        )
      );
      return;
    }

    for (const player of filtered) {
      const s = statMap.get(player.id) || { games: 0, wins: 0, winRate: 0, banked: 0 };
      listWrap.append(playerCard(player, s));
    }
  }

  function playerCard(player, s) {
    const cover = h('div', { class: 'player-card__cover' });
    if (player.photo) {
      cover.append(h('img', { src: `/uploads/${player.photo}`, alt: '', loading: 'lazy' }));
    } else {
      cover.append(h('div', { class: 'pattern' }));
    }

    const avatarNode = player.avatar
      ? h('img', { class: 'player-card__avatar', src: `/uploads/${player.avatar}`, alt: '', loading: 'lazy' })
      : h('span', { class: 'player-card__avatar', style: { display: 'grid', placeItems: 'center', background: 'var(--felt-100)', color: 'var(--felt-800)', fontWeight: '650', fontSize: '22px' } }, Array.from(player.name)[0] || '?');

    const actions = h(
      'div',
      { class: 'player-card__actions' },
      h('button', { 'data-write': '', class: 'btn btn--xs', type: 'button', onclick: () => uploadImage(player, 'avatar') }, player.avatar ? '换头像' : '上传头像'),
      h('button', { 'data-write': '', class: 'btn btn--xs', type: 'button', onclick: () => uploadImage(player, 'photo') }, player.photo ? '换照片' : '上传照片'),
      h('button', { 'data-write': '', class: 'btn btn--xs', type: 'button', onclick: () => promptEditPlayer(player).then(() => renderPlayers(root)) }, '编辑'),
      h(
        'button',
        {
          'data-write': '',
          class: 'btn btn--xs btn--danger',
          type: 'button',
          onclick: async () => {
            const done = await confirmDeletePlayer(player);
            if (done) renderPlayers(root);
          },
        },
        '删除'
      )
    );

    return h(
      'article',
      { class: 'player-card' },
      cover,
      h(
        'div',
        { class: 'player-card__body' },
        h('div', { class: 'player-card__top' }, avatarNode, h('span', { class: 'player-card__id' }, `#${player.id}`)),
        h('div', { class: 'player-card__name' }, player.name),
        h('p', { class: 'player-card__bio' }, player.bio || '—'),
        h(
          'div',
          { class: 'player-card__stats' },
          h('div', { class: 'player-card__stat' }, h('b', {}, s.games), '出场'),
          h('div', { class: 'player-card__stat' }, h('b', {}, s.wins), '胜局'),
          h('div', { class: 'player-card__stat' }, h('b', {}, pct(s.wins, s.games)), '胜率'),
          h('div', { class: 'player-card__stat' }, h('b', {}, s.banked), '入账分')
        ),
        actions,
        player.active
          ? null
          : h('div', { style: { marginTop: '8px' } }, h('span', { class: 'badge' }, '已停用 · 不出现在计分台')),
        player.created_at ? h('div', { class: 'muted', style: { fontSize: '11px', marginTop: '8px' } }, `登记于 ${fmtDate(player.created_at)}`) : null
      )
    );
  }

  async function uploadImage(player, kind) {
    const preset = IMAGE_PRESETS[kind] || IMAGE_PRESETS.photo;
    const label = preset.label;
    const picked = await pickImage(preset);
    if (!picked) return;
    try {
      await api.uploadPlayerImage(player.id, kind, picked.dataUrl);
      await store.load();
      // 把「压了多少」直接说出来，方便核对上传是否真的被加工过
      notifyOk(`${player.name} 的${label}已更新：${describeImage(picked)}`);
      renderPlayers(root);
    } catch (err) {
      notifyErr(err.message || '上传失败');
    }
  }

  paintList();
}
