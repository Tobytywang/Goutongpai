// 当前赛季判定：有且仅有 pinned===1 的赛季是「当前赛季」
function pickCurrentSeason(seasons) {
  const list = seasons || [];
  const idx = list.findIndex((s) => s.pinned === 1);
  const i = idx >= 0 ? idx : list.length ? 0 : -1;
  const cur = list[i];
  return { index: i < 0 ? 0 : i, id: cur ? cur.id : null };
}

// 在赛季下拉最前插入「全部赛季」选项（id=null 表示不过滤 / 计分页表示未选赛季）
const ALL_SEASON = { id: null, name: '全部赛季' };

// 当前赛季标签：仅 pinned=1 的赛季显示
function isCurrentSeason(s) {
  return s.pinned === 1;
}

// 为下拉选项生成带「当前赛季」后缀的展示文案
function seasonLabel(s) {
  return isCurrentSeason(s) ? `${s.name} 【当前赛季】` : s.name;
}

function withSeasonLabels(seasons) {
  return (seasons || []).map((s) => Object.assign({}, s, { label: seasonLabel(s) }));
}

function withAllSeason(seasons) {
  const labeled = withSeasonLabels(seasons);
  return [{ ...ALL_SEASON, label: ALL_SEASON.name }, ...labeled];
}

module.exports = { pickCurrentSeason, withAllSeason, withSeasonLabels, ALL_SEASON };
