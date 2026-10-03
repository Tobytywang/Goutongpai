// 计分录入（MVP）：选赛季 + 牌副数 + 动态阵营/玩家，实时用 score.computeMatch 预览胜负
const { get, post } = require('../../utils/request');
const score = require('../../utils/score');

function emptyCamp(name) {
  return { name: name || '', players: [] };
}
function emptyPlayer() {
  return { playerId: null, playerName: '选择玩家', playerIdx: -1, score: 0, finished: true, mvp: false };
}

Page({
  data: {
    seasons: [],
    seasonIndex: 0,
    seasonId: null,
    players: [],
    deckOptions: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    deckIndex: 1,
    camps: [emptyCamp('阵营1'), emptyCamp('阵营2')],
    result: null,
    submitting: false,
  },

  onShow() {
    if (!this.data.seasons.length) this.load();
  },

  async load() {
    try {
      const d = await get('/api/bootstrap');
      const seasons = d.seasons || [];
      const cur = seasons.findIndex((s) => s.status === 'active');
      const idx = cur >= 0 ? cur : 0;
      this.setData({
        seasons,
        players: d.players || [],
        seasonId: seasons[idx] ? seasons[idx].id : null,
        seasonIndex: idx,
      });
    } catch (e) {
      wx.showToast({ title: e.message, icon: 'none' });
    }
  },

  onSeasonChange(e) {
    const i = Number(e.detail.value);
    this.setData({ seasonIndex: i, seasonId: this.data.seasons[i].id });
  },
  onDeckChange(e) {
    this.setData({ deckIndex: Number(e.detail.value) });
    this.computePreview();
  },
  onCampName(e) {
    const ci = e.currentTarget.dataset.camp;
    const camps = this.data.camps.slice();
    camps[ci].name = e.detail.value;
    this.setData({ camps });
  },

  addCamp() {
    if (this.data.camps.length >= 4) {
      wx.showToast({ title: '最多4个阵营', icon: 'none' });
      return;
    }
    const camps = this.data.camps.concat(emptyCamp('阵营' + (this.data.camps.length + 1)));
    this.setData({ camps });
  },
  removeCamp(e) {
    if (this.data.camps.length <= 2) {
      wx.showToast({ title: '至少2个阵营', icon: 'none' });
      return;
    }
    const i = e.currentTarget.dataset.index;
    const camps = this.data.camps.slice();
    camps.splice(i, 1);
    this.setData({ camps });
    this.computePreview();
  },

  addPlayer(e) {
    const ci = e.currentTarget.dataset.camp;
    const camps = this.data.camps.slice();
    camps[ci].players = camps[ci].players.concat(emptyPlayer());
    this.setData({ camps });
  },
  removePlayer(e) {
    const { camp, pi } = e.currentTarget.dataset;
    const camps = this.data.camps.slice();
    camps[camp].players.splice(pi, 1);
    this.setData({ camps });
    this.computePreview();
  },
  onPlayerPick(e) {
    const { camp, pi } = e.currentTarget.dataset;
    const idx = Number(e.detail.value);
    const p = this.data.players[idx];
    if (!p) return;
    const camps = this.data.camps.slice();
    const cur = camps[camp].players[pi];
    camps[camp].players[pi] = {
      playerId: p.id,
      playerName: p.name,
      playerIdx: idx,
      score: cur.score,
      finished: cur.finished,
      mvp: cur.mvp,
    };
    this.setData({ camps });
    this.computePreview();
  },
  onScore(e) {
    const { camp, pi } = e.currentTarget.dataset;
    const camps = this.data.camps.slice();
    camps[camp].players[pi].score = Number(e.detail.value) || 0;
    this.setData({ camps });
    this.computePreview();
  },
  onFinished(e) {
    const { camp, pi } = e.currentTarget.dataset;
    const camps = this.data.camps.slice();
    camps[camp].players[pi].finished = !camps[camp].players[pi].finished;
    this.setData({ camps });
    this.computePreview();
  },
  onMvp(e) {
    const { camp, pi } = e.currentTarget.dataset;
    const camps = this.data.camps.slice();
    camps[camp].players[pi].mvp = !camps[camp].players[pi].mvp;
    this.setData({ camps });
  },

  computePreview() {
    const deckCount = this.data.deckOptions[this.data.deckIndex];
    const camps = this.data.camps;
    const campDefs = camps.map((c, i) => ({ id: i, name: c.name || '阵营' + (i + 1), color: '' }));
    const entries = [];
    camps.forEach((c, i) =>
      c.players.forEach((p) => {
        if (p.playerId) entries.push({ camp_id: i, score: p.score, finished: p.finished, is_mvp: p.mvp });
      })
    );
    if (!entries.length) {
      this.setData({ result: null });
      return;
    }
    this.setData({ result: score.computeMatch(campDefs, entries, deckCount) });
  },

  async submit() {
    const { seasonId, camps, deckOptions, deckIndex } = this.data;
    if (!seasonId) {
      wx.showToast({ title: '请先选择赛季', icon: 'none' });
      return;
    }
    const payloadCamps = camps.map((c) => ({
      name: c.name,
      players: c.players
        .filter((p) => p.playerId)
        .map((p) => ({ player_id: p.playerId, score: p.score, finished: p.finished ? 1 : 0, is_mvp: p.mvp ? 1 : 0 })),
    }));
    if (payloadCamps.some((c) => !c.players.length)) {
      wx.showToast({ title: '每个阵营至少1名玩家', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    try {
      await post('/api/matches', { season_id: seasonId, deck_count: deckOptions[deckIndex], camps: payloadCamps });
      wx.showToast({ title: '录入成功', icon: 'success' });
      this.setData({ camps: [emptyCamp('阵营1'), emptyCamp('阵营2')], result: null });
    } catch (e) {
      wx.showToast({ title: e.message, icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },
});
