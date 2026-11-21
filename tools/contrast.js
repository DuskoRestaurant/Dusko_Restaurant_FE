// Validate the actual shared palette, including aliases. No second color table.
import {readFileSync} from 'node:fs';
const source = readFileSync(new URL('../src/tokens.css',import.meta.url),'utf8');
const tokens = Object.fromEntries([...source.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(m=>[m[1],m[2].trim()]));
const resolve = name => tokens[name]?.startsWith('var(') ? resolve(tokens[name].match(/--([\w-]+)/)[1]) : tokens[name];
const rgb = value => {
  const hex=value.replace('#','');
  const normalized=hex.length===3?hex.split('').map(c=>c+c).join(''):hex;
  return [0,2,4].map(i=>parseInt(normalized.slice(i,i+2),16)/255);
};
const luminance = color => rgb(color).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
const ratio=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
if(process.argv.length>2) {
  const colors=process.argv.slice(2);
  if(colors.length%2)throw Error('Provide foreground/background pairs.');
  for(let i=0;i<colors.length;i+=2){const contrast=ratio(colors[i],colors[i+1]);console.log(colors[i],colors[i+1],contrast.toFixed(2));if(contrast<4.5)process.exitCode=1}
} else {
  const checks=[];
  for(const background of ['canvas','surface','surface-sunken','primary-soft'])for(const foreground of ['ink','muted','primary-ink'])checks.push([foreground,background,4.5]);
  for(const tone of ['primary','primary-dark','success','danger','danger-hover'])checks.push(['on-primary',tone,4.5]);
  for(const tone of ['success','warning','danger'])checks.push([tone,tone+'-soft',4.5]);
  checks.push(['inverse-ink','inverse-surface',4.5],['inverse-muted','inverse-surface',4.5]);
  for(const surface of ['canvas','surface','surface-sunken'])checks.push(['line-strong',surface,3],['focus-ring',surface,3]);
  let failures=0;
  for(const [fg,bg,minimum] of checks){const contrast=ratio(resolve(fg),resolve(bg));const pass=contrast>=minimum;failures+=!pass;console.log(`${pass?'PASS':'FAIL'} ${fg} on ${bg}: ${contrast.toFixed(2)}:1 (required ${minimum}:1)`)}
  console.log(`${checks.length} pairs, ${failures} failures`);
  if(failures)process.exitCode=1;
}
