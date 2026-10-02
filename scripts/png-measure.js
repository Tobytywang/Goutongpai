/* 无依赖 PNG 解码 + 逐行暗像素游程测量：用于从截图里量真实坐标 */
const fs = require('node:fs');
const zlib = require('node:zlib');

function decodePng(file) {
  const buf = fs.readFileSync(file);
  let pos = 8;
  let w = 0,
    h = 0,
    bitDepth = 8,
    colorType = 6;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (bitDepth !== 8) throw new Error('只支持 8bit，实际 ' + bitDepth);
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
  if (!channels) throw new Error('不支持的颜色类型 ' + colorType);

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * channels;
  const out = Buffer.alloc(h * stride);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const cur = Buffer.alloc(stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? cur[i - channels] : 0;
      const b = prev[i];
      const c = i >= channels ? prev[i - channels] : 0;
      let v = line[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a),
          pb = Math.abs(p - b),
          pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[i] = v & 0xff;
    }
    cur.copy(out, y * stride);
    prev = cur;
  }
  return { w, h, channels, data: out };
}

const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

function rowRuns(img, y, x0, x1, threshold) {
  const { data, channels, w } = img;
  const cols = [];
  for (let x = x0; x < x1; x++) {
    const i = (y * w + x) * channels;
    cols.push(lum(data[i], data[i + 1], data[i + 2]) < threshold ? 1 : 0);
  }
  const runs = [];
  let start = -1;
  let gap = 0;
  for (let i = 0; i < cols.length; i++) {
    if (cols[i]) {
      if (start < 0) start = i;
      gap = 0;
    } else if (start >= 0) {
      gap++;
      if (gap > 8) {
        runs.push([x0 + start, x0 + i - gap]);
        start = -1;
        gap = 0;
      }
    }
  }
  if (start >= 0) runs.push([x0 + start, x0 + cols.length - 1]);
  return runs.filter((r) => r[1] - r[0] >= 1);
}

const file = process.argv[2];
const yStart = Number(process.argv[3] || 0);
const yEnd = Number(process.argv[4] || 140);
const threshold = Number(process.argv[5] || 150);
const img = decodePng(file);
console.log(`图片 ${img.w}x${img.h}, channels=${img.channels}, 阈值=${threshold}`);
for (let y = yStart; y < Math.min(yEnd, img.h); y++) {
  const runs = rowRuns(img, y, 0, img.w, threshold);
  if (runs.length) {
    console.log(
      'y=' + String(y).padStart(4) + '  ' + runs.map((r) => `${r[0]}..${r[1]}`).join('  ')
    );
  }
}
