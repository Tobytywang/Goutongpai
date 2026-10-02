// 移动端导航验收：测量底部 Tab 栏定位、触摸目标高度、防遮挡；并回填桌面端是否原样
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
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
    screenWidth: 390,
    screenHeight: 844,
  });

  const measureMobile = async (route) => {
    await send('Page.navigate', { url: `${BASE}/#${route}` });
    await sleep(1600);
    return ev(`(function(){
      try {
        const tabs = document.querySelector('.tabs');
        const tb = tabs.getBoundingClientRect();
        const cs = getComputedStyle(tabs);
        const tabEls = [...document.querySelectorAll('.tab')];
        const heights = tabEls.map(t => Math.round(t.getBoundingClientRect().height));
        const before = getComputedStyle(tabEls[0], '::before');
        const iconContent = before.content;
        // 内容是否被遮挡：取页面最后一个卡片/区块的底边，与 tabs 顶边比较
        const view = document.querySelector('.view');
        const last = [...view.children].filter(c => c.getBoundingClientRect().height > 0).pop();
        const lastBottom = last ? Math.round(last.getBoundingClientRect().bottom) : null;
        return JSON.stringify({
          tabsPosition: cs.position,
          tabsLeft: Math.round(tb.left), tabsRight: Math.round(tb.right),
          tabsBottom: Math.round(tb.bottom), tabsTop: Math.round(tb.top),
          vh: window.innerHeight,
          tabCount: tabEls.length,
          tabMinHeight: Math.min(...heights),
          tabMaxHeight: Math.max(...heights),
          iconShown: iconContent && iconContent !== 'none' && iconContent !== 'normal',
          viewPadBottom: getComputedStyle(view).paddingBottom,
          lastContentBottom: lastBottom,
          covered: lastBottom ? lastBottom > tb.top + 1 : false,
          activeTab: (document.querySelector('.tab.is-active')||{}).textContent
        });
      } catch(e){ return 'ERR:'+e.message; }
    })()`);
  };

  console.log('=== 移动端 390x844 / 计分台 ===');
  console.log(await measureMobile('scoring'));
  console.log('=== 移动端 / 排行榜 ===');
  console.log(await measureMobile('leaderboard'));

  // 桌面端：应仍是顶部横排（position 非 fixed）、无图标
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 820, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `${BASE}/#scoring` });
  await sleep(1400);
  console.log('=== 桌面端 1280 / 导航应原样 ===');
  console.log(
    await ev(`(function(){
      const tabs = document.querySelector('.tabs');
      const cs = getComputedStyle(tabs);
      const before = getComputedStyle(document.querySelector('.tab'), '::before');
      const inner = tabs.getBoundingClientRect();
      return JSON.stringify({
        tabsPosition: cs.position,
        tabsTop: Math.round(inner.top),
        tabsInTopbar: inner.top < 120,
        iconShown: before.content && before.content !== 'none' && before.content !== 'normal'
      });
    })()`)
  );

  // 截图移动端底栏观感
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send('Page.navigate', { url: `${BASE}/#scoring` });
  await sleep(1500);
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  require('fs').writeFileSync('.preview/mobile-scoring.png', Buffer.from(data, 'base64'));
  console.log('saved .preview/mobile-scoring.png');
  process.exit(0);
})();
