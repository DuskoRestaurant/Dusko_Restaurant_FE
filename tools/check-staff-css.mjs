// Verify whether staff-app/src/style.css's legacy selectors are still produced.
import { readFileSync } from 'node:fs';
const base = 'D:/HK2_Nam4/DoAnTotNghiep/Dusko_Restaurant_FE/';
const markup = ['staff-app/src/main.js', 'src/service-workspace.js', 'src/app-entry.js', 'src/accounts.js']
  .map(f => readFileSync(base + f, 'utf8')).join('\n');

const legacy = ['tables', 'table', 'product', 'order', 'cartline', 'products', 'login', 'link', 'secondary'];
console.log('class            rendered in staff markup');
let live = 0;
for (const c of legacy) {
  const used = new RegExp(`class="[^"]*\\b${c}\\b`).test(markup);
  if (used) live++;
  console.log(`  .${c.padEnd(14)} ${used ? 'LIVE — keep' : 'unused'}`);
}
console.log(`\n${legacy.length - live} of ${legacy.length} legacy selectors appear unused.`);