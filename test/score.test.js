'use strict';

/**
 * 计分口径自检：`npm test`
 * 这里锁死三条业务规则，改动计分逻辑时第一时间能发现回归。
 */

const test = require('node:test');
const assert = require('node:assert');

const score = require('../lib/score');

test('单副牌分数构成闭合到 100 分', () => {
  const sum = score.DECK_BREAKDOWN.reduce((s, c) => s + c.subtotal, 0);
  assert.strictEqual(sum, 100, 'K/10/5 的分数合计应为 100');

  const k = score.DECK_BREAKDOWN.find((c) => c.face === 'K');
  assert.strictEqual(k.points, 10);
  assert.strictEqual(k.copies, 4);
  assert.strictEqual(k.subtotal, 40);
});

test('牌库总分 = 牌副数 × 100', () => {
  assert.strictEqual(score.deckTotal(1), 100);
  assert.strictEqual(score.deckTotal(2), 200);
  assert.strictEqual(score.deckTotal(3), 300);
});

test('获胜线取一半，且必须严格超过', () => {
  assert.strictEqual(score.winLine(2), 100);

  const camps = [
    { id: 1, name: '红队' },
    { id: 2, name: '蓝队' },
  ];

  // 正好 100 分：不胜
  const tie = score.computeMatch(
    camps,
    [
      { camp_id: 1, score: 100, finished: true },
      { camp_id: 2, score: 0, finished: true },
    ],
    2
  );
  assert.strictEqual(tie.winners.length, 0, '拿到 100 分（正好一半）不算获胜');

  // 101 分：胜
  const win = score.computeMatch(
    camps,
    [
      { camp_id: 1, score: 101, finished: true },
      { camp_id: 2, score: 0, finished: true },
    ],
    2
  );
  assert.strictEqual(win.winners.length, 1);
  assert.strictEqual(win.winners[0].name, '红队');
});

test('没把牌出完的人，分数不计入阵营总分', () => {
  const camps = [
    { id: 1, name: '红队' },
    { id: 2, name: '蓝队' },
  ];
  const result = score.computeMatch(
    camps,
    [
      { camp_id: 1, score: 120, finished: true }, // 计入
      { camp_id: 1, score: 50, finished: false }, // 作废
      { camp_id: 2, score: 30, finished: true },
    ],
    2
  );

  const red = result.rows.find((r) => r.name === '红队');
  assert.strictEqual(red.totalScore, 120, '只累加出完牌的 120 分');
  assert.strictEqual(red.wastedScore, 50, '没出完的 50 分单独记为作废分');
  assert.strictEqual(red.isWinner, true, '120 > 100 获胜');

  const blue = result.rows.find((r) => r.name === '蓝队');
  assert.strictEqual(blue.isWinner, false);
});

test('三人以上阵营同样适用', () => {
  const camps = [
    { id: 1, name: '甲营' },
    { id: 2, name: '乙营' },
    { id: 3, name: '丙营' },
  ];
  const result = score.computeMatch(
    camps,
    [
      { camp_id: 1, score: 60, finished: true },
      { camp_id: 2, score: 90, finished: true },
      { camp_id: 3, score: 45, finished: true },
      { camp_id: 3, score: 20, finished: false },
    ],
    2
  );

  assert.strictEqual(result.rows[2].totalScore, 45, '丙营只算已出完的 45 分');
  assert.strictEqual(result.rows[2].wastedScore, 20);
  assert.strictEqual(result.winners.length, 0, '无人超过 100 分');
});

test('牌副数会被收敛到 1~10', () => {
  assert.strictEqual(score.clampDeckCount(0), 1);
  assert.strictEqual(score.clampDeckCount(-3), 1);
  assert.strictEqual(score.clampDeckCount(99), 10);
  assert.strictEqual(score.clampDeckCount('3'), 3);
});

test('负数与非法分数按 0 处理', () => {
  assert.strictEqual(score.toScore(-10), 0);
  assert.strictEqual(score.toScore('abc'), 0);
  assert.strictEqual(score.toScore('35'), 35);
});
