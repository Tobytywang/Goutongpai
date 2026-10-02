// 圆角字面量→令牌（保留 999px 药丸与特殊值）
const fs = require('fs');
const file = 'public/css/style.css';
const src = fs.readFileSync(file, 'utf8');
fs.writeFileSync(file + '.bak3', src);

const map = {
  'border-radius: 6px;': 'border-radius: var(--radius-sm);',
  'border-radius: 8px;': 'border-radius: var(--radius);',
  'border-radius: 10px;': 'border-radius: var(--radius);',
  'border-radius: 14px;': 'border-radius: var(--radius-lg);',
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
console.log('剩余非药丸圆角字面量（应为空或仅 999px）：');
const left = [...out.matchAll(/border-radius:\s*([\d.]+)px;/g)].map((m) => m[1]);
console.log([...new Set(left)].join(', ') || '（无）');
