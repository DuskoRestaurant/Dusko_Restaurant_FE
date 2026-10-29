import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import os from 'node:os';
import {reuse} from './menu-image-sources.mjs';
const sharp=createRequire(import.meta.url)('sharp');
const products=JSON.parse(await fs.readFile('docs/menu-images/products.json','utf8')).filter(p=>p.id!==94);
const selected=JSON.parse(await fs.readFile('docs/menu-images/selected.json','utf8'));
let generated={};try{generated=JSON.parse(await fs.readFile(path.join(os.tmpdir(),'dusko-menu-generated.json'),'utf8'));}catch{}
const cache=path.join(os.tmpdir(),'dusko-menu-source-images');await fs.mkdir(cache,{recursive:true});
const roots=['public','customer-web/public','staff-app/public'];
const manifest=[];
for(const p of products){
 let id=p.id;while(typeof reuse[id]==='number')id=reuse[id];
 let imagePath=typeof reuse[id]==='string'?reuse[id]:`/dishes/menu-${id}.webp`;
 const dest='public'+imagePath;
 if(!reuse[id]){
   let exists=false;try{await fs.access(dest);exists=true;}catch{}
   if(!exists||generated[id]){
     let bytes;
     if(generated[id])bytes=await fs.readFile(generated[id]);
     else if(selected[id]){
       const s=selected[id];if(!/^(CC BY|CC0|Public domain)/.test(s.license))throw Error(`Review license ${id}`);
       const cached=path.join(cache,`${id}.image`);
       try{bytes=await fs.readFile(cached);}catch{
         for(let retry=0;retry<4;retry++){
           if(retry)await new Promise(r=>setTimeout(r,10000));
           const response=await fetch(s.url,{signal:AbortSignal.timeout(30000)});
           if(!response.ok||!response.headers.get('content-type')?.startsWith('image/'))continue;
           bytes=Buffer.from(await response.arrayBuffer());await fs.writeFile(cached,bytes);break;
         }
       }
     }
     if(!bytes){console.log('Waiting for image',id);continue;}
     // Web delivery conversion only: preserve full framing, no cropping or retouching.
     await sharp(bytes).rotate().resize({width:720,height:720,fit:'inside',withoutEnlargement:true}).webp({quality:85}).toFile(dest);
   }
 }
 for(const root of roots.slice(1))await fs.copyFile(dest,root+imagePath);
 manifest.push({id:p.id,name:p.name,imageUrl:`https://order.dusko.io.vn${imagePath}`,kind:generated[id]?'AI illustration':selected[id]?'Wikimedia Commons':'Existing restaurant asset',...(!generated[id]&&selected[id]?{source:selected[id].source,artist:selected[id].artist,license:selected[id].license,licenseUrl:selected[id].licenseUrl}:{}),assetId:id});
 console.log('Ready',p.id,p.name);
}
await fs.writeFile('docs/menu-images/manifest.json',JSON.stringify(manifest,null,2));
const escape=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const plain=s=>String(s||'').replace(/<[^>]*>/g,'');
const credits=`<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Nguồn ảnh thực đơn Dusko</title><style>body{font:16px/1.6 system-ui;margin:40px auto;max-width:900px;padding:0 24px;color:#173747}li{margin:20px 0}a{color:#165c8c}</style><h1>Nguồn ảnh thực đơn</h1><p>Ảnh minh họa món ăn, cách trình bày thực tế có thể khác. Một số ảnh được tạo bằng AI. Ảnh từ Wikimedia Commons được chuyển sang WebP và thu nhỏ, giữ nguyên toàn bộ khung hình. Giấy phép gốc tiếp tục áp dụng cho từng ảnh.</p><ul>${manifest.map(r=>`<li><strong>${escape(r.name)}</strong> — ${r.kind==='AI illustration'?'Ảnh minh họa tạo bằng AI':r.source?`${escape(plain(r.artist))} · <a href="${escape(r.source)}">Ảnh gốc</a> · ${r.licenseUrl?`<a href="${escape(r.licenseUrl)}">${escape(r.license)}</a>`:escape(r.license)}`:'Ảnh hiện có của thực đơn'} · <a href="${escape(r.imageUrl)}">Ảnh sử dụng</a></li>`).join('')}</ul></html>`;
for(const root of roots)await fs.writeFile(`${root}/menu-image-credits.html`,credits);
console.log(JSON.stringify({ready:manifest.length,expected:products.length}));
