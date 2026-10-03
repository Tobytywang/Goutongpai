// 排行榜：从 matches 聚合每位选手累计得分 / 胜局 / MVP（与 Web 端同源）
const { get } = require('../../utils/request');

Page({
  data: {
    rankings: [],
    loading: true,
  },

  onShow() {
    this.load();
  },

  onPullDownRefresh() {
    this.load().then(() => wx.stopPullDownRefresh());
  },

  async load() {
    this.setData({ loading: true });
    try {
      const d = await get('/api/bootstrap');
      const players = d.players || [];
      const nameMap = {};
      players.forEach((p) => (nameMap[p.id] = p.name));

      const agg = {};
      (d.matches || []).forEach((m) =>
        m.camps.forEach((c) => {
          c.players.forEach((s) => {
            if (!agg[s.player_id]) {
              agg[s.player_id] = { id: s.player_id, name: nameMap[s.player_id] || '#' + s.player_id, total: 0, wins: 0, mvp: 0 };
            }
            agg[s.player_id].total += s.score;
            if (s.is_mvp) agg[s.player_id].mvp += 1;
          });
          if (c.is_winner) {
            c.players.forEach((s) => {
              if (agg[s.player_id]) agg[s.player_id].wins += 1;
            });
          }
        })
      );

      const rankings = Object.values(agg).sort((a, b) => b.total - a.total);
      this.setData({ rankings, loading: false });
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: e.message, icon: 'none' });
    }
  },
});
