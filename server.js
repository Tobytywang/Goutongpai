'use strict';

/**
 * 沟通牌计分平台 —— 零第三方依赖的 HTTP 服务
 *
 * 只用 Node.js 内置模块（node:http / node:fs / node:sqlite），
 * 因此 `node server.js` 即可启动，无需 npm install。
 *
 * 环境变量：
 *   PORT      监听端口，默认 5178
 *   HOST      监听地址，默认 0.0.0.0
 *   BASE_URL  对外访问地址，仅用于启动日志提示
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const url = require('node:url');

// Node 会把 node:sqlite 标记为实验性并打印警告，会被误当成启动报错。
// 这里只屏蔽这一条特定的警告，其它警告照常输出。
const originalEmit = process.emit;
process.emit = function (event, payload, ...rest) {
  if (
    event === 'warning' &&
    payload &&
    payload.name === 'ExperimentalWarning' &&
    /SQLite/i.test(payload.message || '')
  ) {
    return false;
  }
  return originalEmit.call(process, event, payload, ...rest);
};

const db = require('./lib/db');
const api = require('./lib/api');

const PORT = Number(process.env.PORT || 5178);
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_BODY = 12 * 1024 * 1024; // 12MB，容纳压缩后的照片 base64

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

// ---------------------------------------------------------------- 工具

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload ?? {});
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let aborted = false;

    req.on('data', (chunk) => {
      if (aborted) return;
      size += chunk.length;
      if (size > MAX_BODY) {
        aborted = true;
        reject(new api.ApiError(413, `请求体过大（上限 ${MAX_BODY / 1024 / 1024}MB），请压缩图片后重试`));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (aborted) return;
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new api.ApiError(400, '请求体不是合法的 JSON'));
      }
    });
    req.on('error', reject);
  });
}

/** 把请求路径安全地映射到某个根目录下的文件，越界返回 null */
function safeResolve(rootDir, relativePath) {
  const decoded = decodeURIComponent(relativePath).replace(/\\/g, '/');
  const normalized = path.normalize(decoded).replace(/^(\.\.[/\\])+/, '');
  const target = path.join(rootDir, normalized);
  const rel = path.relative(rootDir, target);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return target;
}

