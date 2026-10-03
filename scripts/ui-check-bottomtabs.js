// 窄屏底部 Tab 栏顺序验收：短名与图标须为 计分/对局/高光/排名/选手/赛季
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
  await send('Network.clearBrowserCache');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send('Page.navigate', { url: `${BASE}/#dashboard` });
  await sleep(1500);

  console.log(
    await ev(`(function(){
      const tabs = [...document.querySelectorAll('.tab')];
      const out = tabs.map(t => {
        const b = getComputedStyle(t, '::before').content;
        const a = getComputedStyle(t, '::after').content;
        return { route: t.dataset.route, label: a, icon: b, active: t.classList.contains('is-active') };
      });
      return JSON.stringify(out, null, 0);
    })()`)
  );

  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  require('fs').writeFileSync('.preview/mobile-bottomtabs.png', Buffer.from(data, 'base64'));
  console.log('saved .preview/mobile-bottomtabs.png');
  process.exit(0);
})();
