/* 通用工具：DOM 构建、格式化、图片压缩、弹窗、提示 */

/* ---------------------------------------------------------------- DOM */

const PROP_ALIAS = { for: 'htmlFor', class: 'className', readonly: 'readOnly', maxlength: 'maxLength' };

function append(parent, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false || child === true) continue;
    parent.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

/**
 * 创建元素。文本一律走 textContent，从根上避免 XSS。
 * h('div', { class: 'x', onclick: fn }, '文本', h('b', {}, '加粗'))
 */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [rawKey, value] of Object.entries(props || {})) {
    if (value === null || value === undefined || value === false) continue;
    const key = PROP_ALIAS[rawKey] || rawKey;

    if (key === 'style' && typeof value === 'object') {
      /* 注意：自定义属性（--x）**不能**用 el.style['--x'] = v 赋值 —— CSSOM 不认识这种写法，
         会静默失败（曾导致阵营色 --camp-color / 列数 --camp-n 全部落到 CSS 里的兜底值），
         必须走 setProperty；普通属性仍按驼峰名赋值。 */
      for (const [prop, v] of Object.entries(value)) {
        if (v === null || v === undefined) continue;
        if (prop.startsWith('--')) el.style.setProperty(prop, String(v));
        else el.style[prop] = v;
      }
    }
    else if (key === 'dataset' && typeof value === 'object') Object.assign(el.dataset, value);
    /* 注意：不允许 html 注入分支——所有文本一律走 textContent（见下方 append），
       避免任何外部/用户输入被当成 HTML 执行。需要富文本时由调用方显式构造子节点。 */
    else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key in el && typeof value !== 'object') {
      el[key] = value;
    } else {
      el.setAttribute(rawKey, value);
    }
  }
  append(el, children);
  return el;
}

export const $ = (sel, root = document) => root.querySelector(sel);

/** 追加子节点，自动跳过 null / undefined / 布尔值（原生 append 会把 null 变成 "null"） */
export function appendAll(parent, ...children) {
  parent.replaceChildren();
  append(parent, children);
  return parent;
}

/* ---------------------------------------------------------------- 格式化 */

/** 把 "2026-09-29 21:30:00" 变成 "09-29 21:30" */
export function fmtDateTime(value) {
  if (!value) return '—';
  const s = String(value);
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(s);
  if (!m) return s;
  return `${m[2]}-${m[3]} ${m[4]}:${m[5]}`;
}

export function fmtDate(value) {
  if (!value) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  return m ? `${m[1]}-${m[2]}-${m[3]}` : String(value);
}

