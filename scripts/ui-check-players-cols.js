// 玩家卡片列数验收：820px 应两列、390px 应单列、1280px 应 auto-fill
const BASE = 'http://127.0.0.1:5178';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const list = await (await fetch('http://127.0.0.1:9225/json/list')).json();
  const page = list.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let seq = 0;
  const pending = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) pending.get(m.id)(m.result), pending.delete(m.id);
  };
  const send = (method, params = {}) =>
    new Promise((res) => {
      const id = ++seq;
      pending.set(id, res);
      ws.send(JSON.stringify({ id, method, params }));
    });
  const ev = async (expr) =>
    (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.value;

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });

  const measure = async (width, mobile, label) => {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile });
    await send('Page.navigate', { url: `${BASE}/#players` });
    await sleep(1500);
    console.log(`=== ${label} ===`);
    console.log(
      await ev(`(function(){
        const grid = document.querySelector('.grid--cards');
        if (!grid) return 'NO GRID';
        const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
        const cards = grid.querySelectorAll('.player-card').length;
        const first = grid.querySelector('.player-card').getBoundingClientRect();
        return JSON.stringify({ columns: cols, cards, firstCardWidth: Math.round(first.width) });
      })()`)
    );
  };

  await measure(820, true, '中屏 820px / 期望 2 列');
  await measure(390, true, '手机 390px / 期望 1 列');
  await measure(1280, false, '桌面 1280px / 期望 auto-fill（>2 列）');

  // 截图中屏两列观感
  await send('Emulation.setDeviceMetricsOverride', { width: 820, height: 900, deviceScaleFactor: 1, mobile: true });
  await send('Page.reload', { ignoreCache: true });
  await sleep(1800);
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  require('fs').writeFileSync('.preview/mid-players-2col.png', Buffer.from(data, 'base64'));
  console.log('saved .preview/mid-players-2col.png');
  process.exit(0);
})();
