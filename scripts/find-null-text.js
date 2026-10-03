// 定位页面中的 "null" 文本节点
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
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  };
  const send = (method, params = {}) => new Promise((res) => {
    const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params }));
  });
  await send('Page.enable');
  await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  await send('Page.navigate', { url: 'http://127.0.0.1:5178/#dashboard' });
  await sleep(1800);
  const expr = `(function(){
    const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
    const hits=[];
    while(walker.nextNode()){
      if(walker.currentNode.textContent.trim()==='null'){
        const p=walker.currentNode.parentElement;
        hits.push({tag:p.tagName,cls:String(p.className),parent:String(p.parentElement&&p.parentElement.className),grand:String(p.parentElement&&p.parentElement.parentElement&&p.parentElement.parentElement.className)});
      }
    }
    return JSON.stringify(hits);
  })()`;
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
  console.log('hits =>', r.result && r.result.result && r.result.result.value);
  process.exit(0);
})();
