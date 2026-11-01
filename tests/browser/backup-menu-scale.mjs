// Measure the real staff entry and menu cascade with mocked APIs only.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
const {chromium}=createRequire(import.meta.url)('playwright');
const server=await createServer({root:'staff-app',configFile:'staff-app/vite.config.js',server:{host:'127.0.0.1',port:0}});await server.listen();
const browser=await chromium.launch({channel:'msedge',headless:true});
const measurements=[];
try{
 for(const role of ['WAITER','CASHIER']){
  const context=await browser.newContext(),page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const user={id:21,role,roles:[role],branchId:1,fullName:'Sizing fixture'};
  const table={id:1,tableName:'Bàn đo kích thước',status:'SERVING',checkoutReady:true};
  await context.addInitScript(user=>sessionStorage.setItem('dusko-auth',JSON.stringify({token:'fixture-only',user})),user);
  await page.route('**/api/**',async route=>{
   const p=new URL(route.request().url()).pathname;
   let data;
   if(p==='/api/auth/profile')data=user;
   else if(p==='/api/catalog/branches/1/tables')data=[table];
   else if(p==='/api/catalog/products')data=[{id:1,name:'Món kiểm thử',sellingPrice:65000,isActive:true,canOrder:true,category:{name:'Món chính'}}];
   else if(p==='/api/staff/tables/1/session')data={table,session:{id:'fixture-session',orders:[]}};
   else return route.fulfill({status:503,json:{success:false,error:'Fixture: realtime unavailable'}});
   return route.fulfill({json:{success:true,data}});
  });
  await page.goto(server.resolvedUrls.local[0]);await page.locator(`[data-shell=${role==='WAITER'?'service':'cashier'}]`).click();
  await page.locator('[data-sw=table][data-id="1"]').click();await page.locator('[data-sw=tab][data-tab=menu]').click();await page.locator('.sw-product').waitFor();await page.evaluate(()=>document.fonts.ready);
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:1000});
   const measured=await page.evaluate(()=>{
    const css=selector=>{const element=document.querySelector(selector),s=getComputedStyle(element);return {fontSize:s.fontSize,lineHeight:s.lineHeight,minHeight:s.minHeight,height:element.getBoundingClientRect().height,padding:s.padding,borderRadius:s.borderRadius,gap:s.gap,fontWeight:s.fontWeight,fontFamily:s.fontFamily};};
    return {body:css('.service-workspace'),heading:css('#sw-menu'),button:css('.sw-menu-pagination .sw-button'),input:css('[data-sw-input=menu-search]'),select:css('[data-sw-input=category]'),tabs:css('.sw-tabs button'),panel:css('.sw-content'),product:css('.sw-product'),name:css('.sw-product strong'),meta:css('.sw-product small'),layout:css('.sw-menu-layout'),tokens:{control:getComputedStyle(document.documentElement).getPropertyValue('--radius-control').trim(),card:getComputedStyle(document.documentElement).getPropertyValue('--radius-card').trim()}};
   });
   assert.ok(measured.button.height>=44);assert.ok(measured.input.height>=44);measurements.push({role,width,...measured});
  }
  assert.deepEqual(errors,[]);await context.close();
 }
 for(const width of [1440,390]){
  const waiter=measurements.find(item=>item.role==='WAITER'&&item.width===width),cashier=measurements.find(item=>item.role==='CASHIER'&&item.width===width);
  for(const key of ['body','heading','button','input','select','tabs','panel','name','meta','tokens'])assert.deepEqual(waiter[key],cashier[key],`${key} shared across service/cashier`);
 }
 await mkdir('docs/ui',{recursive:true});await writeFile('docs/ui/backup-menu-sizing.json',JSON.stringify(measurements,null,2)+'\n');
 console.log(JSON.stringify(measurements));
}finally{await browser.close();await server.close();}
