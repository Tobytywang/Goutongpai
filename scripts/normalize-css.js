// 一次性归一化：字号→整数档 token、字重→400/500/600/700、奇数间距→档位 token
const fs = require('fs');
const file = 'public/css/style.css';
const src = fs.readFileSync(file, 'utf8');
fs.writeFileSync(file + '.bak', src); // 备份，便于回滚

const map = {
  // 字号
  'font-size: 9px;': 'font-size: var(--fs-micro);',
  'font-size: 10px;': 'font-size: var(--fs-micro);',
  'font-size: 11px;': 'font-size: var(--fs-micro);',
  'font-size: 11.5px;': 'font-size: var(--fs-micro);',
  'font-size: 12px;': 'font-size: var(--fs-xs);',
  'font-size: 12.5px;': 'font-size: var(--fs-xs);',
  'font-size: 13px;': 'font-size: var(--fs-sm);',
  'font-size: 13.5px;': 'font-size: var(--fs-sm);',
  'font-size: 14px;': 'font-size: var(--fs-base);',
  'font-size: 14.5px;': 'font-size: var(--fs-base);',
  'font-size: 15px;': 'font-size: var(--fs-md);',
  'font-size: 15.5px;': 'font-size: var(--fs-md);',
  'font-size: 16px;': 'font-size: var(--fs-lg);',
  'font-size: 17px;': 'font-size: var(--fs-lg);',
  'font-size: 18px;': 'font-size: var(--fs-xl);',
  'font-size: 20px;': 'font-size: var(--fs-xl);',
  'font-size: 21px;': 'font-size: var(--fs-xl);',
  'font-size: 22px;': 'font-size: var(--fs-xl);',
  'font-size: 26px;': 'font-size: var(--fs-2xl);',
  'font-size: 30px;': 'font-size: var(--fs-2xl);',
  // 字重
  'font-weight: 520;': 'font-weight: 500;',
  'font-weight: 550;': 'font-weight: 500;',
  'font-weight: 560;': 'font-weight: 600;',
  'font-weight: 620;': 'font-weight: 600;',
  'font-weight: 640;': 'font-weight: 600;',
  'font-weight: 650;': 'font-weight: 600;',
  'font-weight: 660;': 'font-weight: 700;',
  'font-weight: 680;': 'font-weight: 700;',
  // 奇数 / 离群间距
  'gap: 7px;': 'gap: var(--sp-2);',
  'gap: 9px;': 'gap: var(--sp-2);',
  'margin-top: 9px;': 'margin-top: var(--sp-2);',
  'gap: 18px;': 'gap: var(--sp-4);',
};

let out = src;
const counts = {};
for (const [from, to] of Object.entries(map)) {
  const n = out.split(from).length - 1;
  if (n) counts[from] = n;
  out = out.split(from).join(to);
}
fs.writeFileSync(file, out);
console.log('替换统计：');
console.log(JSON.stringify(counts, null, 2));
console.log('剩余未规范化的 font-size：');
const left = [...out.matchAll(/font-size:\s*([\d.]+)px;/g)].map((m) => m[1]);
console.log([...new Set(left)].sort((a, b) => parseFloat(a) - parseFloat(b)).join(', '));
console.log('剩余未规范化的 font-weight：');
const lw = [...out.matchAll(/font-weight:\s*(\d+);/g)].map((m) => m[1]);
console.log([...new Set(lw)].sort((a, b) => a - b).join(', '));
