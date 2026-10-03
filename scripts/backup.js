'use strict';

/**
 * 一键备份：把 data/ 目录整体复制到 backups/YYYY-MM-DD_HHmm/ 下。
 *
 * 用法：npm run backup
 * SQLite 开了 WAL 模式，直接复制文件是安全的（会一并复制 -wal / -shm）。
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = process.env.GTP_DATA_DIR ? path.resolve(process.env.GTP_DATA_DIR) : path.join(ROOT, 'data');

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}

function dirSize(dir) {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) total += dirSize(full);
    else total += fs.statSync(full).size;
  }
  return total;
}

function main() {
  if (!fs.existsSync(DATA_DIR)) {
    console.error(`数据目录不存在：${DATA_DIR}`);
    console.error('还没有产生任何数据，无需备份。');
    process.exit(1);
  }

  const target = path.join(ROOT, 'backups', stamp());
  fs.mkdirSync(target, { recursive: true });
  fs.cpSync(DATA_DIR, target, { recursive: true });

  const size = dirSize(target);
  const uploadsDir = path.join(target, 'uploads');
  const fileCount = fs.existsSync(uploadsDir) ? fs.readdirSync(uploadsDir).length : 0;

  console.log(`\n备份完成`);
  console.log(`  来源：${DATA_DIR}`);
  console.log(`  目标：${target}`);
  console.log(`  大小：${(size / 1024).toFixed(1)} KB（含 ${fileCount} 张图片）`);
  console.log(`\n恢复方式：停掉服务，把备份目录里的内容复制回 data/ 即可。\n`);
}

main();
