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

  // 正好 100 分、且非全员出完：不胜（验证「严格超过获胜线」这一条件）
  const tie = score.computeMatch(
    camps,
    [
      { camp_id: 1, score: 100, finished: true },
      { camp_id: 1, score: 0, finished: false }, // 红队有人没出完 → 不触发「全员出完即胜」
      { camp_id: 2, score: 0, finished: false },
    ],
    2
  );
  assert.strictEqual(tie.winners.length, 0, '拿到 100 分（正好一半）且非全员出完，不算获胜');

  // 101 分：胜
  const win = score.computeMatch(
    camps,
    [
      { camp_id: 1, score: 101, finished: true },
      { camp_id: 2, score: 0, finished: false }, // 未出完，避免触发「全员出完即胜」
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
      { camp_id: 1, score: 50, finished: false }, // 未出完
      { camp_id: 2, score: 30, finished: false }, // 未出完，避免「全员出完即胜」干扰
    ],
    2
  );

  const red = result.rows.find((r) => r.name === '红队');
  assert.strictEqual(red.totalScore, 120, '只累加出完牌的 120 分');
  assert.strictEqual(red.wastedScore, 50, '没出完的 50 分记为未出完分');
  assert.strictEqual(red.isWinner, true, '120 > 100 获胜');

  const blue = result.rows.find((r) => r.name === '蓝队');
  assert.strictEqual(blue.isWinner, false);
});

test('阵营全员出完牌即获胜（即使总分没过线）', () => {
  const camps = [
    { id: 1, name: '红队' },
    { id: 2, name: '蓝队' },
  ];
  const result = score.computeMatch(
    camps,
    [
      { camp_id: 1, score: 60, finished: true },
      { camp_id: 1, score: 30, finished: true }, // 全员出完，合计 90 < 100（未过线）
      { camp_id: 2, score: 95, finished: false }, // 未出完，作为对照不触发即胜
    ],
    2
  );

  const red = result.rows.find((r) => r.name === '红队');
  assert.strictEqual(red.totalScore, 90, '红队总分 90，未过获胜线');
  assert.strictEqual(red.isWinner, true, '但全员出完牌，仍判红队获胜');

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
      { camp_id: 1, score: 10, finished: true }, // 甲营全员出完，合计 70 < 100
      { camp_id: 2, score: 90, finished: true }, // 乙营单人出完
      { camp_id: 3, score: 45, finished: true },
      { camp_id: 3, score: 20, finished: false },
    ],
    2
  );

  assert.strictEqual(result.rows[2].totalScore, 45, '丙营只算已出完的 45 分');
  assert.strictEqual(result.rows[2].wastedScore, 20);
  assert.strictEqual(result.rows[2].isWinner, false, '丙营未全员出完，不触发即胜');
  assert.strictEqual(result.winners.length, 2, '甲、乙两营均全员出完即胜（即便总分未过线）');
});

test('全员出完规则：仅当对手未全员出完时，己方全员出完才算赢', () => {
  const camps = [
    { id: 1, name: '红队' },
    { id: 2, name: '蓝队' },
  ];

  // 双方都全员出完、且都没过线 → 不判任何阵营获胜（只按分数过线定胜负）
  const bothOut = score.computeMatch(
    camps,
    [
      { camp_id: 1, score: 50, finished: true },
      { camp_id: 1, score: 40, finished: true },
      { camp_id: 2, score: 60, finished: true },
      { camp_id: 2, score: 30, finished: true },
    ],
    2
  );
  assert.strictEqual(bothOut.winners.length, 0, '双方都全员出完且都没过线，不判胜');
  assert.strictEqual(bothOut.rows[0].isWinner, false);
  assert.strictEqual(bothOut.rows[1].isWinner, false);

  // 红队全员出完，蓝队有人没出完 → 红队判胜（即便分数没过线）
  const winByFinish = score.computeMatch(
    camps,
    [
      { camp_id: 1, score: 50, finished: true },
      { camp_id: 1, score: 40, finished: true },
      { camp_id: 2, score: 60, finished: true },
      { camp_id: 2, score: 30, finished: false },
    ],
    2
  );
  assert.strictEqual(winByFinish.rows[0].isWinner, true, '对手未全员出完，己方全员出完即胜');
  assert.strictEqual(winByFinish.rows[1].isWinner, false, '蓝队未全员出完，不触发即胜');
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
