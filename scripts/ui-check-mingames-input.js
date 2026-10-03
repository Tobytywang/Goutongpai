// 排行榜「最少出场」输入框尺寸验收：与旁边下拉框等高、无内联 padding 覆盖
const BASE = 'http://127.0.0.1:5178';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const list = await (await fetch('http://127.0.0.1:9225/json/list')).json();
  const page = list.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let seq = 0;
  const pending = new Map();
  const errors = [];
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) pending.get(m.id)(m.result), pending.delete(m.id);
    else if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.text);
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
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `${BASE}/#leaderboard` });
  await sleep(1800);

  console.log(
    await ev(`(function(){
      const inp = document.querySelector('input[type="number"][aria-label="最少出场局数"]');
      if (!inp) return 'NOT FOUND';
      const s = getComputedStyle(inp);
      const sel = document.querySelector('select.input');
      const ss = sel ? getComputedStyle(sel) : null;
      const r = inp.getBoundingClientRect();
      return JSON.stringify({
        width: Math.round(r.width),
        height: Math.round(r.height),
        padding: s.padding,
        selectHeight: ss ? Math.round(sel.getBoundingClientRect().height) : null
      });
    })()`)
  );
  console.log('console errors =>', errors.length ? errors : 'none');

  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  require('fs').writeFileSync('.preview/lb-mingames-input.png', Buffer.from(data, 'base64'));
  console.log('saved .preview/lb-mingames-input.png');
  process.exit(0);
})();
