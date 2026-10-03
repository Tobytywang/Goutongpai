/* 把一张 PNG 的指定区域放大后重新截图，便于肉眼核对像素级对齐 */
const { spawn } = require('node:child_process');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9335;

const file = process.argv[2];
const x0 = Number(process.argv[3] || 0);
const y0 = Number(process.argv[4] || 0);
const x1 = Number(process.argv[5] || 600);
const y1 = Number(process.argv[6] || 200);
const scale = Number(process.argv[7] || 2);

const W = Math.round((x1 - x0) * scale);
const H = Math.round((y1 - y0) * scale);

const hdr = fs.readFileSync(file);
const pngW = hdr.readUInt32BE(16);
const pngH = hdr.readUInt32BE(20);

const html = `<!doctype html><meta charset="utf-8">
<style>
  html,body{margin:0;padding:0;overflow:hidden;background:#fff}
  #wrap{position:relative;width:${W}px;height:${H}px;overflow:hidden}
  img{position:absolute;left:${-x0 * scale}px;top:${-y0 * scale}px;width:${pngW * scale}px;height:${
  pngH * scale
}px;image-rendering:pixelated}
  #grid{position:absolute;inset:0;pointer-events:none}
</style>
<div id="wrap"><img src="file:///${file.replace(/\\/g, '/')}"><div id="grid"></div></div>
<script>
  const s = ${scale}, x0 = ${x0}, y0 = ${y0}, x1 = ${x1}, y1 = ${y1};
  const g = document.getElementById('grid');
  for (let x = Math.ceil(x0 / 20) * 20; x < x1; x += 20) {
    const d = document.createElement('div');
    d.style.cssText = 'position:absolute;top:0;bottom:0;width:1px;background:rgba(255,0,255,.45)';
    d.style.left = (x - x0) * s + 'px';
    if (x % 100 === 0) d.style.background = 'rgba(0,120,255,.7)';
    g.appendChild(d);
  }
  for (let y = Math.ceil(y0 / 20) * 20; y < y1; y += 20) {
    const d = document.createElement('div');
    d.style.cssText = 'position:absolute;left:0;right:0;height:1px;background:rgba(0,200,0,.35)';
    d.style.top = (y - y0) * s + 'px';
    g.appendChild(d);
  }
</script>`;

const tmpHtml = path.join(os.tmpdir(), 'gtp-zoom-' + Date.now() + '.html');
fs.writeFileSync(tmpHtml, html);

function getJSON(url) {
  return new Promise((res, rej) => {
    http
      .get(url, (r) => {
        let b = '';
        r.on('data', (c) => (b += c));
        r.on('end', () => {
          try {
            res(JSON.parse(b));
          } catch (e) {
            rej(e);
          }
        });
      })
      .on('error', rej);
  });
}
const waitEvent = (t, type) => new Promise((r) => t.addEventListener(type, r, { once: true }));
const wsSend = (ws, payload) =>
  new Promise((resolve) => {
    const onMsg = (ev) => {
      let msg;
      try {
        msg = JSON.parse(typeof ev.data === 'string' ? ev.data : String(ev.data));
      } catch (e) {
        return;
      }
      if (msg.id === payload.id) {
        ws.removeEventListener('message', onMsg);
        resolve(msg);
      }
    };
    ws.addEventListener('message', onMsg);
    ws.send(JSON.stringify(payload));
  });

(async () => {
  const userData = path.join(os.tmpdir(), 'gtp-zoom-chrome-' + Date.now());
  const chrome = spawn(
    CHROME,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--allow-file-access-from-files',
      '--remote-debugging-port=' + PORT,
      '--user-data-dir=' + userData,
      '--window-size=' + W + ',' + H,
      'file:///' + tmpHtml.replace(/\\/g, '/'),
    ],
    { stdio: 'ignore' }
  );

  let version = null;
  for (let i = 0; i < 40 && !version; i++) {
    await new Promise((r) => setTimeout(r, 300));
    try {
      version = await getJSON(`http://127.0.0.1:${PORT}/json/version`);
    } catch (e) {}
  }
  if (!version) {
    console.log('CHROME_START_FAILED');
    chrome.kill();
    process.exit(1);
  }
  const targets = await getJSON(`http://127.0.0.1:${PORT}/json/list`);
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await waitEvent(ws, 'open');
  let id = 0;
  await wsSend(ws, {
    id: ++id,
    method: 'Emulation.setDeviceMetricsOverride',
    params: { width: W, height: H, deviceScaleFactor: 1, mobile: false },
  });
  await new Promise((r) => setTimeout(r, 900));
  const shot = await wsSend(ws, { id: ++id, method: 'Page.captureScreenshot', params: { format: 'png' } });
  const b64 = shot.result && shot.result.data;
  const out = 'D:/Workspace/GouTongPai/tmp-zoom.png';
  fs.writeFileSync(out, Buffer.from(b64, 'base64'));
  console.log(`裁剪区 x[${x0},${x1}] y[${y0},${y1}] 放大 ${scale}x → ${W}x${H}`);
  console.log('saved: ' + out);
  ws.close();
  chrome.kill();
  process.exit(0);
})();