function serveFile(res, filePath, { cache = false } = {}) {
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': cache ? 'public, max-age=604800' : 'no-cache',
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

// ---------------------------------------------------------------- 路由

const routes = [
  ['GET', /^\/api\/health$/, () => ({ ok: true, time: db.now() })],
  ['POST', /^\/api\/auth\/login$/, (ctx) => api.wxLogin(ctx.body)],
  ['GET', /^\/api\/bootstrap$/, () => api.bootstrap()],

  ['POST', /^\/api\/players$/, (ctx) => api.createPlayer(ctx.body)],
  ['PUT', /^\/api\/players\/(\d+)$/, (ctx) => api.updatePlayer(Number(ctx.params[0]), ctx.body)],
  ['DELETE', /^\/api\/players\/(\d+)$/, (ctx) => api.deletePlayer(Number(ctx.params[0]))],
  [
    'POST',
    /^\/api\/players\/(\d+)\/avatar$/,
    (ctx) => api.uploadPlayerImage(Number(ctx.params[0]), ctx.body, 'avatar'),
  ],
  [
    'POST',
    /^\/api\/players\/(\d+)\/photo$/,
    (ctx) => api.uploadPlayerImage(Number(ctx.params[0]), ctx.body, 'photo'),
  ],

  ['GET', /^\/api\/seasons$/, () => api.bootstrap().seasons],
  ['POST', /^\/api\/seasons$/, (ctx) => api.createSeason(ctx.body)],
  ['PUT', /^\/api\/seasons\/(\d+)$/, (ctx) => api.updateSeason(Number(ctx.params[0]), ctx.body)],
  ['DELETE', /^\/api\/seasons\/(\d+)$/, (ctx) => api.deleteSeason(Number(ctx.params[0]))],

  ['GET', /^\/api\/matches$/, () => api.bootstrap().matches],
  ['POST', /^\/api\/matches$/, (ctx) => api.createMatch(ctx.body)],
  ['GET', /^\/api\/matches\/(\d+)$/, (ctx) => api.getMatch(Number(ctx.params[0]))],
  ['DELETE', /^\/api\/matches\/(\d+)$/, (ctx) => api.deleteMatch(Number(ctx.params[0]))],

  ['GET', /^\/api\/highlights$/, () => api.bootstrap().highlights],
  ['POST', /^\/api\/highlights$/, (ctx) => api.createHighlight(ctx.body)],
  ['PUT', /^\/api\/highlights\/(\d+)$/, (ctx) => api.updateHighlight(Number(ctx.params[0]), ctx.body)],
  ['DELETE', /^\/api\/highlights\/(\d+)$/, (ctx) => api.deleteHighlight(Number(ctx.params[0]))],
];

/** 会被改数据的 HTTP 方法 */
const WRITE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

async function handleApi(req, res, pathname) {
  const method = req.method.toUpperCase();

  for (const [routeMethod, pattern, handler] of routes) {
    const m = pattern.exec(pathname);
    if (!m) continue;
    if (routeMethod !== method) continue;

    // 网页端只读：来自浏览器（带 Origin 头）的写入请求直接拒绝；
    // 小程序走 wx.request（不带 Origin）不受影响，仍可正常录入 / 编辑 / 删除。
    if (api.isWebReadonly() && WRITE_METHODS.includes(method) && req.headers.origin) {
      sendJson(res, 403, { ok: false, error: '网页端为只读模式，写入操作请使用小程序', code: 'WEB_READONLY' });
      return true;
    }

    const ctx = {
      params: m.slice(1),
      body: ['POST', 'PUT', 'PATCH'].includes(method) ? await readBody(req) : {},
      req,
      res,
    };
    const result = await handler(ctx);
    sendJson(res, 200, { ok: true, data: result });
    return true;
  }

  // 路径匹配上了但方法不对时，给出更准确的提示
  const allowed = routes.filter(([, pattern]) => pattern.test(pathname)).map(([mth]) => mth);
  if (allowed.length) {
    res.setHeader('Allow', allowed.join(', '));
    sendJson(res, 405, { ok: false, error: `${pathname} 不支持 ${method} 方法，可用：${allowed.join(' / ')}` });
    return true;
  }
  return false;
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url);
  const pathname = parsed.pathname || '/';

  try {
    if (pathname.startsWith('/api/')) {
      const handled = await handleApi(req, res, pathname);
      if (!handled) sendJson(res, 404, { ok: false, error: `接口不存在：${pathname}` });
      return;
    }

    // 上传的图片
    if (pathname.startsWith('/uploads/')) {
      const target = safeResolve(db.UPLOAD_DIR, pathname.slice('/uploads/'.length));
      if (!target) {
        res.writeHead(400).end('Bad Request');
        return;
      }
      serveFile(res, target, { cache: true });
      return;
    }

    // 前端静态资源
    const rel = pathname === '/' ? 'index.html' : pathname.slice(1);
    const target = safeResolve(PUBLIC_DIR, rel);
    if (!target) {
      res.writeHead(400).end('Bad Request');
      return;
    }
    if (fs.existsSync(target) && fs.statSync(target).isFile()) {
      serveFile(res, target);
      return;
    }
    // 单页应用兜底：未知路径回到 index.html
    serveFile(res, path.join(PUBLIC_DIR, 'index.html'));
  } catch (err) {
    const status = err instanceof api.ApiError ? err.status : 500;
    if (status >= 500) console.error('[error]', err);
    sendJson(res, status, { ok: false, error: err.message || '服务器内部错误' });
  }
});

// ---------------------------------------------------------------- 启动

function printBanner() {
  const base = process.env.BASE_URL || `http://localhost:${PORT}`;
  const bd = require('./lib/score').DECK_BREAKDOWN.map(
    (c) => `${c.face}=${c.points}分×${c.copies}张`
  ).join('，');

  console.log('');
  console.log('  🀄  沟通牌计分平台 已启动');
  console.log('  ─────────────────────────────────────────────');
  console.log(`  本机访问    ${base}`);
  console.log(`  局域网访问  http://<本机IP>:${PORT}   （手机同 WiFi 可直接打开）`);
  console.log(`  数据文件    ${db.DB_FILE}`);
  console.log(`  图片目录    ${db.UPLOAD_DIR}`);
  console.log(`  计分口径    单副牌 100 分（${bd}）`);
  console.log('  ─────────────────────────────────────────────');
  console.log('  按 Ctrl+C 停止服务');
  console.log('');
}

function start() {
  try {
    db.init();
  } catch (err) {
    console.error('\n启动失败：\n' + err.message + '\n');
    process.exit(1);
  }

  server.listen(PORT, HOST, printBanner);

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n端口 ${PORT} 已被占用。请换个端口启动，例如：\n  PORT=5179 node server.js\n`);
      process.exit(1);
    }
    console.error('服务启动失败：', err);
    process.exit(1);
  });

  const shutdown = () => {
    console.log('\n正在关闭服务…');
    server.close(() => {
      try {
        db.handle().close();
      } catch (_) {
        /* 已关闭则忽略 */
      }
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 2000).unref();
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start();
