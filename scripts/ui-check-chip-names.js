// 对局折叠行：阵营胶囊应带成员名单
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

  await send('Emulation.setDeviceMetricsOverride', { width: 900, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `${BASE}/#matches` });
  await sleep(1500);
  // 干净实例默认赛季可能没有对局：勾上「全部赛季」
  await ev(`(function(){
    const cb = document.querySelector('.head-actions input[type=checkbox]');
    if (cb && !cb.checked) { cb.click(); }
    return 'ok';
  })()`);
  await sleep(900);

  console.log(
    await ev(`(function(){
      const rows = [...document.querySelectorAll('.match-row')].slice(0, 3);
      return JSON.stringify(rows.map(r => ({
        chips: [...r.querySelectorAll('.camp-chip')].map(c => c.textContent.trim().replace(/\\s+/g, ' '))
      })), null, 0);
    })()`)
  );

  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  require('fs').writeFileSync('.preview/match-chips-names.png', Buffer.from(data, 'base64'));
  console.log('saved .preview/match-chips-names.png');
  process.exit(0);
})();
