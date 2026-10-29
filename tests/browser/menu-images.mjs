import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createServer} from 'vite';
const {chromium}=createRequire(import.meta.url)('playwright');
const manifest=JSON.parse(await readFile('docs/menu-images/manifest.json','utf8'));
const server=await createServer({configFile:false,server:{host:'127.0.0.1',port:0}});await server.listen();
const browser=await chromium.launch({channel:'msedge',headless:true});
await mkdir('docs/ui/menu-images',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1200,height:1550}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/menu-image-test',r=>r.fulfill({contentType:'text/html',body:'<main id="root"></main>'}));
 await page.goto(server.resolvedUrls.local[0]+'menu-image-test');
 const products=manifest.map((r,i)=>({...r,imageUrl:new URL(r.imageUrl).pathname,sellingPrice:49000,canOrder:true,category:{name:i<12?'Món ăn':'Thức uống'},requiresPreparation:true}));
 await page.evaluate(async products=>{
   await import('/customer-web/src/customer-menu.css');
   document.body.style.cssText='margin:24px;--ink:#173747;--muted:#526d79;--line:#d8e1e5;--brand:#183c4c;--surface:#fff;font-family:system-ui';
   const {createCustomerMenu}=await import('/customer-web/src/customer-menu.js');
   window.menu=createCustomerMenu({root:document.querySelector('#root'),products,quantityOf:()=>0,changeQuantity:()=>{},sessionOpen:true,getLine:()=>({quantity:0}),addCombo:()=>window.added=true});
   menu.setCombos([{id:'95-96',items:products.slice(0,2),price:80000,originalTotal:98000,discountAmount:18000}]);
 },products);
 assert.equal(await page.locator('.guest-category-title').first().innerText(),'Combo');
 assert.equal(await page.locator('[data-category]').first().innerText(),'Combo');
 await page.locator('[data-menu-combo]').click();assert.equal(await page.evaluate(()=>window.added),true);
 for(const width of [1440,390]){
   await page.setViewportSize({width,height:950});await page.evaluate(()=>scrollTo(0,0));
   await page.screenshot({path:`docs/ui/menu-images/menu-${width}.png`});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 }
 // Inspect every unique asset without altering it; also prove local assets decode.
 await page.setViewportSize({width:1200,height:1550});
 const unique=[...new Map(products.map(r=>[r.imageUrl,r])).values()];
 for(let offset=0;offset<unique.length;offset+=20){
   await page.evaluate(rows=>{document.body.innerHTML='<div id="gallery" style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px"></div>';for(const r of rows){const card=document.createElement('article'),img=document.createElement('img'),p=document.createElement('p');img.src=r.imageUrl;img.style.cssText='width:100%;height:235px;object-fit:contain;background:#f5f5f5';p.textContent=`${r.id} — ${r.name}`;card.append(img,p);document.querySelector('#gallery').append(card);}},unique.slice(offset,offset+20));
   await page.waitForFunction(()=>[...document.images].every(i=>i.complete));
   assert.ok(await page.evaluate(()=>[...document.images].every(i=>i.naturalWidth>0)),'Broken image');
   await page.screenshot({path:`docs/ui/menu-images/contact-${offset/20+1}.png`,fullPage:true});
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({products:manifest.length,uniqueAssets:unique.length,comboFirst:true,viewports:[1440,390],errors}));
}finally{await browser.close();await server.close();}
