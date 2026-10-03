'use strict';

/* 界面验收工具：通过 CDP 驱动 Chrome，模拟真实操作并逐页截图（开发辅助，非交付物） */

const fs = require('node:fs');
const path = require('node:path');

const CDP = process.env.CDP || 'http://127.0.0.1:9222';
const BASE = process.env.BASE || 'http://127.0.0.1:5178';
const OUT = process.env.OUT_DIR || path.join(__dirname, '..', '.preview');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function connect() {
  const list = await (await fetch(`${CDP}/json/list`)).json();
  const page = list.find((t) => t.type === 'page');
  if (!page) throw new Error('没有可用的页面目标');

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = () => rej(new Error('CDP 连接失败'));
  });

  let seq = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    }
  };

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++seq;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });

  return { send, ws };
}

async function evalJs(send, expression) {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) {
    throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description || ''));
  }
  return r.result.value;
}

async function waitReady(send, label) {
  for (let i = 0; i < 80; i += 1) {
    const ok = await evalJs(
      send,
      `!!document.querySelector('#tabs .tab.is-active') && !!document.querySelector('#view h1')`
    ).catch(() => false);
    if (ok) return;
    await sleep(120);
  }
  throw new Error(`页面未就绪：${label}`);
}

async function shot(send, name) {
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  fs.writeFileSync(path.join(OUT, name), Buffer.from(r.data, 'base64'));
  console.log(`  → ${name}`);
}

async function goto(send, hash) {
  await send('Page.navigate', { url: `${BASE}/#${hash}` });
  await waitReady(send, hash);
  await sleep(600);
}

const FILL_SCORING = `(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const addOne = async (campIdx) => {
    const camp = document.querySelectorAll('.camp')[campIdx];
    if (!camp) return false;
    const sel = camp.querySelector('.camp__foot .select');
    const opt = Array.from(sel.options).find(o => o.value);
    if (!opt) return false;
    sel.value = opt.value;
    camp.querySelector('.camp__foot .btn').click();
    await sleep(100);
    return true;
  };
  for (let i = 0; i < 2; i++) await addOne(0);
  for (let i = 0; i < 2; i++) await addOne(1);

  const setScore = (campIdx, rowIdx, val, finished) => {
    const camp = document.querySelectorAll('.camp')[campIdx];
    const rows = camp.querySelectorAll('.srow');
    if (!rows[rowIdx]) return false;
    const input = rows[rowIdx].querySelector('.srow__score');
    input.value = String(val);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    if (finished) rows[rowIdx].querySelectorAll('.srow__toggle')[0].click();
    return true;
  };
  setScore(0, 0, 65, true);
  setScore(0, 1, 40, true);
  setScore(1, 0, 55, true);
  setScore(1, 1, 25, false);
  await sleep(250);
  return {
    red: document.querySelectorAll('.camp')[0].querySelector('.camp__total').textContent,
    blue: document.querySelectorAll('.camp')[1].querySelector('.camp__total').textContent,
    result: document.querySelector('.result-bar__text, .result-bar').textContent.replace(/\\s+/g, ' ').trim(),
  };
})()`;

const RANK_CHECK = `(() => {
  const rows = Array.from(document.querySelectorAll('table.data tbody tr'));
  const out = rows.slice(0, 8).map(tr => Array.from(tr.children).map(td => td.textContent.trim().replace(/\\s+/g, ' ')).join(' | '));
  const head = Array.from(document.querySelectorAll('table.data thead th')).map(th => th.textContent.trim());
  return { head, out };
})()`;

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const { send } = await connect();
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  // 开发期禁用缓存，确保拿到最新代码
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1500,
    height: 1250,
    deviceScaleFactor: 1,
    mobile: false,
  });

  // 收集控制台报错
  const consoleErrors = [];
  send('Log.enable').catch(() => {});
  send('Runtime.consoleAPICalled').catch(() => {});

  console.log('\n逐页截图');

  // 先回到空白页，确保第一次导航是完整加载（避免只有 hash 变化而沿用旧模块）
  await send('Page.navigate', { url: 'about:blank' });
  await sleep(300);

  await goto(send, 'scoring');
  await shot(send, '01-scoring-empty.png');

  const filled = await evalJs(send, FILL_SCORING);
  console.log('  计分台实时计算 →', JSON.stringify(filled, null, 0));
  await sleep(500);
  await shot(send, '02-scoring-filled.png');

  await goto(send, 'dashboard');
  await shot(send, '03-dashboard.png');

  await goto(send, 'leaderboard');
  const rank = await evalJs(send, RANK_CHECK);
  console.log('\n  排行榜表头：', rank.head.join(' | '));
  console.log('  前几行：');
  rank.out.forEach((r) => console.log('    ' + r));
  await shot(send, '04-leaderboard.png');

  await goto(send, 'matches');
  await evalJs(
    send,
    `(() => { const b = Array.from(document.querySelectorAll('.match-row .btn')).find(x => /展开明细/.test(x.textContent)); if (b) b.click(); return true; })()`
  );
  await sleep(400);
  await shot(send, '05-matches.png');

  await goto(send, 'players');
  await shot(send, '06-players.png');

  await goto(send, 'highlights');
  await shot(send, '07-highlights.png');

  await goto(send, 'seasons');
  await shot(send, '08-seasons.png');

  console.log('\n完成，截图在 .preview/\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('验收脚本失败：', err.message);
  process.exit(1);
});