/** 相对时间：3 小时前 / 2 天前。只记日期的 "YYYY-MM-DD" 按整天算 */
export function fmtRelative(value) {
  const s = String(value || '');
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    const today0 = new Date();
    today0.setHours(0, 0, 0, 0);
    const day = Math.round((today0 - new Date(y, m - 1, d)) / 86400000);
    if (day <= 0) return '今天';
    if (day === 1) return '昨天';
    if (day < 30) return `${day} 天前`;
    return fmtDate(s);
  }
  const t = Date.parse(s.replace(' ', 'T'));
  if (!Number.isFinite(t)) return '';
  const diff = Date.now() - t;
  const min = Math.round(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day} 天前`;
  return fmtDate(s);
}

/** 对局只对内讲「第几局」：按同一天的对局，按 id 升序编号，返回 Map(id → 当天第几局) */
export function matchSeqByDay(matches) {
  const groups = new Map();
  [...(matches || [])]
    .slice()
    .sort((a, b) => (a.id || 0) - (b.id || 0))
    .forEach((m) => {
      const key = String(m.played_at || '').slice(0, 10);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(m);
    });
  const seq = new Map();
  for (const group of groups.values()) {
    group.forEach((m, i) => {
      // 存过序号的对局用存下来的值（可按需改），历史数据回落到按顺序推算
      const stored = Math.floor(Number(m.seq));
      seq.set(m.id, Number.isFinite(stored) && stored > 0 ? stored : i + 1);
    });
  }
  return seq;
}

/** 某一天下一局应该是第几局（用于录入时预填，可在界面上改） */
export function nextMatchSeq(matches, date) {
  const day = String(date || '').slice(0, 10);
  const sameDay = (matches || []).filter((m) => String(m.played_at || '').slice(0, 10) === day);
  const seq = matchSeqByDay(sameDay);
  let max = 0;
  for (const v of seq.values()) max = Math.max(max, v);
  return max + 1;
}

export function pct(numerator, denominator, digits = 0) {
  if (!denominator) return '—';
  return `${((numerator / denominator) * 100).toFixed(digits)}%`;
}

/** 本地当前时间，格式与后端 db.now() 一致 */
export function localNow() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function localToday() {
  return localNow().slice(0, 10);
}

export function debounce(fn, wait = 220) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

/* ---------------------------------------------------------------- 头像 */

const AVATAR_PALETTE = ['#0f5132', '#2f5d8a', '#8a4b2f', '#5b3d8a', '#2f7d6b', '#8a2f4b', '#4b6b2f'];

function paletteFor(seed) {
  let sum = 0;
  for (const ch of String(seed || '?')) sum += ch.codePointAt(0);
  return AVATAR_PALETTE[sum % AVATAR_PALETTE.length];
}

/**
 * 头像元素：有上传图片显示图片，否则显示昵称首字 + 稳定配色。
 * @param {{name:string, avatar?:string, photo?:string}} player
 * @param {'sm'|'md'|'lg'} size
 */
export function avatarEl(player, size = 'md', { square = false } = {}) {
  const px = { sm: 28, md: 40, lg: 72 }[size] || 40;
  const cls = `avatar avatar--${size}`;
  const name = (player && player.name) || '?';

  if (player && player.avatar) {
    return h('img', { class: cls, src: `/uploads/${player.avatar}`, alt: '', loading: 'lazy', width: px, height: px });
  }

  const style = {
    width: `${px}px`,
    height: `${px}px`,
    background: square ? paletteFor(name) : undefined,
    color: square ? '#fff' : undefined,
    fontSize: `${Math.round(px * 0.42)}px`,
  };
  if (!square) style.background = paletteFor(name) + '22';
  if (!square) style.color = paletteFor(name);

  return h(
    'span',
    { class: 'avatar-fallback', style, 'aria-hidden': 'true' },
    Array.from(name)[0] || '?'
  );
}

/* ---------------------------------------------------------------- 图片压缩 */

/**
 * 上传策略（唯一来源）：每种用途的「最大边长 / 起始品质 / 体积预算」。
 * 目标是把 base64 体积压到几百 KB 量级，避免原图直接落盘。
 * 预算压不进去时会自动降品质、再降尺寸（见 fitImage）。
 */
export const IMAGE_PRESETS = {
  avatar: { maxSide: 320, quality: 0.9, maxBytes: 60 * 1024, label: '头像' },
  photo: { maxSide: 1200, quality: 0.85, maxBytes: 240 * 1024, label: '个性照片' },
  figure: { maxSide: 1200, quality: 0.85, maxBytes: 260 * 1024, label: '现场图片' },
};

/** 人话版的体积描述，用于界面提示与 toast */
export function fmtBytes(n) {
  const b = Number(n) || 0;
  if (b >= 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)}MB`;
  if (b >= 1024) return `${Math.round(b / 1024)}KB`;
  return `${b}B`;
}

/** 压缩结果的一句话描述：`4000×3000 3.1MB → 320×240 18KB` */
export function describeImage(out) {
  if (!out) return '';
  const after = `${out.width}×${out.height} ${fmtBytes(out.bytes)}`;
  if (!out.recompressed) return `${after}（原图已够小，未重压）`;
  return `${out.srcWidth}×${out.srcHeight} ${fmtBytes(out.srcBytes)} → ${after}`;
}

/** 把 data URL 的字符长度换算成真实字节数（base64 膨胀 4/3） */
function dataUrlBytes(dataUrl) {
  const body = String(dataUrl).slice(String(dataUrl).indexOf(',') + 1);
  return Math.round((body.length * 3) / 4);
}

function drawToJpeg(img, side, quality) {
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;
  const scale = Math.min(1, side / Math.max(srcW, srcH));
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff'; // PNG 透明区域转 JPEG 后填白，避免变黑
  ctx.fillRect(0, 0, w, h);
  // 缩图质量：默认插值在缩小时会有锯齿，显式开高质量重采样
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);

  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  return { dataUrl, width: w, height: h, bytes: dataUrlBytes(dataUrl) };
}

/**
 * 先在给定边长/品质下编码；超出体积预算就逐档降品质，品质到底再降尺寸。
 * 返回 { dataUrl, width, height, bytes, quality, steps, withinBudget }
 */
