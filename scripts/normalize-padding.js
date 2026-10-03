// 面板内边距归一化到 16px（--sp-4），避免 14/16/18 混用；保留表格/弹窗特殊值
const fs = require('fs');
const file = 'public/css/style.css';
const src = fs.readFileSync(file, 'utf8');
fs.writeFileSync(file + '.bak2', src);

const map = {
  'padding: 14px 18px;': 'padding: var(--sp-4) var(--sp-4);',
  'padding: 18px 18px 34px;': 'padding: var(--sp-4) var(--sp-4) 34px;',
  'padding: 14px 16px;': 'padding: var(--sp-4) var(--sp-4);',
  'padding: 14px;': 'padding: var(--sp-4);',
  'padding: 18px;': 'padding: var(--sp-4);',
  'padding: 16px;': 'padding: var(--sp-4);',
};

let out = src;
const counts = {};
for (const [from, to] of Object.entries(map)) {
  const n = out.split(from).length - 1;
  if (n) counts[from] = n;
  out = out.split(from).join(to);
}
fs.writeFileSync(file, out);
console.log('替换统计：', JSON.stringify(counts));
console.log('剩余 14/18px 面板 padding（应为空）：');
const left = [...out.matchAll(/padding:\s*(14px|18px)[^;]*/g)].map((m) => m[0]);
console.log([...new Set(left)].join(' | ') || '（无）');
