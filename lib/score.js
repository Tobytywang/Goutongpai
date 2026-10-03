'use strict';

/**
 * 沟通牌计分核心逻辑（纯函数，无副作用，便于单独验证）
 *
 * 规则口径：
 *   1. 一副牌 52 张，其中只有 K / 10 / 5 计分：
 *        K  = 10 分 × 4 张 = 40 分
 *        10 = 10 分 × 4 张 = 40 分
 *        5  =  5 分 × 4 张 = 20 分
 *      合计 100 分/副，即 CARD_POINTS 之和恰好闭合到 POINTS_PER_DECK。
 *   2. 牌库总分 = 牌副数 × 100。
 *   3. 获胜线 = 牌库总分的一半（向下取整）。
 *      判定用「严格超过」，即 camp.total > winLine 才获胜。
 *      例：2 副牌 → 总分 200 → 一半 100 → 需拿到 101 分及以上才算赢。
 *   4. 阵营总分只累加「已把牌出完」的玩家分数；未出完牌的玩家分数作废，
 *      不计入阵营总分，也不参与最终结算。
 */

/** 每副牌的可分配总分 */
const POINTS_PER_DECK = 100;

/** 单张牌的记分面值（每种花色各 4 张） */
const CARD_POINTS = [
  { face: 'K', points: 10, copies: 4 },
  { face: '10', points: 10, copies: 4 },
  { face: '5', points: 5, copies: 4 },
];

/**
 * 单副牌的分数构成，用于界面展示与自检。
 * 校验：Σ(points × copies) === POINTS_PER_DECK
 */
const DECK_BREAKDOWN = CARD_POINTS.map((c) => ({ ...c, subtotal: c.points * c.copies }));

// 开发期自检：分数构成必须闭合到 100 分/副，否则启动即报错。
const deckSum = DECK_BREAKDOWN.reduce((sum, c) => sum + c.subtotal, 0);
if (deckSum !== POINTS_PER_DECK) {
  throw new Error(
    `计分口径不自洽：单副牌 K/10/5 合计 ${deckSum} 分，应等于 ${POINTS_PER_DECK} 分`
  );
}

/** 牌库总分 = 牌副数 × 100 */
function deckTotal(deckCount) {
  const n = clampDeckCount(deckCount);
  return n * POINTS_PER_DECK;
}

/** 获胜线 = 牌库总分的一半（向下取整），需严格超过 */
function winLine(deckCount) {
  return Math.floor(deckTotal(deckCount) / 2);
}

/** 牌副数收敛到 1~10 的整数 */
function clampDeckCount(deckCount) {
  const n = Math.floor(Number(deckCount));
  if (!Number.isFinite(n) || n < 1) return 1;
  if (n > 10) return 10;
  return n;
}

/** 非负整数分数 */
function toScore(value) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

/**
 * 依据阵营与得分明细，计算每阵营的总分、是否获胜、是否已锁定胜局。
 *
 * @param {Array<{id:number|string, name:string, color?:string}>} camps 阵营列表
 * @param {Array<{camp_id:number|string, score:number, finished:boolean|number, is_mvp?:boolean}>} entries 得分明细
 * @param {number} deckCount 牌副数
 * @returns {{rows:Array, winLine:number, deckTotal:number, winners:Array, unresolved:boolean, remaining:number}}
 */
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
      /** 计入结算的有效分 */
      totalScore: activeScore,
      /** 因未出完牌而作废的分数（仅展示用，不入账） */
      wastedScore,
      isWinner: activeScore > line,
      mvpCount: own.filter((e) => Boolean(e.is_mvp)).length,
    };
  });

  const winners = rows.filter((r) => r.isWinner);

  // 剩余可争夺分数：牌库总分扣掉所有阵营已吃到的有效分
  const claimed = rows.reduce((sum, r) => sum + r.totalScore, 0);
  const wasted = rows.reduce((sum, r) => sum + r.wastedScore, 0);
  const remaining = Math.max(0, total - claimed);

  return {
    rows,
    deckTotal: total,
    winLine: line,
    winners,
    /**
     * 是否「尚未分出胜负」：
     * 多个阵营同时过线（录入有误或规则特殊），或无人过线。
     */
    unresolved: winners.length !== 1,
    remaining,
    wasted,
    /** 各阵营有效分之和 + 剩余 + 作废，理论上应闭合到牌库总分 */
    reconciledTotal: claimed + remaining,
  };
}

/**
 * 单局结算文案（用于高光/战报自动生成）
 */
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
