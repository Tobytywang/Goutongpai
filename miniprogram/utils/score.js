// 沟通牌计分核心逻辑（从服务端 lib/score.js 原样复刻，纯函数，无副作用）
// 规则口径：一副牌 52 张，仅 K/10/5 计分，合计 100 分/副；获胜线为牌库总分一半（严格超过）。

const POINTS_PER_DECK = 100;

const CARD_POINTS = [
  { face: 'K', points: 10, copies: 4 },
  { face: '10', points: 10, copies: 4 },
  { face: '5', points: 5, copies: 4 },
];

const DECK_BREAKDOWN = CARD_POINTS.map((c) => ({ ...c, subtotal: c.points * c.copies }));

const deckSum = DECK_BREAKDOWN.reduce((sum, c) => sum + c.subtotal, 0);
if (deckSum !== POINTS_PER_DECK) {
  throw new Error(`计分口径不自洽：单副牌 K/10/5 合计 ${deckSum} 分，应等于 ${POINTS_PER_DECK} 分`);
}

function deckTotal(deckCount) {
  const n = clampDeckCount(deckCount);
  return n * POINTS_PER_DECK;
}

function winLine(deckCount) {
  return Math.floor(deckTotal(deckCount) / 2);
}

function clampDeckCount(deckCount) {
  const n = Math.floor(Number(deckCount));
  if (!Number.isFinite(n) || n < 1) return 1;
  if (n > 10) return 10;
  return n;
}

function toScore(value) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

function computeMatch(camps, entries, deckCount) {
  const total = deckTotal(deckCount);
  const line = winLine(deckCount);

  const rows = camps.map((camp) => {
    const own = entries.filter((e) => String(e.camp_id) === String(camp.id));
    const finishedEntries = own.filter((e) => Boolean(e.finished));
    const activeScore = finishedEntries.reduce((sum, e) => sum + toScore(e.score), 0);
    const wastedScore = own
      .filter((e) => !Boolean(e.finished))
      .reduce((sum, e) => sum + toScore(e.score), 0);

    return {
      id: camp.id,
      name: camp.name,
      color: camp.color || null,
      memberCount: own.length,
      finishedCount: finishedEntries.length,
      totalScore: activeScore,
      wastedScore,
      isWinner: activeScore > line,
      mvpCount: own.filter((e) => Boolean(e.is_mvp)).length,
    };
  });

  const winners = rows.filter((r) => r.isWinner);
  const claimed = rows.reduce((sum, r) => sum + r.totalScore, 0);
  const remaining = Math.max(0, total - claimed);

  return {
    rows,
    deckTotal: total,
    winLine: line,
    winners,
    unresolved: winners.length !== 1,
    remaining,
    wasted: rows.reduce((sum, r) => sum + r.wastedScore, 0),
    reconciledTotal: claimed + remaining,
  };
}

function describeMatch(camps, entries, deckCount) {
  const result = computeMatch(camps, entries, deckCount);
  if (result.winners.length === 0) {
    return `牌库总分 ${result.deckTotal} 分，获胜线 ${result.winLine} 分，本局无阵营过线`;
  }
  if (result.winners.length > 1) {
    return `牌库总分 ${result.deckTotal} 分，获胜线 ${result.winLine} 分，出现 ${result.winners.length} 个阵营同时过线，请核对录入`;
  }
  const w = result.winners[0];
  return `${w.name} 以 ${w.totalScore} 分拿下本局（牌库总分 ${result.deckTotal} 分，获胜线 ${result.winLine} 分）`;
}

module.exports = {
  POINTS_PER_DECK,
  CARD_POINTS,
  DECK_BREAKDOWN,
  deckTotal,
  winLine,
  clampDeckCount,
  toScore,
  computeMatch,
  describeMatch,
};
