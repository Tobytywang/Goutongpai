/* 全局状态：一次性拉全量数据，之后所有统计都在本地算，切页面零延迟 */

import { api } from './api.js';

const LS_KEY = 'gtp:prefs';

function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '{}') || {};
  } catch (_) {
    return {};
  }
}

export const store = {
  seasons: [],
  players: [],
  matches: [],
  highlights: [],
  meta: { pointsPerDeck: 100, deckBreakdown: [] },

  /** 当前选中的赛季 id；null 表示「全部赛季」 */
  currentSeasonId: loadPrefs().currentSeasonId ?? null,
  /**
   * 页面级的「全部赛季」开关（排行榜 / 对局记录 / 玩家 / 高光页共用）。
   * 顶栏显式选赛季时会被重置 —— 否则用户切了赛季，列表却因为「全部赛季」仍勾着而不变。
   */
  scopeAll: false,
  route: 'scoring',
  ready: false,
  /** 网页端是否只读（由后端 bootstrap.meta.webReadonly 决定） */
  readonly: false,

  prefs: loadPrefs(),

  _listeners: new Set(),

  subscribe(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  },

  /** 广播状态变化；event.type 用来区分「加载数据」与「切换赛季」，前者不整页重绘 */
  emit(event = { type: 'update' }) {
    for (const fn of this._listeners) fn(this, event);
  },

  savePrefs() {
    const { currentSeasonId, route, ...rest } = this;
    const payload = { ...loadPrefs(), ...this.prefs, currentSeasonId };
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(payload));
    } catch (_) {
      /* 隐私模式下忽略 */
    }
  },

  /** 拉取全量数据并修正无效的当前赛季 */
  async load() {
    const data = await api.bootstrap();
    this.seasons = data.seasons || [];
    this.players = data.players || [];
    this.matches = data.matches || [];
    this.highlights = (data.highlights || []).map((x) => ({
      ...x,
      player_ids: Array.isArray(x.player_ids) ? x.player_ids : x.player_id ? [x.player_id] : [],
    }));
    this.meta = data.meta || this.meta;
    this.readonly = !!(this.meta && this.meta.webReadonly);
    if (typeof document !== 'undefined' && this.readonly) {
      document.documentElement.classList.add('web-readonly');
      window.__WEB_READONLY__ = true;
    }

    // 校验当前赛季是否还存在
    if (this.currentSeasonId !== null && !this.seasons.some((s) => s.id === this.currentSeasonId)) {
      this.currentSeasonId = null;
    }
    // 首次进入自动选中最近一个进行中的赛季
    if (this.currentSeasonId === null) {
      const active = this.seasons.find((s) => s.status === 'active') || this.seasons[0];
      this.currentSeasonId = active ? active.id : null;
    }

    this.ready = true;
    this.savePrefs();
    this.emit({ type: 'load' });
  },

  /** 切换当前赛季（顶栏下拉 / 页内「设为当前」都走这里）；同一个赛季重复点不触发重绘 */
  setSeason(id) {
    const next = id === null || id === undefined ? null : Number(id);
    // scopeAll 还勾着时也算「有变化」：需要重置它并重绘，否则列表看起来没反应
    if (next === this.currentSeasonId && !this.scopeAll) return;
    this.currentSeasonId = next;
    this.scopeAll = false; // 显式选赛季 ⇒ 页内的「全部赛季」让位
    this.savePrefs();
    this.emit({ type: 'season' });
  },

  get currentSeason() {
    return this.seasons.find((s) => s.id === this.currentSeasonId) || null;
  },

  playerById(id) {
    return this.players.find((p) => p.id === Number(id)) || null;
  },

  seasonById(id) {
    return this.seasons.find((s) => s.id === Number(id)) || null;
  },

  /** 当前赛季（或全部）的对局 */
  matchesOfSeason(seasonId = this.currentSeasonId) {
    if (seasonId === null || seasonId === undefined) return this.matches;
    return this.matches.filter((m) => m.season_id === Number(seasonId));
  },

  highlightsOfSeason(seasonId = this.currentSeasonId) {
    if (seasonId === null || seasonId === undefined) return this.highlights;
    return this.highlights.filter((x) => x.season_id === Number(seasonId));
  },
};
