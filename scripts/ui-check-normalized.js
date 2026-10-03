// 规范化后全页面验收：控制台异常 + 关键元素字号/间距实测 + 截图
const BASE = 'http://127.0.0.1:5178';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const routes = ['dashboard', 'scoring', 'matches', 'highlights', 'leaderboard', 'players', 'seasons'];

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
  const errors = [];
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.text || 'err');
  });
  await send('Runtime.enable');

  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });

  for (const r of routes) {
    await send('Page.navigate', { url: `${BASE}/#${r}` });
    await sleep(1400);
    const info = await ev(`(function(){
      const sizes = new Set();
      document.querySelectorAll('.view *').forEach(el => {
        const fs = getComputedStyle(el).fontSize;
        if (fs) sizes.add(fs);
      });
      return {
        title: document.title,
        fsValues: [...sizes].sort((a,b)=>parseFloat(a)-parseFloat(b)),
        badges: [...document.querySelectorAll('.badge')].slice(0,4).map(b=>b.textContent.trim().replace(/\\s+/g,' ')),
      };
    })()`);
    console.log(`#${r}:`, JSON.stringify(info));
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    require('fs').writeFileSync(`.preview/norm-desktop-${r}.png`, Buffer.from(data, 'base64'));
  }

  // 窄屏一览
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  for (const r of ['scoring', 'matches', 'players']) {
    await send('Page.navigate', { url: `${BASE}/#${r}` });
    await sleep(1400);
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    require('fs').writeFileSync(`.preview/norm-mobile-${r}.png`, Buffer.from(data, 'base64'));
  }

  console.log('CONSOLE_ERRORS:', JSON.stringify(errors));
  process.exit(0);
})();
