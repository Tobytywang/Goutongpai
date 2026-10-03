/* 一次性校验：计分台日期输入 + 阵营平分宽度 */
const { spawn } = require('node:child_process');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9333;
const ROUTE = process.argv[2] || 'scoring';
const URL = 'http://127.0.0.1:5178/#' + ROUTE;

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

function waitEvent(target, type) {
  return new Promise((resolve) => target.addEventListener(type, resolve, { once: true }));
}

function wsSend(ws, payload) {
  return new Promise((resolve) => {
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
}

(async () => {
  const userData = path.join(os.tmpdir(), 'gtp-chrome-' + Date.now());
  const chrome = spawn(
    CHROME,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--remote-debugging-port=' + PORT,
      '--user-data-dir=' + userData,
      '--window-size=1280,900',
      URL,
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

  const WebSocket = globalThis.WebSocket;
  if (!WebSocket) {
    console.log('NO_NATIVE_WEBSOCKET');
    chrome.kill();
    process.exit(1);
  }
  const targets = await getJSON(`http://127.0.0.1:${PORT}/json/list`);
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await waitEvent(ws, 'open');

  let id = 0;
  const evaluate = async (expr) => {
    const msg = await wsSend(ws, {
      id: ++id,
      method: 'Runtime.evaluate',
      params: { expression: expr, awaitPromise: true, returnByValue: true },
    });
    if (msg.result && msg.result.exceptionDetails) {
      return { error: msg.result.exceptionDetails.text };
    }
    return msg.result && msg.result.result ? msg.result.result.value : null;
  };

  await new Promise((r) => setTimeout(r, 4500));

  if (ROUTE === 'matches') {
    // demo 数据多在非当前赛季：勾选「全部赛季」再取
    await evaluate(`(() => {
      const cb = [...document.querySelectorAll('.head-actions .check input')][0];
      if (cb && !cb.checked) cb.click();
      return true;
    })()`);
    await new Promise((r) => setTimeout(r, 900));
    const mp = await evaluate(`(() => {
      const rows = [...document.querySelectorAll('.match-row')];
      const diag = {
        url: location.hash,
        h1: document.querySelector('h1') ? document.querySelector('h1').textContent : null,
        sub: document.querySelector('.sub') ? document.querySelector('.sub').textContent : null,
        cardText: document.querySelector('.view .card') ? document.querySelector('.view .card').textContent.slice(0, 120) : null,
      };
      return {
        diag,
        rowCount: rows.length,
        times: rows.slice(0, 6).map((r) => {
          const t = r.querySelector('.match-row__time');
          const rel = r.querySelector('.muted');
          return { no: r.querySelector('.match-row__no') ? r.querySelector('.match-row__no').textContent : null, time: t ? t.textContent : null, rel: rel ? rel.textContent : null };
        }),
        hasClock: rows.some((r) => /\\d{2}:\\d{2}/.test(r.querySelector('.match-row__time') ? r.querySelector('.match-row__time').textContent : '')),
      };
    })()`);
    console.log('=== 对局记录（日期 + 第几局）===');
    console.log(JSON.stringify(mp, null, 2));
    ws.close();
    chrome.kill();
    process.exit(0);
  }

  if (ROUTE === 'errors') {
    const errors = [];
    ws.addEventListener('message', (ev) => {
      let m;
      try {
        m = JSON.parse(typeof ev.data === 'string' ? ev.data : String(ev.data));
      } catch (e) {
        return;
      }
      if (m.method === 'Runtime.exceptionThrown') {
        const d = m.params.exceptionDetails;
        errors.push(
          'EXCEPTION: ' +
            (d.exception ? d.exception.description || d.exception.value : d.text) +
            ' @ ' + (d.url || '?') + ':' + d.lineNumber + ':' + d.columnNumber
        );
      }
      if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
        errors.push('LOG: ' + m.params.entry.text + (m.params.entry.url ? ' @ ' + m.params.entry.url : ''));
      }
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
        errors.push('CONSOLE: ' + m.params.args.map((a) => a.description || JSON.stringify(a.value)).join(' '));
      }
    });
    await wsSend(ws, { id: ++id, method: 'Runtime.enable', params: {} });
    await wsSend(ws, { id: ++id, method: 'Log.enable', params: {} });
    await wsSend(ws, { id: ++id, method: 'Page.enable', params: {} });
    await wsSend(ws, { id: ++id, method: 'Page.navigate', params: { url: 'http://127.0.0.1:5178/#' + (process.argv[3] || 'scoring') } });
    await new Promise((r) => setTimeout(r, 5000));
    console.log('=== 页面错误 ===');
    console.log(errors.length ? errors.join('\n---\n') : '(无错误)');
    ws.close();
    chrome.kill();
    process.exit(0);
  }

  if (ROUTE === 'text') {
    const target = process.argv[3] || 'leaderboard';
    await evaluate(`location.hash = '#${target}'`);
    await new Promise((r) => setTimeout(r, 1600));
    const t = await evaluate(`(() => {
      const v = document.querySelector('.view');
      return {
        hash: location.hash,
        htmlLen: v ? v.innerHTML.length : -1,
        text: v ? v.textContent.replace(/\\s+/g, ' ').slice(0, 400) : null,
        playerNames: [...document.querySelectorAll('.cell-player__name, .player-card__name')].map((n) => n.textContent).slice(0, 8),
        hasGtCode: /GT-\\d/.test(v ? v.textContent : ''),
      };
    })()`);
    console.log('=== ' + target + ' 渲染 ===');
    console.log(JSON.stringify(t, null, 2));
    ws.close();
    chrome.kill();
    process.exit(0);
  }

  if (ROUTE === 'playerform') {
    const diagBoot = await evaluate(`(async () => {
      const v = document.querySelector('.view') || document.querySelector('main');
      let boot = null;
      try {
        const r = await fetch('/api/bootstrap');
        const j = await r.json();
        boot = { ok: j.ok, seasons: j.data ? j.data.seasons.length : null, players: j.data ? j.data.players.length : null };
      } catch (e) {
        boot = { error: String(e) };
      }
      return {
        viewSel: v ? v.className : null,
        viewHtmlLen: v ? v.innerHTML.length : -1,
        viewText: v ? v.textContent.replace(/\\s+/g, ' ').slice(0, 160) : null,
        boot,
      };
    })()`);
    console.log('=== 首屏诊断 ===');
    console.log(JSON.stringify(diagBoot, null, 2));

    // 打开「新增玩家」弹窗，读取字段清单
    const openInfo = await evaluate(`(() => {
      const btns = [...document.querySelectorAll('button')].map((b) => b.textContent.trim());
      const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('新玩家'));
      if (b) b.click();
      return { found: !!b, allButtons: btns.slice(0, 20) };
    })()`);
    console.log('=== 点击诊断 ===');
    console.log(JSON.stringify(openInfo, null, 2));
    await new Promise((r) => setTimeout(r, 900));
    const pf = await evaluate(`(() => {
      const modal = document.querySelector('.modal, [role=dialog]');
      if (!modal) return { error: 'no modal' };
      const fields = [...modal.querySelectorAll('label')].map((l) => l.textContent.trim()).filter(Boolean);
      const inputs = [...modal.querySelectorAll('input, textarea, select')].map((i) => ({
        tag: i.tagName, type: i.type || '', name: i.name || '', placeholder: i.placeholder || '',
      }));
      const ids = [...modal.querySelectorAll('input')].map((i) => i.name);
      return { fieldLabels: fields, controls: inputs, controlNames: ids, hasPlayerCode: ids.includes('player_code'), hasStyle: ids.includes('style') };
    })()`);
    console.log('=== 新增玩家弹窗字段 ===');
    console.log(JSON.stringify(pf, null, 2));

    // 关闭后打开「编辑玩家」（玩家页）
    await evaluate(`(() => { const b = [...document.querySelectorAll('.modal button, [role=dialog] button')].find(x => /取消/.test(x.textContent)); if (b) b.click(); return true; })()`);
    await new Promise((r) => setTimeout(r, 400));
    await evaluate(`location.hash = '#players'`);
    await new Promise((r) => setTimeout(r, 1500));
    const playersView = await evaluate(`(() => {
      const btns = [...document.querySelectorAll('.player-card button')].map((b) => b.textContent.trim());
      const edit = [...document.querySelectorAll('.player-card button')].find((b) => b.textContent.includes('编辑'));
      if (edit) edit.click();
      return { cardButtons: btns };
    })()`);
    await new Promise((r) => setTimeout(r, 700));
    const ef = await evaluate(`(() => {
      const modal = document.querySelector('.modal, [role=dialog]');
      if (!modal) return { error: 'no modal' };
      const ids = [...modal.querySelectorAll('input, textarea, select')].map((i) => i.name);
      const labels = [...modal.querySelectorAll('label')].map((l) => l.textContent.trim());
      return { labels, names: ids, hasPlayerCode: ids.includes('player_code'), hasStyle: ids.includes('style') };
    })()`);
    console.log('=== 玩家卡片按钮 ===');
    console.log(JSON.stringify(playersView, null, 2));
    console.log('=== 编辑玩家弹窗字段 ===');
    console.log(JSON.stringify(ef, null, 2));

    ws.close();
    chrome.kill();
    process.exit(0);
  }

  if (ROUTE === 'stepper') {
    const sp = await evaluate(`(() => {
      const round = (n) => Math.round(n * 10) / 10;
      const box = (el) => { const r = el.getBoundingClientRect(); return { x: round(r.x), w: round(r.width), right: round(r.right) }; };
      const stepper = document.querySelector('.stepper');
      const bar = document.querySelector('.setup-bar');
      const kids = [...stepper.children].map((c) => ({ tag: c.tagName, txt: (c.textContent || c.value || '').trim(), ...box(c) }));
      const fields = [...bar.querySelectorAll(':scope > .field')].map((f) => ({
        label: f.querySelector('label') ? f.querySelector('label').textContent : '',
        field: box(f),
        control: f.querySelector('.stepper, .input, .select') ? box(f.querySelector('.stepper, .input, .select')) : null,
      }));
      return {
        bar: box(bar),
        stepper: box(stepper),
        stepperStyle: (() => { const s = getComputedStyle(stepper); return { justify: s.justifyContent, padding: s.padding, gap: s.gap }; })(),
        kids,
        plusBtnStyle: (() => { const b = [...stepper.querySelectorAll('button')].pop(); const s = getComputedStyle(b); return { w: b.getBoundingClientRect().width, padding: s.padding, textAlign: s.textAlign, display: s.display, justify: s.justifyContent }; })(),
        fields,
        tailGap: round(bar.getBoundingClientRect().right - (fields[fields.length - 1].control ? fields[fields.length - 1].control.right : 0)),
      };
    })()`);
    console.log('=== 步进器与设置栏几何 ===');
    console.log(JSON.stringify(sp, null, 2));
    ws.close();
    chrome.kill();
    process.exit(0);
  }

  if (ROUTE === 'shotmodal') {
    // 打开一个弹窗表单后截图，检查控件高度统一改动没有破坏其它页面
    await wsSend(ws, { id: ++id, method: 'Page.navigate', params: { url: 'about:blank' } });
    await new Promise((r) => setTimeout(r, 300));
    await wsSend(ws, { id: ++id, method: 'Page.navigate', params: { url: 'http://127.0.0.1:5178/#players' } });
    await new Promise((r) => setTimeout(r, 4800));
    const clicked = await evaluate(`(() => {
      const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('新玩家'));
      if (b) b.click();
      return !!b;
    })()`);
    await new Promise((r) => setTimeout(r, 900));
    const modalState = await evaluate(`(() => {
      const m = document.querySelector('.modal, .overlay, [role="dialog"]');
      if (!m) return 'NO_MODAL';
      return [...m.querySelectorAll('input, select, textarea, .stepper')].map((c) => {
        const r = c.getBoundingClientRect();
        return (c.tagName.toLowerCase() + '.' + (c.className || '')).slice(0, 30) + ' h=' + Math.round(r.height);
      });
    })()`);
    console.log('clicked=' + clicked + ' modal=' + JSON.stringify(modalState));
    const shot = await wsSend(ws, { id: ++id, method: 'Page.captureScreenshot', params: { format: 'png' } });
    require('node:fs').writeFileSync(
      'D:/Workspace/GouTongPai/tmp-modal.png',
      Buffer.from(shot.result.data, 'base64')
    );
    console.log('saved: D:/Workspace/GouTongPai/tmp-modal.png');
    ws.close();
    chrome.kill();
    process.exit(0);
  }

  if (ROUTE === 'shot') {
    const W = Number(process.argv[3] || 1090);
    const H = Number(process.argv[4] || 720);
    await wsSend(ws, {
      id: ++id,
      method: 'Emulation.setDeviceMetricsOverride',
      params: { width: W, height: H, deviceScaleFactor: 1, mobile: false },
    });
    await new Promise((r) => setTimeout(r, 900));
    const order = await evaluate(`(() => {
      const card = document.querySelector('.view .card');
      return [...card.children].map((c, i) => (i + 1) + '. ' + (c.className || c.tagName) +
        (c.classList.contains('camps') ? '  ★阵营区' : '') +
        (c.classList.contains('entry-bar') ? '  ★操作条(增加阵营/新增高光)' : ''));
    })()`);
    console.log('=== 卡片内区块顺序 ===');
    console.log(order.join('\\n'));
    const rects = await evaluate(`(() => {
      const round = (n) => Math.round(n * 10) / 10;
      const bar = document.querySelector('.setup-bar');
      const fields = [...bar.querySelectorAll(':scope > .field')];
      return {
        viewport: innerWidth,
        fields: fields.map((f) => {
          const l = f.querySelector(':scope > label');
          const c = f.querySelector('.stepper, .input, .select');
          return {
            label: l ? l.textContent : '',
            labelX: l ? round(l.getBoundingClientRect().x) : null,
            ctrlX: c ? round(c.getBoundingClientRect().x) : null,
            width: round(f.getBoundingClientRect().width),
          };
        }),
      };
    })()`);
    const shot = await wsSend(ws, { id: ++id, method: 'Page.captureScreenshot', params: { format: 'png' } });
    const b64 = shot.result && shot.result.data;
    if (!b64) {
      console.log('SHOT_FAILED', JSON.stringify(shot).slice(0, 300));
      process.exit(1);
    }
    const out = 'D:/Workspace/GouTongPai/tmp-shot.png';
    require('node:fs').writeFileSync(out, Buffer.from(b64, 'base64'));
    console.log('=== ' + W + ' 宽下的标签/控件位置 ===');
    console.log(JSON.stringify(rects, null, 2));
    console.log('saved: ' + out);
    ws.close();
    chrome.kill();
    process.exit(0);
  }

  if (ROUTE === 'entrybar') {
    // 本轮改动：读数（牌库总分/获胜线）下移到保存行；新增高光变成操作条上的按钮
    const layout = await evaluate(`(() => {
      const card = document.querySelector('.view .card');
      const bar = document.querySelector('.entry-bar');
      const facts = document.querySelector('.result-bar .facts');
      const panel = document.querySelector('.hl-compose');
      return {
        order: [...card.children].map((c, i) => (i + 1) + '. ' + (c.className || c.tagName)),
        barText: bar.textContent.replace(/\\s+/g, ' ').trim(),
        barButtons: [...bar.querySelectorAll('button')].map((b) => b.textContent.trim()),
        factsLeftInTopBar: !!document.querySelector('.entry-bar .item b'),
        factsText: facts ? facts.textContent.replace(/\\s+/g, ' ').trim() : null,
        factsInsideResultBar: !!(facts && facts.parentElement.classList.contains('result-bar')),
        factsRect: facts ? (() => { const r = facts.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; })() : null,
        saveBtnRect: (() => { const b = [...document.querySelectorAll('.result-bar button')].pop(); const r = b.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), h: Math.round(r.height) }; })(),
        panelHidden: panel ? panel.hidden : null,
        barBg: getComputedStyle(bar).backgroundColor,
        setupBarBg: getComputedStyle(document.querySelector('.setup-bar')).backgroundColor,
        saveRowButtons: [...document.querySelectorAll('.result-bar button')].map((b) => b.textContent.trim()),
        saveRowText: document.querySelector('.result-bar').textContent.replace(/\\s+/g, ' ').trim(),
      };
    })()`);
    console.log('=== 布局 ===');
    console.log(JSON.stringify(layout, null, 2));

    const open1 = await evaluate(`(async () => {
      const b = [...document.querySelectorAll('.entry-bar button')].find((x) => x.textContent.includes('新增高光'));
      if (!b) return 'NO_BUTTON';
      b.click();
      await new Promise((r) => setTimeout(r, 150));
      const panel = document.querySelector('.hl-compose');
      const active = document.activeElement;
      return {
        panelHidden: panel.hidden,
        focused: active ? active.tagName + '/' + (active.getAttribute('aria-label') || '') : null,
        barButtons: [...document.querySelectorAll('.entry-bar button')].map((x) => x.textContent.trim()),
      };
    })()`);
    console.log('=== 点「+ 新增高光」 ===');
    console.log(JSON.stringify(open1, null, 2));

    const added = await evaluate(`(async () => {
      const t = document.querySelector('.hl-compose__row .input');
      if (!t) return 'NO_TITLE_INPUT';
      t.value = '测试高光一条';
      const b = [...document.querySelectorAll('.hl-compose button')].find((x) => x.textContent.trim() === '添加这条');
      b.click();
      await new Promise((r) => setTimeout(r, 550));
      const bar = document.querySelector('.entry-bar');
      return {
        pendingRows: document.querySelectorAll('.hl-pending').length,
        barText: bar.textContent.replace(/\\s+/g, ' ').trim(),
        barButtons: [...bar.querySelectorAll('button')].map((x) => x.textContent.trim()),
        savedDraftHighlights: (JSON.parse(localStorage.getItem('gtp:draft') || '{}').highlights || []).map((x) => x.title),
      };
    })()`);
    console.log('=== 添加一条高光 ===');
    console.log(JSON.stringify(added, null, 2));

    const closed = await evaluate(`(async () => {
      const b = [...document.querySelectorAll('.entry-bar button')].find((x) => x.textContent.includes('收起'));
      if (!b) return 'NO_COLLAPSE_BUTTON';
      b.click();
      await new Promise((r) => setTimeout(r, 150));
      return {
        panelHidden: document.querySelector('.hl-compose').hidden,
        barText: document.querySelector('.entry-bar').textContent.replace(/\\s+/g, ' ').trim(),
        barButtons: [...document.querySelectorAll('.entry-bar button')].map((x) => x.textContent.trim()),
      };
    })()`);
    console.log('=== 收起高光录入 ===');
    console.log(JSON.stringify(closed, null, 2));

    const camp = await evaluate(`(async () => {
      const b = [...document.querySelectorAll('.entry-bar button')].find((x) => x.textContent.includes('增加阵营'));
      if (b) b.click();
      await new Promise((r) => setTimeout(r, 200));
      return {
        camps: document.querySelectorAll('.camp').length,
        campN: getComputedStyle(document.querySelector('.camps')).getPropertyValue('--camp-n').trim(),
        barText: document.querySelector('.entry-bar').textContent.replace(/\\s+/g, ' ').trim(),
      };
    })()`);
    console.log('=== 增加阵营（操作条重建后状态不丢）===');
    console.log(JSON.stringify(camp, null, 2));

    // 「清空重录」应贴在保存行：点开确认弹窗后取消，草稿不能被动到
    const clearFlow = await evaluate(`(async () => {
      const btn = [...document.querySelectorAll('.result-bar button')].find((x) => x.textContent.trim() === '清空重录');
      if (!btn) return 'NO_CLEAR_BUTTON';
      const campsBefore = document.querySelectorAll('.camp').length;
      btn.click();
      await new Promise((r) => setTimeout(r, 300));
      const modal = document.querySelector('.modal, .overlay, [role="dialog"]');
      const modalText = modal ? modal.textContent.replace(/\\s+/g, ' ').trim().slice(0, 80) : null;
      const btns = modal ? [...modal.querySelectorAll('button')].map((b) => b.textContent.trim()) : [];
      // 点「取消」（弹窗里非 danger 的那个）
      const cancel = modal ? [...modal.querySelectorAll('button')].find((b) => b.textContent.trim() === '取消') : null;
      if (cancel) cancel.click();
      await new Promise((r) => setTimeout(r, 300));
      return {
        modalOpened: !!modal,
        modalText,
        modalButtons: btns,
        modalClosedAfterCancel: !document.querySelector('.modal, .overlay, [role="dialog"]'),
        campsAfterCancel: document.querySelectorAll('.camp').length,
        campsBefore,
      };
    })()`);
    console.log('=== 清空重录（弹窗 + 取消不丢草稿）===');
    console.log(JSON.stringify(clearFlow, null, 2));

    const shot = await wsSend(ws, { id: ++id, method: 'Page.captureScreenshot', params: { format: 'png' } });
    const out = 'D:/Workspace/GouTongPai/tmp-entrybar.png';
    require('node:fs').writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
    console.log('saved: ' + out);
    ws.close();
    chrome.kill();
    process.exit(0);
  }

  if (ROUTE === 'narrow') {
    // 窄视口：验证操作条 / 保存行（读数 + 账目 + 清空重录 + 保存本局）换行后不横向溢出
    const W = Number(process.argv[3] || 430);
    await wsSend(ws, {
      id: ++id,
      method: 'Emulation.setDeviceMetricsOverride',
      params: { width: W, height: 900, deviceScaleFactor: 1, mobile: false },
    });
    await new Promise((r) => setTimeout(r, 900));
    const m = await evaluate(`(() => {
      const bar = document.querySelector('.result-bar');
      bar.scrollIntoView({ block: 'center' });
      const entry = document.querySelector('.entry-bar');
      const kids = [...bar.children].map((c) => {
        const r = c.getBoundingClientRect();
        return { cls: (c.className || c.tagName).toString().slice(0, 22), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width) };
      });
      return {
        viewport: innerWidth,
        overflowX: document.documentElement.scrollWidth > innerWidth + 1,
        docScrollW: document.documentElement.scrollWidth,
        resultBarRows: new Set(kids.map((k) => k.y)).size,
        kids,
        entryBarText: entry.textContent.replace(/\\s+/g, ' ').trim(),
        entryBarRightGap: Math.round(entry.getBoundingClientRect().right - [...entry.querySelectorAll('button')].pop().getBoundingClientRect().right),
      };
    })()`);
    console.log('=== ' + W + ' 宽：操作条 / 保存行 ===');
    console.log(JSON.stringify(m, null, 2));
    const shot = await wsSend(ws, { id: ++id, method: 'Page.captureScreenshot', params: { format: 'png' } });
    const out = 'D:/Workspace/GouTongPai/tmp-narrow.png';
    require('node:fs').writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
    console.log('saved: ' + out);
    ws.close();
    chrome.kill();
    process.exit(0);
  }

  if (ROUTE === 'campminus') {
    // 阵营增减：+ 增加阵营 / − 移除阵营（默认撤销最近增加的那个）+ 阵营头 🗑
    const snap = `(() => {
      const btn = [...document.querySelectorAll('.entry-bar button')].find((b) => b.textContent.includes('移除阵营'));
      const camps = [...document.querySelectorAll('.camp')];
      return {
        camps: camps.map((c) => c.querySelector('.camp__name').value),
        campCount: camps.length,
        campN: getComputedStyle(document.querySelector('.camps')).getPropertyValue('--camp-n').trim(),
        removeBtn: btn ? { text: btn.textContent.trim(), disabled: btn.disabled, title: btn.title } : null,
        trashIcons: document.querySelectorAll('.camp__head-end .btn--icon').length,
      };
    })()`;

    console.log('=== 初始（2 阵营）===');
    console.log(JSON.stringify(await evaluate(snap), null, 2));

    const addOne = await evaluate(`(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      [...document.querySelectorAll('.entry-bar button')].find((b) => b.textContent.includes('增加阵营')).click();
      await sleep(300);
      return true;
    })()`);
    console.log('=== 点「+ 增加阵营」后（3 阵营）clicked=' + addOne + ' ===');
    console.log(JSON.stringify(await evaluate(snap), null, 2));

    const shot3 = await wsSend(ws, { id: ++id, method: 'Page.captureScreenshot', params: { format: 'png' } });
    require('node:fs').writeFileSync('D:/Workspace/GouTongPai/tmp-campminus.png', Buffer.from(shot3.result.data, 'base64'));
    console.log('saved: D:/Workspace/GouTongPai/tmp-campminus.png');

    console.log('=== 点「− 移除阵营」（应移除刚加的绿队）===');
    console.log(JSON.stringify(await evaluate(`(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      [...document.querySelectorAll('.entry-bar button')].find((b) => b.textContent.includes('移除阵营')).click();
      await sleep(300);
      return ${snap};
    })()`), null, 2));

    console.log('=== 三阵营且新阵营有玩家 → 移除应先确认 ===');
    console.log(JSON.stringify(await evaluate(`(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const okBtn = () => [...document.querySelectorAll('.entry-bar button')].find((b) => b.textContent.includes('增加阵营'));
      const minusBtn = () => [...document.querySelectorAll('.entry-bar button')].find((b) => b.textContent.includes('移除阵营'));
      okBtn().click();
      await sleep(300);
      const third = [...document.querySelectorAll('.camp')].pop();
      const sel = third.querySelector('.camp__foot select');
      sel.value = sel.options[1].value;
      [...third.querySelectorAll('.camp__foot button')].find((b) => b.textContent.trim() === '加入').click();
      await sleep(250);
      const nameWithPlayers = third.querySelector('.camp__name').value;

      minusBtn().click();
      await sleep(320);
      const modal = document.querySelector('.modal, [role="dialog"]');
      const modalText = modal ? modal.textContent.replace(/\\s+/g, ' ').trim().slice(0, 70) : null;
      // 先取消：草稿不能动
      const cancel = modal ? [...modal.querySelectorAll('button')].find((b) => b.textContent.trim() === '取消') : null;
      if (cancel) cancel.click();
      await sleep(300);
      const afterCancel = { campCount: document.querySelectorAll('.camp').length, modalClosed: !document.querySelector('.modal, [role="dialog"]') };

      // 再确认：应删掉绿队（玩家一起丢）
      minusBtn().click();
      await sleep(320);
      const modal2 = document.querySelector('.modal, [role="dialog"]');
      const ok = modal2 ? [...modal2.querySelectorAll('button')].find((b) => b.textContent.trim() === '移除阵营') : null;
      if (ok) ok.click();
      await sleep(400);
      const campsAfter = [...document.querySelectorAll('.camp')].map((c) => c.querySelector('.camp__name').value);
      const srows = document.querySelectorAll('.srow').length;
      const removeDisabled = minusBtn().disabled;
      return { nameWithPlayers, modalText, afterCancel, campsAfter, srowsAfterRemove: srows, removeDisabled };
    })()`), null, 2));

    ws.close();
    chrome.kill();
    process.exit(0);
  }

  if (ROUTE === 'cssvar') {
    // 诊断：自定义属性到底有没有写进 inline style（Object.assign 与 setProperty 的差别）
    const r = await evaluate(`(() => {
      const d = document.createElement('div');
      Object.assign(d.style, { '--demo-a': '7' });
      const viaAssign = d.style.getPropertyValue('--demo-a');
      d.style.setProperty('--demo-b', '8');
      const viaSetProperty = d.style.getPropertyValue('--demo-b');
      const camp = document.querySelector('.camp');
      const grid = document.querySelector('.camps');
      return {
        viaAssign, viaSetProperty,
        campInlineVar: camp ? camp.style.getPropertyValue('--camp-color') : 'NO_CAMP',
        campComputedBorderTop: camp ? getComputedStyle(camp).borderTopColor : null,
        campsInlineVar: grid ? grid.style.getPropertyValue('--camp-n') : 'NO_GRID',
      };
    })()`);
    console.log('=== CSS 自定义属性写入方式对比 ===');
    console.log(JSON.stringify(r, null, 2));
    ws.close();
    chrome.kill();
    process.exit(0);
  }

  if (ROUTE === 'matchdetail') {
    // 对局明细：阵营横向并排。现有 demo 数据只有 2 阵营，测不出 3 列，
    // 所以先用接口造一局 3 阵营的测试局，量完截图再删掉。
    const created = await evaluate(`(async () => {
      const boot = await fetch('/api/bootstrap').then((r) => r.json()).then((j) => j.data);
      // 挑对局最多的赛季造测试局：这样截图里能看到「真数据 + 展开的明细」长什么样
      const countBy = {};
      for (const m of boot.matches) countBy[m.season_id] = (countBy[m.season_id] || 0) + 1;
      const season = [...boot.seasons].sort((a, b) => (countBy[b.id] || 0) - (countBy[a.id] || 0))[0];
      const pool = boot.players.filter((p) => p.active).slice(0, 3);
      if (!season || pool.length < 3) return { error: 'NO_SEASON_OR_PLAYERS' };
      const today = new Date().toISOString().slice(0, 10);
      const payload = {
        season_id: season.id, deck_count: 3, played_at: today, seq: 99, table_name: '横排测试',
        note: '绿队差 40 分出线',
        camps: [
          { name: '红队', color: '#d64545', players: [{ player_id: pool[0].id, score: 120, finished: true }] },
          { name: '蓝队', color: '#3b7dd8', players: [{ player_id: pool[1].id, score: 100, finished: true, is_mvp: true }] },
          { name: '绿队', color: '#2f9e63', players: [{ player_id: pool[2].id, score: 60, finished: false }] },
        ],
      };
      const res = await fetch('/api/matches', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const j = await res.json();
      return { ok: res.ok, status: res.status, id: j && j.data ? j.data.id : null, error: j && j.error };
    })()`);
    console.log('=== 造一局 3 阵营测试局 ===');
    console.log(JSON.stringify(created, null, 2));
    if (!created || !created.id) {
      ws.close();
      chrome.kill();
      process.exit(1);
    }

    // 分支名不是路由名，必须显式导航到 #matches（先过 about:blank 才不吃缓存）
    await wsSend(ws, { id: ++id, method: 'Page.navigate', params: { url: 'about:blank' } });
    await new Promise((r) => setTimeout(r, 300));
    await wsSend(ws, { id: ++id, method: 'Page.navigate', params: { url: 'http://127.0.0.1:5178/#matches' } });
    await new Promise((r) => setTimeout(r, 4800));
    await evaluate(`(() => {
      const cb = [...document.querySelectorAll('.head-actions .check input')][0];
      if (cb && !cb.checked) cb.click();
      return true;
    })()`);
    await new Promise((r) => setTimeout(r, 900));

    const info = await evaluate(`(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const targetId = ${created.id};
      const rows = [...document.querySelectorAll('.match-row')];
      const row = rows.find((r) => {
        const no = r.querySelector('.match-row__no');
        return no && parseInt(no.textContent.replace('#', ''), 10) === targetId;
      });
      let clicked = false;
      if (row) {
        const b = [...row.querySelectorAll('button')].find((x) => x.textContent.includes('展开明细'));
        if (b) { b.click(); clicked = true; }
      }
      await sleep(400);

      // 注意：点「展开明细」会整页重渲染，之前抓到的 row 已经脱离文档，
      // 必须按 id 重新取一次行节点
      const fresh = [...document.querySelectorAll('.match-row')].find((r) => {
        const no = r.querySelector('.match-row__no');
        return no && parseInt(no.textContent.replace('#', ''), 10) === targetId;
      });
      const wrap = fresh ? fresh.querySelector('.match-detail') : null;
      if (!wrap) return { targetId, rowCount: rows.length, clicked, whyNoDetail: 'NO_DETAIL_DOM' };
      const grid = wrap.querySelector('.match-camps');
      const camps = [...wrap.querySelectorAll('.match-camp')];
      const round = (n) => Math.round(n * 10) / 10;
      return {
        targetId, rowCount: rows.length, clicked,
        gridColumns: grid ? getComputedStyle(grid).gridTemplateColumns : null,
        campNInline: grid ? grid.style.getPropertyValue('--camp-n') : null,
        sameRow: camps.length > 1 ? camps.every((c) => Math.abs(c.getBoundingClientRect().top - camps[0].getBoundingClientRect().top) < 2) : null,
        equalWidth: camps.length > 1 ? Math.max(...camps.map((c) => c.getBoundingClientRect().width)) - Math.min(...camps.map((c) => c.getBoundingClientRect().width)) < 1 : null,
        camps: camps.map((c) => {
          const r = c.getBoundingClientRect();
          const head = c.querySelector('.match-camp__head');
          const names = [...c.querySelectorAll('.mcamp-row__name')];
          return {
            title: head ? head.textContent.replace(/\\s+/g, ' ').trim() : null,
            x: round(r.x), y: round(r.y), w: round(r.width),
            borderTopColor: getComputedStyle(c).borderTopColor,
            rows: c.querySelectorAll('.mcamp-row').length,
            firstRow: c.querySelector('.mcamp-row') ? c.querySelector('.mcamp-row').textContent.replace(/\\s+/g, ' ').trim() : null,
            wastedRowStruck: (() => { const w = c.querySelector('.mcamp-row.is-wasted .mcamp-row__score'); return w ? getComputedStyle(w).textDecorationLine : null; })(),
            nameTruncated: names.some((n) => n.scrollWidth > n.clientWidth + 1),
          };
        }),
        hasTable: !!wrap.querySelector('table'),
        overflowX: document.documentElement.scrollWidth > innerWidth + 1,
        // 账目面板应已移除：明细里不该再出现这些字样，也不该再有 .row-between 行
        ledgerGone: !/牌库总分|账目闭合|计入阵营的有效分|未录入分/.test(wrap.textContent),
        ledgerRows: wrap.querySelectorAll('.row-between').length,
        blocks: [...wrap.children].map((c) => c.className || c.tagName),
        deleteBtn: [...wrap.querySelectorAll('.match-detail > div > button')].map((b) => b.textContent),
        noteText: (() => {
          const n = [...wrap.children].find((c) => /^备注/.test(c.textContent || ''));
          return n ? n.textContent.replace(/\\s+/g, ' ').trim() : null;
        })(),
      };
    })()`);
    console.log('=== 对局明细（3 阵营应横向并排）===');
    console.log(JSON.stringify(info, null, 2));

    await evaluate(`(() => {
      const w = document.querySelector('.match-detail');
      if (w) w.scrollIntoView({ block: 'center' });
      return true;
    })()`);
    await new Promise((r) => setTimeout(r, 500));
    const shot = await wsSend(ws, { id: ++id, method: 'Page.captureScreenshot', params: { format: 'png' } });
    require('node:fs').writeFileSync('D:/Workspace/GouTongPai/tmp-matchdetail.png', Buffer.from(shot.result.data, 'base64'));
    console.log('saved: D:/Workspace/GouTongPai/tmp-matchdetail.png');

    const delUrl = 'http://127.0.0.1:5178/api/matches/' + created.id;
    const delStatus = await fetch(delUrl, { method: 'DELETE' }).then((r) => r.status).catch((e) => 'ERR ' + e.message);
    const after = await fetch('http://127.0.0.1:5178/api/bootstrap').then((r) => r.json()).then((j) => j.data.matches.length);
    console.log('清理测试对局：DELETE status=' + delStatus + '，剩余对局数=' + after);
    ws.close();
    chrome.kill();
    process.exit(0);
  }

  if (ROUTE === 'narrowmatches') {
    // 窄视口：对局明细的阵营列应回落单列且不横向溢出
    const W = Number(process.argv[3] || 430);
    await wsSend(ws, { id: ++id, method: 'Emulation.setDeviceMetricsOverride', params: { width: W, height: 900, deviceScaleFactor: 1, mobile: false } });
    await wsSend(ws, { id: ++id, method: 'Page.navigate', params: { url: 'about:blank' } });
    await new Promise((r) => setTimeout(r, 300));
    await wsSend(ws, { id: ++id, method: 'Page.navigate', params: { url: 'http://127.0.0.1:5178/#matches' } });
    await new Promise((r) => setTimeout(r, 4800));
    const m = await evaluate(`(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const cb = [...document.querySelectorAll('.head-actions .check input')][0];
      if (cb && !cb.checked) cb.click();
      await sleep(800);
      const btn = document.querySelector('.match-row button');
      if (btn) btn.click();
      await sleep(500);
      const wrap = document.querySelector('.match-detail');
      if (!wrap) return { whyNoDetail: 'NO_DETAIL_DOM' };
      const grid = wrap.querySelector('.match-camps');
      const camps = [...wrap.querySelectorAll('.match-camp')];
      const r = (el) => el.getBoundingClientRect();
      return {
        viewport: innerWidth,
        overflowX: document.documentElement.scrollWidth > innerWidth + 1,
        docScrollW: document.documentElement.scrollWidth,
        gridColumns: getComputedStyle(grid).gridTemplateColumns,
        campCount: camps.length,
        campBoxes: camps.map((c) => ({ x: Math.round(r(c).x), y: Math.round(r(c).y), w: Math.round(r(c).width) })),
        stacked: camps.length > 1 ? camps.every((c, i) => i === 0 || r(c).top > r(camps[i - 1]).top) : null,
        maxWidthPct: Math.round((Math.max(...camps.map((c) => r(c).width)) / innerWidth) * 100),
      };
    })()`);
    console.log('=== ' + W + ' 宽：对局明细阵营列 ===');
    console.log(JSON.stringify(m, null, 2));
    const shot = await wsSend(ws, { id: ++id, method: 'Page.captureScreenshot', params: { format: 'png' } });
    require('node:fs').writeFileSync('D:/Workspace/GouTongPai/tmp-narrowmatches.png', Buffer.from(shot.result.data, 'base64'));
    console.log('saved: D:/Workspace/GouTongPai/tmp-narrowmatches.png');
    ws.close();
    chrome.kill();
    process.exit(0);
  }

  if (ROUTE === 'seasonswitch') {
    // 顶栏切赛季 → 当前页面的数据要立刻跟着变（原来只改了右上角的赛季名）
    const goto = async (hash) => {
      await wsSend(ws, { id: ++id, method: 'Page.navigate', params: { url: 'about:blank' } });
      await new Promise((r) => setTimeout(r, 250));
      await wsSend(ws, { id: ++id, method: 'Page.navigate', params: { url: 'http://127.0.0.1:5178/#' + hash } });
      await new Promise((r) => setTimeout(r, 4500));
      // 打一个哨兵：整页重绘不会清掉它，浏览器刷新才会 —— 用来证明「没跳页也没刷新」
      await evaluate(`(() => { window.__ssProbe = 'kept'; return true; })()`);
    };

    // 打开顶栏下拉，按名字点一个赛季（菜单项点完自动收起）
    const pickSeason = async (name) =>
      evaluate(`(async () => {
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        document.getElementById('seasonPillBtn').click();
        await sleep(250);
        const items = [...document.querySelectorAll('.season-menu__item')];
        const labels = items.map((b) => b.textContent.replace(/\\s+/g, ' ').trim());
        const target = items.find((b) => b.textContent.includes(${JSON.stringify(name)}));
        if (!target) return { ok: false, labels };
        target.click();
        await sleep(600);
        return { ok: true, labels, menuHidden: document.getElementById('seasonMenu').hidden };
      })()`);

    const snap = () =>
      evaluate(`(() => {
        const q = (s) => document.querySelector(s);
        const cb = q('.head-actions .check input');
        return {
          pill: q('#currentSeasonName').textContent,
          h1: q('h1') ? q('h1').textContent : null,
          sub: q('.sub') ? q('.sub').textContent : null,
          rows: document.querySelectorAll('.match-row').length,
          scopeChecked: cb ? cb.checked : null,
          probe: window.__ssProbe || null,
          scrollTop: document.body.scrollTop,
        };
      })()`);

    const out = {};

    /* ① 对局记录：切到「2026 秋季赛」（库里 9 局） */
    await goto('matches');
    out.matchesBefore = await snap();
    out.pickA = await pickSeason('2026 秋季赛');
    out.matchesAfter = await snap();

    /* ② 页内勾了「全部赛季」时再切赛季：勾选应被清掉、列表重新按赛季收窄 */
    await evaluate(`(() => {
      const cb = document.querySelector('.head-actions .check input');
      if (cb && !cb.checked) cb.click();
      return true;
    })()`);
    await new Promise((r) => setTimeout(r, 700));
    out.scopeAllState = await snap();
    out.pickB = await pickSeason('2026 第 23 赛季');
    out.afterScopeAllPick = await snap();

    // 截一张「切完赛季的对局记录」留档
    {
      const s = await wsSend(ws, { id: ++id, method: 'Page.captureScreenshot', params: { format: 'png' } });
      require('node:fs').writeFileSync('D:/Workspace/GouTongPai/tmp-seasonswitch-matches.png', Buffer.from(s.result.data, 'base64'));
      console.log('saved: D:/Workspace/GouTongPai/tmp-seasonswitch-matches.png');
    }

    /* ③ 同源其它页：总览标题 / 排行榜口径 */
    await goto('dashboard');
    out.dashboardBefore = await snap();
    out.pickC = await pickSeason('2026 秋季赛');
    out.dashboardAfter = await snap();

    await goto('leaderboard');
    out.lbBefore = await snap();
    out.pickD = await pickSeason('2026 第 23 赛季');
    out.lbAfter = await snap();

    /* ④ 赛季页「设为当前」按钮：同一个 store.setSeason，点完该行按钮应消失、顶栏跟着变 */
    await goto('seasons');
    out.seasonsBefore = await evaluate(`(() => ({
      pill: document.getElementById('currentSeasonName').textContent,
      setCurrentButtons: [...document.querySelectorAll('.season-row button')].filter((b) => b.textContent === '设为当前').length,
    }))()`);
    out.clickSetCurrent = await evaluate(`(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const b = [...document.querySelectorAll('.season-row button')].find((x) => x.textContent === '设为当前');
      if (!b) return { ok: false };
      b.click();
      await sleep(600);
      return { ok: true };
    })()`);
    out.seasonsAfter = await evaluate(`(() => ({
      pill: document.getElementById('currentSeasonName').textContent,
      setCurrentButtons: [...document.querySelectorAll('.season-row button')].filter((b) => b.textContent === '设为当前').length,
      currentRow: (() => { const r = [...document.querySelectorAll('.season-row')].find((x) => /当前/.test(x.textContent)); return r ? r.textContent.replace(/\s+/g, ' ').trim().slice(0, 40) : null; })(),
    }))()`);

    console.log('=== 顶栏切赛季后的即时刷新 ===');
    console.log(JSON.stringify(out, null, 2));

    const shot = await wsSend(ws, { id: ++id, method: 'Page.captureScreenshot', params: { format: 'png' } });
    require('node:fs').writeFileSync('D:/Workspace/GouTongPai/tmp-seasonswitch.png', Buffer.from(shot.result.data, 'base64'));
    console.log('saved: D:/Workspace/GouTongPai/tmp-seasonswitch.png');
    ws.close();
    chrome.kill();
    process.exit(0);
  }

  if (ROUTE === 'scoreseason') {
    // 计分台：顶栏切赛季（空草稿应跟随新赛季）与设置栏内换赛季（换完下拉不能回弹）
    await wsSend(ws, { id: ++id, method: 'Page.navigate', params: { url: 'about:blank' } });
    await new Promise((r) => setTimeout(r, 250));
    await wsSend(ws, { id: ++id, method: 'Page.navigate', params: { url: 'http://127.0.0.1:5178/#scoring' } });
    await new Promise((r) => setTimeout(r, 4500));

    const read = () =>
      evaluate(`(() => {
        const sel = document.getElementById('f-season');
        const pill = document.getElementById('currentSeasonName');
        const draft = (() => { try { return JSON.parse(localStorage.getItem('gtp:draft') || 'null'); } catch (e) { return null; } })();
        return {
          sel: sel ? sel.value : null,
          selText: sel ? sel.options[sel.selectedIndex].textContent : null,
          pill: pill ? pill.textContent : null,
          deck: document.getElementById('f-deck') ? document.getElementById('f-deck').value : null,
          draftSeason: draft ? draft.seasonId : null,
        };
      })()`);

    const pickHeader = (name) =>
      evaluate(`(async () => {
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        document.getElementById('seasonPillBtn').click();
        await sleep(250);
        const t = [...document.querySelectorAll('.season-menu__item')].find((b) => b.textContent.includes(${JSON.stringify(name)}));
        if (!t) return { ok: false };
        t.click();
        await sleep(700);
        return { ok: true };
      })()`);

    const out = {};
    out.initial = await read();

    /* ① 顶栏切「2026 秋季赛」：空草稿应跟着走，设置栏下拉也要停在新赛季 */
    out.pickHeader = await pickHeader('2026 秋季赛');
    out.afterHeader = await read();

    /* ② 设置栏里换成「2026 第 23 赛季」：重绘后下拉不能回弹到上一个 */
    out.pickInPage = await evaluate(`(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const sel = document.getElementById('f-season');
      const opt = [...sel.options].find((o) => o.textContent.includes('2026 第 23 赛季'));
      sel.value = opt.value;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(700);
      return { ok: true, picked: opt.value };
    })()`);
    out.afterInPage = await read();

    console.log('=== 计分台换赛季（顶栏 / 设置栏）===');
    console.log(JSON.stringify(out, null, 2));
    ws.close();
    chrome.kill();
    process.exit(0);
  }

  if (ROUTE === 'scopetoggle') {
    // 「全部赛季」开关现在是全局口径（store.scopeAll）：四个页面都得还能勾、还能即时生效
    const goto = async (hash) => {
      await wsSend(ws, { id: ++id, method: 'Page.navigate', params: { url: 'about:blank' } });
      await new Promise((r) => setTimeout(r, 250));
      await wsSend(ws, { id: ++id, method: 'Page.navigate', params: { url: 'http://127.0.0.1:5178/#' + hash } });
      await new Promise((r) => setTimeout(r, 4200));
    };
    const toggle = () =>
      evaluate(`(async () => {
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        const subOf = () => {
          const el = [...document.querySelectorAll('.sub')].find((x) => x.textContent.trim());
          return el ? el.textContent.trim() : null;
        };
        const cb = [...document.querySelectorAll('input[type=checkbox]')].find((n) => {
          const lb = n.closest('label');
          return lb && /全部赛季/.test(lb.textContent);
        });
        const before = { sub: subOf(), checked: cb ? cb.checked : null };
        if (cb && !cb.checked) cb.click();
        await sleep(500);
        const cb2 = [...document.querySelectorAll('input[type=checkbox]')].find((n) => {
          const lb = n.closest('label');
          return lb && /全部赛季/.test(lb.textContent);
        });
        return { before, afterOn: { sub: subOf(), checked: cb2 ? cb2.checked : null } };
      })()`);
    const out = {};
    for (const [key, hash] of [['matches', 'matches'], ['leaderboard', 'leaderboard'], ['players', 'players'], ['highlights', 'highlights']]) {
      await goto(hash);
      out[key] = await toggle();
    }
    await goto('highlights');
    out.carryOver = await evaluate(`(() => {
      const cb = [...document.querySelectorAll('input[type=checkbox]')].find((n) => {
        const lb = n.closest('label');
        return lb && /全部赛季/.test(lb.textContent);
      });
      return { checkedOnArrival: cb ? cb.checked : null, sub: [...document.querySelectorAll('.sub')].find((x) => x.textContent.trim()).textContent.trim() };
    })()`);
    console.log('=== 「全部赛季」开关（改为全局口径后）===');
    console.log(JSON.stringify(out, null, 2));
    ws.close();
    chrome.kill();
    process.exit(0);
  }

  if (ROUTE === 'imgupload') {
    // ① 头像必须压在封面图上（elementFromPoint 看真实的命中顺序，不看声明）
    // ② 通过真实上传路径喂一张 2600×1950 的噪声大图，检查加工结果与落盘体积
    // 全程用新建的测试玩家，结束后删掉（连带上传文件），不碰真实数据
    const FS = require('node:fs');
    const goto = async (hash) => {
      await wsSend(ws, { id: ++id, method: 'Page.navigate', params: { url: 'about:blank' } });
      await new Promise((r) => setTimeout(r, 250));
      await wsSend(ws, { id: ++id, method: 'Page.navigate', params: { url: 'http://127.0.0.1:5178/#' + hash } });
      await new Promise((r) => setTimeout(r, 4300));
    };

    // 先造一个测试玩家（带上头像+照片，用来验证图层）
    const created = await evaluate(`(async () => {
      const r = await fetch('/api/players', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: '压测临时玩家' }) });
      const j = await r.json();
      return j && j.data ? { id: j.data.id, name: j.data.name } : { error: j && j.error };
    })()`);
    if (!created || !created.id) {
      console.log('创建测试玩家失败', JSON.stringify(created));
      ws.close();
      chrome.kill();
      process.exit(1);
    }

    const out = { player: created };

    /* ---------- ② 真实上传：噪声大图 ---------- */
    await goto('players');
    out.uploads = await evaluate(`(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

      // 造一张 2600×1950 的噪声 JPEG（噪声最难压，最能试出体积预算）
      async function makeBigJpeg(w, h) {
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d');
        const img = ctx.createImageData(w, h);
        const d = img.data;
        let seed = 987654321;
        for (let i = 0; i < d.length; i += 4) {
          seed = (seed * 1664525 + 1013904223) >>> 0;
          const v = seed >>> 24;
          d[i] = v; d[i + 1] = (v ^ 90) & 255; d[i + 2] = (v ^ 180) & 255; d[i + 3] = 255;
        }
        ctx.putImageData(img, 0, 0);
        const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.95));
        return new File([blob], 'big-noise.jpg', { type: 'image/jpeg' });
      }

      // 点按钮 → pickImage 会插入一个隐藏的 input[type=file] → 塞文件 → 触发 change
      // 按钮文案会随状态在「上传 X / 换 X」之间切换，所以按关键字匹配
      async function uploadVia(keyword) {
        const card = [...document.querySelectorAll('.player-card')].find((c) => c.textContent.includes('压测临时玩家'));
        if (!card) return { error: 'NO_CARD' };
        const btn = [...card.querySelectorAll('button')].find((b) => b.textContent.includes(keyword));
        if (!btn) return { error: 'NO_BTN_' + keyword };
        btn.click();
        await sleep(250);
        const input = [...document.querySelectorAll('input[type=file]')].pop();
        if (!input) return { error: 'NO_FILE_INPUT' };
        const file = await makeBigJpeg(2600, 1950);
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        await sleep(2200);
        const toasts = [...document.querySelectorAll('.toast')].map((t) => t.textContent.trim());
        return { sourceBytes: file.size, toasts };
      }

      const photo = await uploadVia('照片');
      const avatar = await uploadVia('头像');

      // 直接调模块，看「自适应降档」到底降了几档（toast 里只有最终体积）
      const mod = await import('/js/util.js');
      const bigFile = await makeBigJpeg(2600, 1950);
      const bigOut = await mod.compressImage(bigFile, mod.IMAGE_PRESETS.photo);
      const tinyCanvas = document.createElement('canvas');
      tinyCanvas.width = 200; tinyCanvas.height = 150;
      const tctx = tinyCanvas.getContext('2d');
      tctx.fillStyle = '#2f9e63'; tctx.fillRect(0, 0, 200, 150);
      const tinyBlob = await new Promise((r) => tinyCanvas.toBlob(r, 'image/jpeg', 0.9));
      const tinyFile = new File([tinyBlob], 'tiny.jpg', { type: 'image/jpeg' });
      const tinyOut = await mod.compressImage(tinyFile, mod.IMAGE_PRESETS.avatar);
      const adaptive = {
        big: { src: bigFile.size, bytes: bigOut.bytes, w: bigOut.width, h: bigOut.height, quality: bigOut.quality, steps: bigOut.steps, withinBudget: bigOut.withinBudget },
        alreadySmall: { src: tinyFile.size, bytes: tinyOut.bytes, w: tinyOut.width, h: tinyOut.height, recompressed: tinyOut.recompressed },
      };

      // 落盘结果：从 bootstrap 拿文件名，再量真实尺寸与字节数
      const boot = await fetch('/api/bootstrap').then((r) => r.json()).then((j) => j.data);
      const me = boot.players.find((p) => p.id === ${created.id});
      async function probe(kind, file) {
        if (!file) return { kind, missing: true };
        const dim = await new Promise((res) => {
          const im = new Image();
          im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight });
          im.onerror = () => res(null);
          im.src = '/uploads/' + file;
        });
        const len = await fetch('/uploads/' + file).then((r) => r.blob()).then((b) => b.size);
        return { kind, file, width: dim ? dim.w : null, height: dim ? dim.h : null, bytes: len };
      }
      return { photo, avatar, adaptive, stored: [await probe('photo', me.photo), await probe('avatar', me.avatar)] };
    })()`);
    console.log('=== 上传大图 → 加工结果 ===');
    console.log(JSON.stringify(out.uploads, null, 2));

    // 磁盘上再核一遍（不依赖页面）
    const files = await getJSON('http://127.0.0.1:5178/api/bootstrap');
    const me = files.data.players.find((p) => p.id === created.id);
    out.onDisk = {
      photo: me.photo ? { file: me.photo, bytes: FS.statSync('D:/Workspace/GouTongPai/data/uploads/' + me.photo).size } : null,
      avatar: me.avatar ? { file: me.avatar, bytes: FS.statSync('D:/Workspace/GouTongPai/data/uploads/' + me.avatar).size } : null,
    };
    console.log('=== 磁盘落盘 ===');
    console.log(JSON.stringify(out.onDisk, null, 2));

    /* ---------- 服务端兜底：直接绕过前端塞一张 6000×80 的图 ---------- */
    out.serverGuard = await evaluate(`(async () => {
      const c = document.createElement('canvas');
      c.width = 6000; c.height = 80;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#123456';
      ctx.fillRect(0, 0, 6000, 80);
      const dataUrl = c.toDataURL('image/jpeg', 0.9);
      const r = await fetch('/api/players/${created.id}/photo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dataUrl }),
      });
      const j = await r.json();
      return { status: r.status, error: j && j.error };
    })()`);
    console.log('=== 服务端尺寸兜底 ===');
    console.log(JSON.stringify(out.serverGuard, null, 2));

    /* ---------- ① 头像图层：用真实头像 + 封面图的测试玩家 ---------- */
    out.stacking = await evaluate(`(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const card = [...document.querySelectorAll('.player-card')].find((c) => c.textContent.includes('压测临时玩家'));
      if (!card) return { error: 'NO_CARD' };
      const cover = card.querySelector('.player-card__cover');
      const avatar = card.querySelector('.player-card__avatar');
      if (!cover || !avatar) return { error: 'NO_COVER_OR_AVATAR', hasCover: !!cover, hasAvatar: !!avatar };
      const cs = getComputedStyle(avatar);
      const ar = avatar.getBoundingClientRect();
      const cr = cover.getBoundingClientRect();
      // 头像压在封面上的那一条：取头像顶部往下 6px 处（这个区域原本被封面盖住）
      const x = ar.left + ar.width / 2;
      const y = Math.max(ar.top + 6, cr.bottom - 6);
      const hit = document.elementFromPoint(x, y);
      return {
        avatarPos: cs.position, avatarZ: cs.zIndex,
        overlapPx: Math.round(cr.bottom - ar.top),
        avatarTop: Math.round(ar.top), coverBottom: Math.round(cr.bottom),
        hitTag: hit ? hit.tagName : null,
        hitClass: hit ? hit.className : null,
        hitIsAvatar: hit === avatar || (hit && hit.classList.contains('player-card__avatar')),
        hasPhoto: !!cover.querySelector('img'),
      };
    })()`);
    console.log('=== 头像 vs 封面图层 ===');
    console.log(JSON.stringify(out.stacking, null, 2));

    /* ---------- 清理：删掉测试玩家（连带上传文件） ---------- */
    out.cleanup = await evaluate(`(async () => {
      const r = await fetch('/api/players/${created.id}', { method: 'DELETE' });
      const j = await r.json();
      return { status: r.status, ok: !!(j && j.data) };
    })()`);
    console.log('=== 清理 ===');
    console.log(JSON.stringify(out.cleanup, null, 2));

    await goto('players');
    await evaluate(`(() => {
      const card = [...document.querySelectorAll('.player-card')].find((c) => c.textContent.includes('阿强'));
      if (card) card.scrollIntoView({ block: 'center' });
      return true;
    })()`);
    await new Promise((r) => setTimeout(r, 500));
    const shot = await wsSend(ws, { id: ++id, method: 'Page.captureScreenshot', params: { format: 'png' } });
    require('node:fs').writeFileSync('D:/Workspace/GouTongPai/tmp-avatar.png', Buffer.from(shot.result.data, 'base64'));
    console.log('saved: D:/Workspace/GouTongPai/tmp-avatar.png');
    ws.close();
    chrome.kill();
    process.exit(0);
  }

  if (ROUTE === 'hluploader') {
    // 高光表单里的图片上传区（刚重排过：提示行改成「策略说明 → 实测加工结果」）
    await wsSend(ws, { id: ++id, method: 'Page.navigate', params: { url: 'about:blank' } });
    await new Promise((r) => setTimeout(r, 250));
    await wsSend(ws, { id: ++id, method: 'Page.navigate', params: { url: 'http://127.0.0.1:5178/#highlights' } });
    await new Promise((r) => setTimeout(r, 4300));

    const info = await evaluate(`(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const openBtn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('新增高光') || b.textContent.includes('记录高光'));
      if (!openBtn) return { error: 'NO_OPEN_BTN', buttons: [...document.querySelectorAll('button')].map((b) => b.textContent.trim()).slice(0, 12) };
      openBtn.click();
      await sleep(500);
      const modal = document.querySelector('.modal');
      if (!modal) return { error: 'NO_MODAL' };
      const uploader = modal.querySelector('.uploader');
      const hint = modal.querySelector('.uploader__hint');
      const before = {
        hasUploader: !!uploader,
        hasPreview: !!(uploader && uploader.querySelector('.uploader__preview')),
        hint: hint ? hint.textContent.trim() : null,
        buttons: uploader ? [...uploader.querySelectorAll('button')].map((b) => b.textContent.trim()) : [],
      };
      // 选一张大图，看提示行是否换成实测结果
      const pick = uploader ? [...uploader.querySelectorAll('button')].find((b) => b.textContent.includes('选择图片')) : null;
      if (pick) {
        pick.click();
        await sleep(250);
        const input = [...document.querySelectorAll('input[type=file]')].pop();
        if (input) {
          const c = document.createElement('canvas');
          c.width = 2400; c.height = 1600;
          const ctx = c.getContext('2d');
          const img = ctx.createImageData(2400, 1600);
          let seed = 424242;
          for (let i = 0; i < img.data.length; i += 4) {
            seed = (seed * 1664525 + 1013904223) >>> 0;
            const v = seed >>> 24;
            img.data[i] = v; img.data[i + 1] = (v * 3) & 255; img.data[i + 2] = (v * 5) & 255; img.data[i + 3] = 255;
          }
          ctx.putImageData(img, 0, 0);
          const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.95));
          const dt = new DataTransfer();
          dt.items.add(new File([blob], 'big.jpg', { type: 'image/jpeg' }));
          input.files = dt.files;
          input.dispatchEvent(new Event('change', { bubbles: true }));
          await sleep(2500);
        }
      }
      const modal2 = document.querySelector('.modal');
      const hint2 = modal2 ? modal2.querySelector('.uploader__hint') : null;
      return { before, afterPick: { hint: hint2 ? hint2.textContent.trim() : null, hasPreviewImg: !!(modal2 && modal2.querySelector('.uploader__preview img')) } };
    })()`);
    console.log('=== 高光表单：图片上传区 ===');
    console.log(JSON.stringify(info, null, 2));
    const shot = await wsSend(ws, { id: ++id, method: 'Page.captureScreenshot', params: { format: 'png' } });
    require('node:fs').writeFileSync('D:/Workspace/GouTongPai/tmp-hluploader.png', Buffer.from(shot.result.data, 'base64'));
    console.log('saved: D:/Workspace/GouTongPai/tmp-hluploader.png');
    ws.close();
    chrome.kill();
    process.exit(0);
  }

  if (ROUTE === 'savehl') {
    // 端到端：加人 → 填分 → 记一条高光 → 保存 → 校验对局与高光都落库（最后清掉测试数据）
    const flowPrep = await evaluate(`(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const boot = () => fetch('/api/bootstrap').then((r) => r.json()).then((j) => j.data);
      const before = await boot();

      // ① 两个阵营各加一名玩家
      const camps = [...document.querySelectorAll('.camp')];
      for (const c of camps.slice(0, 2)) {
        const sel = c.querySelector('.camp__foot select');
        const add = [...c.querySelectorAll('.camp__foot button')].find((b) => b.textContent.trim() === '加入');
        sel.value = sel.options[1].value;
        add.click();
        await sleep(150);
      }
      const rows = [...document.querySelectorAll('.srow__score')];
      rows.forEach((inp, i) => {
        inp.value = String(60 + i * 10);
        inp.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await sleep(200);

      // ② 第一个人勾选「出完牌」
      const finish = [...document.querySelectorAll('.srow__toggle')].filter((b) => !b.classList.contains('is-mvp'));
      finish[0].click();
      await sleep(150);

      // ③ 展开高光并记一条（勾选本局玩家）
      [...document.querySelectorAll('.entry-bar button')].find((x) => x.textContent.includes('新增高光')).click();
      await sleep(150);
      document.querySelector('.hl-compose__row .input').value = '自动校验高光';
      const cbs = [...document.querySelectorAll('.hl-compose .check input')];
      if (cbs[0]) cbs[0].click();
      [...document.querySelectorAll('.hl-compose button')].find((x) => x.textContent.trim() === '添加这条').click();
      await sleep(400);
      const barBeforeSave = document.querySelector('.entry-bar').textContent.replace(/\\s+/g, ' ').trim();
      window.__before = before; // 交给第二段复用
      return { barBeforeSave };
    })()`);
    console.log('=== 保存前状态 ===');
    console.log(JSON.stringify(flowPrep, null, 2));

    {
      const shot = await wsSend(ws, { id: ++id, method: 'Page.captureScreenshot', params: { format: 'png' } });
      require('node:fs').writeFileSync('D:/Workspace/GouTongPai/tmp-savehl.png', Buffer.from(shot.result.data, 'base64'));
      console.log('saved: D:/Workspace/GouTongPai/tmp-savehl.png');
    }

    const flow = await evaluate(`(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const boot = () => fetch('/api/bootstrap').then((r) => r.json()).then((j) => j.data);
      const before = window.__before;
      const save = [...document.querySelectorAll('.result-bar button')].pop();
      const saveDisabled = save.disabled;
      save.click();
      await sleep(2200);
      const toast = document.querySelector('.toast, .notify, .tip');
      const after = await boot();

      const newMatch = after.matches.find((m) => !before.matches.some((b) => b.id === m.id));
      const newHl = after.highlights.find((h) => !before.highlights.some((b) => b.id === h.id));

      // ⑤ 清掉这次测试数据
      let cleaned = 'skipped';
      if (newMatch) {
        await fetch('/api/matches/' + newMatch.id, { method: 'DELETE' });
        if (newHl) await fetch('/api/highlights/' + newHl.id, { method: 'DELETE' });
        const final = await boot();
        cleaned = 'matches ' + after.matches.length + ' -> ' + final.matches.length +
          ', highlights ' + after.highlights.length + ' -> ' + final.highlights.length;
      }

      return {
        saveDisabled,
        toast: toast ? toast.textContent.replace(/\\s+/g, ' ').trim() : null,
        matchAdded: !!newMatch,
        matchInfo: newMatch ? { seq: newMatch.seq, deck: newMatch.deck_count, played: newMatch.played_at, camps: (newMatch.camps || []).map((c) => c.name + ':' + c.total_score) } : null,
        highlightAdded: !!newHl,
        highlightInfo: newHl ? { title: newHl.title, match_id: newHl.match_id, player_ids: newHl.player_ids } : null,
        panelAfterSave: document.querySelector('.hl-compose') ? document.querySelector('.hl-compose').hidden : null,
        cleanup: cleaned,
      };
    })()`);
    console.log('=== 保存流程（含高光）===');
    console.log(JSON.stringify(flow, null, 2));
    ws.close();
    chrome.kill();
    process.exit(0);
  }

  if (ROUTE === 'align') {
    const al = await evaluate(`(() => {
      const round = (n) => Math.round(n * 10) / 10;
      const rect = (el) => { const r = el.getBoundingClientRect(); return { x: round(r.x), w: round(r.width), right: round(r.right) }; };
      const bar = document.querySelector('.setup-bar');
      const rows = [...bar.querySelectorAll(':scope > .field')].map((f) => {
        const label = f.querySelector(':scope > label');
        const ctrl = f.querySelector('.stepper, .input, .select');
        const fr = f.getBoundingClientRect();
        const cr = ctrl ? ctrl.getBoundingClientRect() : null;
        const lr = label ? label.getBoundingClientRect() : null;
        return {
          label: label ? label.textContent : '',
          field: { y: round(fr.y), h: round(fr.height), bottom: round(fr.bottom) },
          labelRect: label ? rect(label) : null,
          ctrlRect: ctrl ? rect(ctrl) : null,
          ctrlY: cr ? round(cr.y) : null,
          ctrlH: cr ? round(cr.height) : null,
          labelY: lr ? round(lr.y) : null,
          labelBottom: lr ? round(lr.bottom) : null,
          // 关键指标：标签顶部相对栏顶端的偏移（越大说明该标签越靠下）
          labelTop: lr ? round(lr.y - fr.y) : null,
          labelVsCtrl: lr && cr ? round(lr.x - cr.x) : null,
        };
      });
      return { barRect: rect(bar), rows };
    })()`);
    console.log('=== 设置栏标签横向对齐 ===');
    console.log(JSON.stringify(al, null, 2));
    ws.close();
    chrome.kill();
    process.exit(0);
  }

  if (ROUTE === 'seqbar') {
    const sp = await evaluate(`(() => {
      const round = (n) => Math.round(n * 10) / 10;
      const bar = document.querySelector('.setup-bar');
      const box = (el) => { const r = el.getBoundingClientRect(); return { x: round(r.x), w: round(r.width), right: round(r.right) }; };
      const fields = [...bar.querySelectorAll(':scope > .field')].map((f) => {
        const label = f.querySelector('label');
        const ctrl = f.querySelector('.stepper, .input, .select');
        return {
          label: label ? label.textContent : '',
          htmlFor: label ? label.getAttribute('for') : null,
          field: box(f),
          control: ctrl ? box(ctrl) : null,
          tailGap: ctrl ? Math.round(f.getBoundingClientRect().right - ctrl.getBoundingClientRect().right) : null,
        };
      });
      const time = document.querySelector('#f-time');
      const seq = document.querySelector('#f-seq');
      const deck = document.querySelector('#f-deck');
      return {
        order: fields.map((f) => f.label),
        fields,
        time: time ? { type: time.type, value: time.value } : null,
        seq: seq ? { type: seq.type, value: seq.value, min: seq.min, max: seq.max } : null,
        deck: deck ? { value: deck.value } : null,
      };
    })()`);
    console.log('=== 设置栏顺序与序号字段 ===');
    console.log(JSON.stringify(sp, null, 2));
    ws.close();
    chrome.kill();
    process.exit(0);
  }

  if (ROUTE === 'seqflow') {
    const flow = await evaluate(`(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const time = document.querySelector('#f-time');
      const seq = document.querySelector('#f-seq');
      const seqWrap = seq.closest('.stepper');
      const plus = [...seqWrap.querySelectorAll('button')].pop();
      const minus = seqWrap.querySelectorAll('button')[0];
      const read = () => ({ date: time.value, seq: seq.value });
      const initial = read();

      // ① 改到另一天：未手改过 → 应按那天已有局数重算
      time.value = '2026-09-26';
      time.dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(120);
      const afterDate = read();

      // ② 手改序号（+1）
      plus.click();
      await sleep(80);
      const afterPlus = read();

      // ③ 再换日期：已手改 → 不应被覆盖
      time.value = '2026-09-05';
      time.dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(120);
      const afterTouched = read();

      // ④ − 按钮边界（回到 1 再减一次不应 < 1）
      minus.click(); minus.click(); minus.click(); minus.click();
      await sleep(80);
      const afterMinus = read();

      // 复位（不保存）：重新载入页面
      return { initial, afterDate, afterPlus, afterTouched, afterMinus };
    })()`);
    console.log('=== 第几局交互流程 ===');
    console.log(JSON.stringify(flow, null, 2));
    ws.close();
    chrome.kill();
    process.exit(0);
  }

  const probe = await evaluate(`(() => {
    const q = (s) => document.querySelector(s);
    const round = (n) => Math.round(n * 10) / 10;
    const campsWrap = q('.camps');
    const camps = [...document.querySelectorAll('.camps .camp')];
    const wrapBox = campsWrap ? campsWrap.getBoundingClientRect() : null;
    const timeInput = q('#f-time');
    const readout = q('.entry-bar');
    const addCampBtn = [...document.querySelectorAll('.entry-bar button')].find((b) =>
      b.textContent.includes('增加阵营')
    );
    return {
      campCount: camps.length,
      campN: campsWrap ? campsWrap.style.getPropertyValue('--camp-n') : null,
      gridCols: campsWrap ? getComputedStyle(campsWrap).gridTemplateColumns : null,
      wrapWidth: wrapBox ? round(wrapBox.width) : null,
      campWidths: camps.map((c) => round(c.getBoundingClientRect().width)),
      campTops: camps.map((c) => Math.round(c.getBoundingClientRect().top)),
      timeType: timeInput ? timeInput.type : null,
      timeValue: timeInput ? timeInput.value : null,
      timeLabel: (() => { const l = document.querySelector('label[for=f-time]'); return l ? l.textContent : null; })(),
      addCampInReadout: !!addCampBtn,
      readoutText: readout ? readout.textContent.replace(/\\s+/g, ' ').slice(0, 120) : null,
      buttonInCamps: [...document.querySelectorAll('.camps button')].map((b) => b.textContent.trim()).filter((t) => t.includes('增加阵营')),
    };
  })()`);

  console.log('=== 默认（2 阵营）===');
  console.log(JSON.stringify(probe, null, 2));

  // 点一次「增加阵营」，验证 3 阵营三分
  const clicked = await evaluate(`(() => {
    const b = [...document.querySelectorAll('.entry-bar button')].find((x) => x.textContent.includes('增加阵营'));
    if (!b) return false;
    b.click();
    return true;
  })()`);
  await new Promise((r) => setTimeout(r, 800));
  const probe3 = await evaluate(`(() => {
    const round = (n) => Math.round(n * 10) / 10;
    const campsWrap = document.querySelector('.camps');
    const camps = [...document.querySelectorAll('.camps .camp')];
    return {
      campCount: camps.length,
      campN: campsWrap ? campsWrap.style.getPropertyValue('--camp-n') : null,
      gridCols: getComputedStyle(campsWrap).gridTemplateColumns,
      campWidths: camps.map((c) => round(c.getBoundingClientRect().width)),
      campTops: camps.map((c) => Math.round(c.getBoundingClientRect().top)),
    };
  })()`);
  console.log('=== 点击增加阵营后（3 阵营）===');
  console.log('clicked:', clicked);
  console.log(JSON.stringify(probe3, null, 2));

  // 再加到 4 阵营（上限），验证按钮自动隐藏
  await evaluate(`(() => {
    const b = [...document.querySelectorAll('.entry-bar button')].find((x) => x.textContent.includes('增加阵营'));
    if (b) b.click();
    return true;
  })()`);
  await new Promise((r) => setTimeout(r, 800));
  const probe4 = await evaluate(`(() => {
    const round = (n) => Math.round(n * 10) / 10;
    const campsWrap = document.querySelector('.camps');
    const camps = [...document.querySelectorAll('.camps .camp')];
    return {
      campCount: camps.length,
      campN: campsWrap.style.getPropertyValue('--camp-n'),
      campWidths: camps.map((c) => round(c.getBoundingClientRect().width)),
      addBtnVisible: !![...document.querySelectorAll('.entry-bar button')].find((b) => b.textContent.includes('增加阵营')),
    };
  })()`);
  console.log('=== 4 阵营（上限）===');
  console.log(JSON.stringify(probe4, null, 2));

  ws.close();
  chrome.kill();
  process.exit(0);
})().catch((e) => {
  console.log('ERR', e && e.message);
  process.exit(1);
});
