// 窄屏顶栏：赛季按钮应靠右（margin-left:auto 生效）；桌面端不受影响
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

  const measure = async (label) => {
    await sleep(1200);
    console.log(`=== ${label} ===`);
    console.log(
      await ev(`(function(){
        const pill = document.querySelector('.season-pill');
        if (!pill) return 'NO PILL';
        const inner = document.querySelector('.topbar__inner').getBoundingClientRect();
        const pr = pill.getBoundingClientRect();
        return JSON.stringify({
          pillRight: Math.round(pr.right),
          topbarRightPad: Math.round(inner.right - pr.right),
          gapFromBrand: Math.round(pr.left - document.querySelector('.brand').getBoundingClientRect().right),
          marginLeft: getComputedStyle(pill.closest('.topbar__right')).marginLeft
        });
      })()`)
    );
  };

  await send('Emulation.setDeviceMetricsOverride', { width: 500, height: 844, deviceScaleFactor: 2, mobile: true });
  await send('Page.navigate', { url: `${BASE}/#dashboard` });
  await measure('窄屏 500px / 总览');

  await send('Page.navigate', { url: `${BASE}/#scoring` });
  await measure('窄屏 500px / 计分');

  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 820, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `${BASE}/#dashboard` });
  await measure('桌面 1280px / 总览');

  // 截图窄屏观感
  await send('Emulation.setDeviceMetricsOverride', { width: 500, height: 844, deviceScaleFactor: 2, mobile: true });
  await send('Page.navigate', { url: `${BASE}/#dashboard` });
  await sleep(1500);
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  require('fs').writeFileSync('.preview/mobile-seasonpill.png', Buffer.from(data, 'base64'));
  console.log('saved .preview/mobile-seasonpill.png');
  process.exit(0);
})();