function fitImage(img, { maxSide, quality, maxBytes }) {
  let side = maxSide;
  let q = quality;
  let smallest = null;

  for (let step = 0; step < 7; step++) {
    const out = drawToJpeg(img, side, q);
    if (!smallest || out.bytes < smallest.bytes) smallest = { ...out, quality: q, steps: step };
    if (out.bytes <= maxBytes) return { ...out, quality: q, steps: step, withinBudget: true };
    if (q > 0.56) {
      q = Math.max(0.55, q - 0.12); // 先降品质：同尺寸下画质损失比缩小尺寸更小
    } else {
      side = Math.max(160, Math.round(side * 0.75)); // 品质压不动了就缩尺寸
      q = 0.7;
    }
  }
  return { ...smallest, withinBudget: false }; // 兜底：返回试出来最小的那张
}

/**
 * 读取用户选的文件，按 maxSide 等比缩放 + JPEG 重编码，体积压到 maxBytes 内。
 * 返回 { dataUrl, width, height, bytes, srcWidth, srcHeight, srcBytes, recompressed, quality, withinBudget }。
 * 原图本来就「够小」时直接原样返回（不重编码，少一次画质损失）。
 */
export function compressImage(file, { maxSide = 1200, quality = 0.86, maxBytes = 260 * 1024 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('没有选择文件'));
    if (!/^image\//.test(file.type)) return reject(new Error('请选择图片文件（PNG / JPG / WebP）'));
    if (file.size > 20 * 1024 * 1024) return reject(new Error('原图超过 20MB，请先压缩再上传（或换一张）'));

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('图片解析失败，可能文件已损坏'));
      img.onload = () => {
        try {
          const srcW = img.naturalWidth || img.width;
          const srcH = img.naturalHeight || img.height;
          const keepOriginal =
            srcW <= maxSide &&
            srcH <= maxSide &&
            file.size <= maxBytes &&
            /^image\/(jpeg|png|webp)$/i.test(file.type);

          const base = { srcWidth: srcW, srcHeight: srcH, srcBytes: file.size };
          if (keepOriginal) {
            return resolve({
              ...base,
              dataUrl: reader.result,
              width: srcW,
              height: srcH,
              bytes: file.size,
              recompressed: false,
              quality: null,
              withinBudget: true,
              steps: 0,
            });
          }
          const out = fitImage(img, { maxSide, quality, maxBytes });
          resolve({ ...base, ...out, recompressed: true });
        } catch (err) {
          reject(new Error('图片处理失败：' + err.message));
        }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ---------------------------------------------------------------- 提示 */

export function toast(message, type = '') {
  const root = document.getElementById('toastRoot');
  if (!root) return;
  const node = h('div', { class: `toast${type ? ` toast--${type}` : ''}` }, message);
  root.append(node);
  setTimeout(() => {
    node.style.transition = 'opacity .25s, transform .25s';
    node.style.opacity = '0';
    node.style.transform = 'translateY(8px)';
    setTimeout(() => node.remove(), 260);
  }, type === 'err' ? 4200 : 2400);
}

export const notifyOk = (msg) => toast(msg, 'ok');
export const notifyErr = (msg) => toast(msg, 'err');

/* ---------------------------------------------------------------- 弹窗 */

/**
 * 打开一个弹窗。返回 { modal, body, foot, close }，由调用方填充内容。
 */
export function openModal({ title, wide = false, onClose } = {}) {
  const root = document.getElementById('modalRoot');
  const body = h('div', { class: 'modal__body' });
  const foot = h('div', { class: 'modal__foot' });

  // 记录打开前的焦点，关闭后归还，避免键盘用户「迷失」到背景
  const trigger = document.activeElement;

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey);
    mask.remove();
    if (trigger && typeof trigger.focus === 'function') trigger.focus();
    if (onClose) onClose();
  };

  const titleId = `modal-title-${Math.random().toString(36).slice(2, 9)}`;
  const closeBtn = h('button', { class: 'modal__close', type: 'button', 'aria-label': '关闭', onclick: close }, '×');

  const modal = h(
    'div',
    { class: `modal${wide ? ' modal--wide' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId },
    h('div', { class: 'modal__head' }, h('h3', { id: titleId }, title || ''), closeBtn),
    body,
    foot
  );

  const mask = h('div', {
    class: 'modal-mask',
    onclick: (e) => {
      if (e.target === mask) close();
    },
  }, modal);

  // 焦点陷阱：Tab / Shift+Tab 在弹窗内循环，不跑到背景
  const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  const onKey = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key !== 'Tab') return;
    const nodes = Array.from(modal.querySelectorAll(FOCUSABLE)).filter((n) => n.offsetParent !== null);
    if (nodes.length === 0) {
      e.preventDefault();
      return;
    }
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    } else if (!modal.contains(document.activeElement)) {
      // 焦点意外跑到弹窗外（如初始焦点被其它逻辑夺走），拉回第一个
      e.preventDefault();
      first.focus();
    }
  };
  document.addEventListener('keydown', onKey);
  root.append(mask);

  const firstInput = modal.querySelector('input, select, textarea');
  if (firstInput) setTimeout(() => firstInput.focus(), 40);
  else modal.querySelector('.modal__close')?.focus();

  return { modal, body, foot, close };
}

/** 二次确认弹窗，返回 Promise<boolean> */
export function confirmDialog({ title = '确认操作', message, confirmText = '确认', danger = false } = {}) {
  return new Promise((resolve) => {
    let decided = false;
    const { body, foot, close } = openModal({
      title,
      onClose: () => {
        if (!decided) resolve(false);
      },
    });

    body.append(h('p', { style: { fontSize: '13px', lineHeight: '1.7' } }, message));

    const cancel = h('button', { class: 'btn', type: 'button', onclick: () => close() }, '取消');
    const ok = h(
      'button',
      {
        class: `btn ${danger ? 'btn--danger' : 'btn--primary'}`,
        type: 'button',
        onclick: () => {
          decided = true;
          close();
          resolve(true);
        },
      },
      confirmText
    );
    foot.append(cancel, ok);
  });
}

/** 表单弹窗的便捷封装：字段定义 → 自动收集返回值 */
export function formModal({ title, fields, submitText = '保存', wide = false, onSubmit }) {
  const { body, foot, close } = openModal({ title, wide });
  const inputs = new Map();

  const groups = fields.map((f) => {
    if (f.type === 'custom') return f.node;
    const id = `f_${Math.random().toString(36).slice(2, 9)}`;
    let control;

    if (f.type === 'textarea') {
      control = h('textarea', { class: 'textarea', id, placeholder: f.placeholder || '', rows: f.rows || 4 });
    } else if (f.type === 'select') {
      control = h(
        'select',
        { class: 'select', id },
        (f.options || []).map((o) => h('option', { value: o.value, selected: o.value === f.value }, o.label))
      );
    } else if (f.type === 'checkbox') {
      control = h('input', { type: 'checkbox', id, checked: !!f.value });
    } else {
      control = h('input', {
        class: 'input',
        id,
        type: f.type || 'text',
        value: f.value ?? '',
        placeholder: f.placeholder || '',
        min: f.min,
        max: f.max,
      });
    }

    inputs.set(f.name, { field: f, control });

    const labelNode =
      f.type === 'checkbox'
        ? h('label', { class: 'check', for: id }, control, h('span', {}, f.label))
        : h('label', { for: id }, f.label);

    return h(
      'div',
      { class: `field${f.full ? ' field--full' : ''}` },
      labelNode,
      f.type === 'checkbox' ? null : control,
      f.tip ? h('span', { class: 'tip' }, f.tip) : null
    );
  });

  body.append(h('div', { class: 'form-grid' }, groups));

  const readValues = () => {
    const out = {};
    for (const [name, { field, control }] of inputs) {
      if (field.type === 'checkbox') out[name] = control.checked;
      else if (field.type === 'number') out[name] = control.value === '' ? null : Number(control.value);
      else out[name] = control.value.trim();
    }
    return out;
  };

  const submitBtn = h(
    'button',
    {
      class: 'btn btn--primary',
      type: 'button',
      onclick: async () => {
        submitBtn.disabled = true;
        try {
          const result = await onSubmit(readValues());
          if (result !== false) close();
        } catch (err) {
          notifyErr(err.message || '保存失败');
        } finally {
          submitBtn.disabled = false;
        }
      },
    },
    submitText
  );

  const form = h('form', {
    onsubmit: (e) => {
      e.preventDefault();
      submitBtn.click();
    },
  });
  foot.append(h('button', { class: 'btn', type: 'button', onclick: () => close() }, '取消'), submitBtn);
  body.append(form);

  // 回车提交
  body.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') {
      e.preventDefault();
      submitBtn.click();
    }
  });

  return { close, readValues, body, foot };
}
