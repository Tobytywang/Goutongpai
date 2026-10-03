// 总览页统计卡验收：应只剩「对局数 / 出过场的人」两张，无分数维度
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
  await send('Page.navigate', { url: `${BASE}/#dashboard` });
  await sleep(1800);

  console.log(
    await ev(`(function(){
      const cards = [...document.querySelectorAll('.grid--stats .stat')];
      return JSON.stringify({
        count: cards.length,
        labels: cards.map((c) => c.querySelector('.stat__label')?.textContent),
        gridCols: getComputedStyle(document.querySelector('.grid--stats')).gridTemplateColumns.split(' ').length
      });
    })()`)
  );
  console.log('console errors =>', errors.length ? errors : 'none');

  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  require('fs').writeFileSync('.preview/dash-stats-clean.png', Buffer.from(data, 'base64'));
  console.log('saved .preview/dash-stats-clean.png');
  process.exit(0);
})();
