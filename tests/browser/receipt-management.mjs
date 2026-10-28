// Run: node tests/browser/receipt-management.mjs (requires Playwright + Edge).
// NODE_PATH may point to an existing Playwright installation.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'vite';
import {mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
const {chromium}=createRequire(import.meta.url)('playwright');
const server=await createServer({root:'staff-app',configFile:'staff-app/vite.config.js',server:{host:'127.0.0.1',port:0}});
await server.listen();
const url=server.resolvedUrls.local[0];
const management=await createServer({configFile:'vite.config.js',server:{host:'127.0.0.1',port:0}});await management.listen();
const browser=await chromium.launch({channel:'msedge',headless:true});
const output=path.join(tmpdir(),'dusko-receipt-qa');await mkdir(output,{recursive:true});
const receipt={id:'receipt-1',snapshot:{code:'HD-20261025-F1AEA47A',restaurantName:'DUSKO RESTAURANT',address:'120 Nguyễn Văn Bảo, Gò Vấp',tableName:'Bàn 2',issuedAt:'2026-10-25T07:14:00Z',openedAt:'2026-10-24T09:38:00Z',paidAt:'2026-10-25T07:14:00Z',staffName:'Thu ngân ca sáng',paymentMethods:['CASH'],subtotal:231000,discount:0,total:231000,items:Array.from({length:9},(_,i)=>({name:['Bia Saigon','Bia Tiger','Bia Heineken'][i%3],quantity:1,price:[22000,25000,30000][i%3],total:[22000,25000,30000][i%3]}))}};
let checks=0;
try {
 for(const role of ['CASHIER','WAITER']) {
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
  await context.addInitScript(role=>{sessionStorage.setItem('dusko-auth',JSON.stringify({token:'test',user:{id:1,role,roles:[role],fullName:'Nhân viên kiểm thử',branchId:1}}));window.print=()=>{window.__printed=true;};},role);
  let fail=false, delayed=false, release;
  await context.route('**/api/**',async route=>{
   const u=new URL(route.request().url());let data;
   if(u.pathname.endsWith('/auth/profile'))data={roles:[role]};
   else if(u.pathname.endsWith('/tables'))data=[{id:2,tableName:'Bàn 2',status:'EMPTY',seatingCapacity:4}];
   else if(u.pathname.endsWith('/products'))data=[];
   else if(u.pathname.endsWith('/receipts/history')){
    if(delayed)await new Promise(resolve=>{release=resolve;});
    if(fail){await route.fulfill({status:500,json:{error:'Lỗi kiểm thử'}});return;}
    const p=Number(u.searchParams.get('page'));const q=u.searchParams.get('q');
    data={items:q==='none'?[]:[{...receipt,id:String(p),snapshot:{...receipt.snapshot,code:p===2?'HD-PAGE-2':receipt.snapshot.code}}],total:q==='none'?0:21,page:p,pageSize:20};
   }else {await route.fulfill({status:503,json:{error:'Live disabled in test'}});return;}
   await route.fulfill({json:{success:true,data}});
  });
  const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(url);await page.locator(`[data-shell="${role==='WAITER'?'service':'cashier'}"]`).click();await page.locator('.sw-tables').waitFor();
  if(role==='WAITER'){assert.equal(await page.locator('[data-view="receipts"]').count(),0);checks++;await context.close();continue;}
  await page.locator('[data-sw-input="table-search"]').fill('Bàn');
  await page.locator('[data-view="receipts"]').click();await page.locator('.rm-row').waitFor();
  assert.equal(await page.locator('.sw-tables').isVisible(),false);checks++;
  await page.locator('[data-rm-next]').click();await page.getByText('HD-PAGE-2',{exact:true}).waitFor();checks++;
  await page.locator('[data-rm-prev]').click();await page.getByText(receipt.snapshot.code,{exact:true}).waitFor();
  await page.locator('[name=q]').fill('none');await page.getByRole('button',{name:'Tìm kiếm',exact:true}).click();await page.getByRole('heading',{name:'Không có hóa đơn',exact:true}).waitFor();checks++;
  await page.locator('[data-rm-reset]').click();await page.locator('.rm-row').waitFor();
  await page.locator('[name=from]').fill('2026-10-26');await page.locator('[name=to]').fill('2026-10-25');await page.getByRole('button',{name:'Tìm kiếm',exact:true}).click();assert.match(await page.locator('[data-rm-status]').innerText(),/Ngày bắt đầu/);checks++;
  await page.locator('[data-rm-reset]').click();await page.locator('.rm-row').waitFor();
  fail=true;await page.locator('[data-rm-refresh]').click();await page.getByText(/Không tải được hóa đơn/).waitFor();fail=false;await page.locator('[data-rm-refresh]').click();await page.locator('.rm-row').waitFor();checks++;
  for(const width of [320,390,768,1440]){
   await page.setViewportSize({width,height:900});await page.locator('.rm-row').click();await page.locator('.receipt-paper').waitFor();
   const layout=await page.locator('.receipt-dialog').evaluate(dialog=>{const paper=dialog.querySelector('.receipt-preview').shadowRoot.querySelector('.receipt-paper'),header=paper.querySelector('header');return {scroll:dialog.scrollWidth,width:dialog.clientWidth,paperScroll:paper.scrollWidth,paperWidth:paper.clientWidth,headerPosition:getComputedStyle(header).position,headerBackground:getComputedStyle(header).backgroundColor,headerRight:header.getBoundingClientRect().right,dialogRight:dialog.getBoundingClientRect().right};});
   assert.ok(layout.scroll<=layout.width+1,JSON.stringify(layout));assert.ok(layout.paperScroll<=layout.paperWidth+1,JSON.stringify(layout));assert.equal(layout.headerPosition,'static');assert.notEqual(layout.headerBackground,'rgb(17, 17, 17)');assert.ok(layout.headerRight<=layout.dialogRight);checks++;
   await page.screenshot({path:path.join(output,`receipt-${width}.png`)});
   if(width===390){await page.locator('[data-print]').click();await page.waitForFunction(()=>[...document.querySelectorAll('iframe')].some(f=>f.contentWindow.__printed));const printed=await page.locator('iframe').evaluate(frame=>frame.contentDocument.body.innerText);assert.match(printed,/231.000/);assert.match(printed,/DUSKO RESTAURANT/);checks++;}
   await page.locator('[data-close]').click();await page.locator('.receipt-dialog').waitFor({state:'detached'});
  }
  await page.screenshot({path:path.join(output,'invoices-desktop.png')});
  delayed=true;await page.locator('[data-rm-refresh]').click();await page.getByText('Đang tải hóa đơn…',{exact:true}).waitFor();
  await page.locator('[data-view="service"]').click();await page.locator('.sw-tables').waitFor();release?.();await page.waitForTimeout(100);assert.equal(await page.locator('.rm-manager').count(),0);assert.equal(await page.locator('[data-sw-input="table-search"]').inputValue(),'Bàn');checks++;
  assert.deepEqual(errors,[]);await context.close();
 }
 for(const role of ['ADMIN','MANAGER']){
  const context=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'});
  const user={id:1,role,fullName:'Quản lý kiểm thử',branchId:1};
  await context.addInitScript(user=>{sessionStorage.setItem('dusko_token','test');sessionStorage.setItem('dusko_user',JSON.stringify(user));},user);
  const branches=[];
  await context.route('**/api/**',async route=>{
   const u=new URL(route.request().url());let data;
   if(u.pathname==='/api/bootstrap')data={user,branches:[{id:1,name:'Chi nhánh 1'},{id:2,name:'Chi nhánh 2'}],branchId:1,page:'receipts',resources:{}};
   else if(u.pathname==='/api/receipts/history'){branches.push(u.searchParams.get('branchId'));data={items:[receipt],total:1,page:1,pageSize:20};}
   else{await route.fulfill({status:503,json:{error:'Disabled'}});return;}
   await route.fulfill({json:{success:true,data}});
  });
  const page=await context.newPage();await page.goto(management.resolvedUrls.local[0]);await page.locator('.rm-row').waitFor();
  assert.equal(await page.locator('[data-page="receipts"]').count(),1);
  await page.locator('.rm-row').click();await page.locator('.receipt-paper').waitFor();
  assert.equal(await page.locator('.receipt-paper header').evaluate(el=>getComputedStyle(el).position),'static');await page.locator('[data-close]').click();checks++;
  if(role==='ADMIN'){await page.locator('#branch').selectOption('2');await page.getByText(/Chi nhánh 2/).last().waitFor();await page.locator('.rm-row').waitFor();assert.equal(branches.at(-1),'2');checks++;}
  await context.close();
 }
 console.log(JSON.stringify({checks,output}));
}finally{await browser.close();await server.close();await management.close();}
