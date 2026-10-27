// WCAG contrast tool for the Dusko token palette.
// Usage: node contrast.js          -> validate the candidate palette
//        node contrast.js "#RRGGBB" "#RRGGBB" ... -> check fg/bg pairs
const hex = h => { h = h.replace('#',''); if (h.length===3) h = h.split('').map(c=>c+c).join('');
  return [0,2,4].map(i => parseInt(h.slice(i,i+2),16)); };
const lum = rgb => { const s = rgb.map(v => { v/=255; return v<=0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055,2.4); });
  return 0.2126*s[0] + 0.7152*s[1] + 0.0722*s[2]; };
const ratio = (a,b) => { const L1=lum(hex(a)), L2=lum(hex(b));
  const [hi,lo] = L1>L2 ? [L1,L2] : [L2,L1]; return (hi+0.05)/(lo+0.05); };

if (process.argv.length > 2) {
  const args = process.argv.slice(2);
  for (let i=0;i<args.length;i+=2) {
    const r = ratio(args[i], args[i+1]);
    console.log(`${args[i]} on ${args[i+1]} = ${r.toFixed(2)}:1  ${r>=7?'AAA':r>=4.5?'AA':r>=3?'AA-large':'FAIL'}`);
  }
  process.exit(0);
}

// Read the real palette instead of maintaining a second copy of the colours.
const {readFileSync}=await import('node:fs');
const blocks=[...readFileSync(new URL('../src/tokens.css',import.meta.url),'utf8').matchAll(/:root\s*\{([^}]+)\}/g)];
const parse=block=>Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[a-fA-F0-9]{6})/g)].map(m=>[m[1],m[2]]));
const light=parse(blocks[0][1]),dark=parse(blocks[1][1]);
const aliases={surfaceSunken:'surface-sunken',surfaceRaised:'surface-raised',lineStrong:'line-strong',primaryDark:'primary-dark',primaryInk:'primary-ink',primarySoft:'primary-soft',accentSoft:'accent-soft',warningFill:'warning-soft',dangerSoft:'danger-soft',successSoft:'success-soft',hero1:'brand-1',hero2:'brand-2',onPrimary:'on-primary'};
const P={};
for(const key of ['canvas','surface','ink','muted','line','primary','accent','warning','danger','success',...Object.keys(aliases)]){P[key]=light[aliases[key]||key];P['d'+key[0].toUpperCase()+key.slice(1)]=dark[aliases[key]||key];}

const checks = [
  ['LIGHT body text',            P.muted,        P.canvas,       4.5],
  ['LIGHT body text on card',    P.muted,        P.surface,      4.5],
  ['LIGHT muted on sunken',      P.muted,        P.surfaceSunken,4.5],
  ['LIGHT muted on raised',      P.muted,        P.surfaceRaised,4.5],
  ['LIGHT heading',              P.ink,          P.canvas,       4.5],
  ['LIGHT heading on card',      P.ink,          P.surface,      4.5],
  ['LIGHT primary text/link',    P.primaryInk,   P.surface,      4.5],
  ['LIGHT primary text on canvas',P.primaryInk,  P.canvas,       4.5],
  ['LIGHT accent text',          P.accent,       P.surface,      4.5],
  ['LIGHT warning text',         P.warning,      P.surface,      4.5],
  ['LIGHT warning text on fill', P.warning,      P.warningFill,  4.5],
  ['LIGHT danger text',          P.danger,       P.surface,      4.5],
  ['LIGHT danger on dangerSoft', P.danger,       P.dangerSoft,   4.5],
  ['LIGHT success text',         P.success,      P.surface,      4.5],
  ['LIGHT success on successSoft',P.success,     P.successSoft,  4.5],
  ['LIGHT accent on accentSoft', P.accent,       P.accentSoft,   4.5],
  ['LIGHT primaryInk on primarySoft',P.primaryInk, P.primarySoft,  4.5],
  ['LIGHT text on primary fill', '#FFFFFF',      P.primary,      4.5],
  ['LIGHT text on primaryDark',  '#FFFFFF',      P.primaryDark,  4.5],
  ['LIGHT hero text on hero1',   '#FFFFFF',      P.hero1,        4.5],
  ['LIGHT hero text on hero2',   '#FFFFFF',      P.hero2,        4.5],
  ['DARK  body text',            P.dMuted,       P.dCanvas,      4.5],
  ['DARK  body text on card',    P.dMuted,       P.dSurface,     4.5],
  ['DARK  heading',              P.dInk,         P.dCanvas,      4.5],
  ['DARK  heading on card',      P.dInk,         P.dSurface,     4.5],
  ['DARK  primary text/link',    P.dPrimaryInk,  P.dSurface,     4.5],
  ['DARK  accent text',          P.dAccent,      P.dSurface,     4.5],
  ['DARK  warning text',         P.dWarning,     P.dSurface,     4.5],
  ['DARK  danger text',          P.dDanger,      P.dSurface,     4.5],
  ['DARK  success text',         P.dSuccess,     P.dSurface,     4.5],
  ['DARK  accent on accentSoft', P.dAccent,      P.dAccentSoft,  4.5],
  ['DARK  warning on warnFill',  P.dWarning,     P.dWarningFill, 4.5],
  ['DARK  danger on dangerSoft', P.dDanger,      P.dDangerSoft,  4.5],
  ['DARK  success on successSoft',P.dSuccess,    P.dSuccessSoft, 4.5],
  ['DARK  primary on primarySoft',P.dPrimary,    P.dPrimarySoft, 4.5],
  ['DARK  text on primary fill', P.dOnPrimary,   P.dPrimary,     4.5],
  ['DARK  primaryInk on primarySoft',P.dPrimaryInk,P.dPrimarySoft,4.5],
];

console.log('label'.padEnd(32),'fg'.padEnd(9),'bg'.padEnd(9),'ratio'.padStart(7),'  result');
console.log('-'.repeat(76));
let fails=0;
for (const [label,fg,bg] of checks) {
  const r=ratio(fg,bg); const ok=r>=4.5;
  if(!ok) fails++;
  console.log(label.padEnd(32), fg.padEnd(9), bg.padEnd(9), r.toFixed(2).padStart(7), ` ${ok?'PASS':'** FAIL **'}`);
}
console.log('-'.repeat(76));
console.log(`${fails} failing pair(s) of ${checks.length}`);

// Non-text UI boundary check (WCAG 1.4.11 -> 3:1)
const ui = [['LIGHT border on surface', P.lineStrong, P.surface],['DARK border on surface', P.dLineStrong, P.dSurface]];
console.log('\nnon-text (3:1):');
for (const [l,fg,bg] of ui){ const r=ratio(fg,bg); console.log(' ', l.padEnd(30), r.toFixed(2), r>=3?'PASS':'** FAIL **'); }
if(fails)process.exitCode=1;
