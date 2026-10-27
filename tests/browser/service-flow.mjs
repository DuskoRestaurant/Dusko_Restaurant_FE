// Requires scripts/stability-fixture.ts from the backend, local databases, Playwright and Edge.
import assert from 'node:assert/strict';
import {assertSurfaceContrast} from './theme-contrast.mjs';
import {createRequire} from 'node:module';
import {readFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createServer} from 'vite';
const {chromium}=createRequire(import.meta.url)('playwright');
const fixture=JSON.parse(await readFile(process.env.DUSKO_TEST_FIXTURE,'utf8'));
assert.equal(new URL(fixture.api).hostname,'127.0.0.1');
const servers=[];const errors=[];const contexts=[];let checks=0;
const output=path.join(tmpdir(),'dusko-stability-qa');await mkdir(output,{recursive:true});
const serve=async(root,configFile)=>{const server=await createServer({root,configFile,server:{host:'127.0.0.1',port:0,proxy:{'/api':{target:fixture.api,ws:true}}}});await server.listen();servers.push(server);return server.resolvedUrls.local[0];};
const staffUrl=await serve('staff-app','staff-app/vite.config.js'),customerUrl=await serve('customer-web','customer-web/vite.config.js'),managementUrl=await serve('.','vite.config.js');
const browser=await chromium.launch({channel:'msedge',headless:true});
const api=async(route,role='WAITER',method='GET',body)=>{const response=await fetch(fixture.api+'/api'+route,{method,headers:{'Content-Type':'application/json',Authorization:`Bearer ${fixture.users[role].token}`},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,...await response.json()};};
async function openRole(role){const context=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'});contexts.push(context);await context.addInitScript(auth=>{sessionStorage.setItem('dusko-auth',JSON.stringify(auth));window.print=()=>window.__printed=true;},fixture.users[role]);const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto(staffUrl);return page;}
try{
 const waiter=await openRole('WAITER');await waiter.locator('.sw-tables').waitFor();assert.equal(await waiter.locator('[data-view="receipts"]').count(),0);checks++;
 await waiter.locator(`[data-sw="table"][data-id="${fixture.tableId}"]`).click();await waiter.locator('[data-sw="open"]').click();await waiter.locator('[data-sw="verify-customer"]').waitFor();
 const session=(await api(`/staff/tables/${fixture.tableId}/session?branchId=${fixture.branchId}`)).data.session;
 await waiter.locator('[data-sw="verify-customer"]').click();await waiter.locator('.sw-customer-dialog [name=phone]').fill(fixture.customerPhone);await waiter.locator('.sw-customer-dialog [type=checkbox]').check();
 const verified=waiter.waitForResponse(r=>r.url().includes('/customer/verify-by-phone'));
 await waiter.locator('.sw-customer-dialog [type=submit]').click();assert.equal((await verified).status(),200);await waiter.locator('.sw-customer-dialog').waitFor({state:'detached'});await waiter.locator('[data-sw-customer]').getByText('Khách: Khách kiểm thử').waitFor();checks++;
 const guestContext=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});contexts.push(guestContext);const guest=await guestContext.newPage();guest.on('pageerror',err=>errors.push(err.message));await guest.goto(customerUrl+'t/'+fixture.qrToken);await guest.locator(`[data-plus="${fixture.productId}"]`).waitFor();
 assert.equal(await guest.locator('.customer-recognition').getAttribute('open'),null);checks++;
 await guest.locator(`[data-plus="${fixture.productId}"]`).click();await guest.waitForFunction(()=>!document.querySelector('#submit')?.disabled);await guest.locator('#submit').click();await guest.locator('[data-confirm=accept]').click();await guest.getByText('Chờ nhân viên tới bàn xác nhận. Món chưa chuyển vào bếp.',{exact:true}).waitFor();checks++;
 await waiter.locator('[data-sw="tab"][data-tab="confirm"]').click();await waiter.locator('[data-sw="confirm"]').waitFor();await waiter.locator('[data-sw="confirm"]').click();
 const chef=await openRole('CHEF');await chef.locator('.kw-ticket').filter({hasText:'Cơm chiên Dusko'}).waitFor();assert.match(await chef.locator('.kw-ticket').innerText(),new RegExp(fixture.tableName));checks++;
 let ticket=chef.locator('.kw-ticket').filter({hasText:'Cơm chiên Dusko'});await ticket.locator('[data-next="COOKING"]').click();await chef.locator('[data-kw-filter="COOKING"]').click();await ticket.locator('[data-next="COMPLETED"]').waitFor();await ticket.locator('[data-next="COMPLETED"]').click();await chef.locator('[data-kw-filter="COMPLETED"]').click();await chef.getByText('Các mẻ hoàn thành trong lần mở màn hình này (tối đa 30 mẻ).').waitFor();checks++;
 await waiter.locator('[data-sw="tab"][data-tab="ready"]').click();await waiter.locator('[data-sw="serve"]').waitFor();await waiter.locator('[data-sw="serve"]').click();await waiter.locator('[data-sw="serve"]').waitFor({state:'detached'});checks++;
 assert.equal((await api(`/staff/tables/${fixture.tableId}/checkout`,'WAITER','POST',{branchId:fixture.branchId,paymentMethod:'CASH'})).status,403);
 assert.equal((await api(`/receipts/history?branchId=${fixture.branchId}`,'WAITER')).status,403);checks++;
 const cashier=await openRole('CASHIER');await cashier.locator(`[data-sw="table"][data-id="${fixture.tableId}"]`).waitFor();assert.equal(await cashier.locator('[data-sw-input="table-filter"]').inputValue(),'PAY');checks++;
 await cashier.locator(`[data-sw="table"][data-id="${fixture.tableId}"]`).click();await cashier.locator('[data-sw="checkout"]').click();await cashier.locator('[data-confirm=accept]').click();await cashier.locator('.receipt-paper').waitFor();assert.match(await cashier.locator('.receipt-paper').innerText(),/65.000/);assert.match(await cashier.locator('.receipt-paper').innerText(),/Thu ngân kiểm thử/);checks++;
 await cashier.locator('[data-print]').click();await cashier.waitForFunction(()=>[...document.querySelectorAll('iframe')].some(f=>f.contentWindow.__printed));await cashier.locator('[data-close]').click();checks++;
 await cashier.locator('[data-view="receipts"]').click();await cashier.locator('.rm-row').waitFor();await cashier.locator('.rm-row').click();await cashier.locator('.receipt-paper').waitFor();await cashier.locator('[data-close]').click();checks++;
 await waiter.locator('[data-sw="refresh"]').click();await waiter.locator('[data-sw="open"]').waitFor();await waiter.locator('[data-sw="open"]').click();await waiter.locator('[data-sw="verify-customer"]').waitFor();
 const fresh=(await api(`/staff/tables/${fixture.tableId}/session?branchId=${fixture.branchId}`)).data.session;assert.notEqual(fresh.id,session.id);assert.equal(fresh.verifiedCustomerId,null);assert.equal(fresh.orders.length,0);checks++;
 const stale=await api(`/staff/tables/${fixture.tableId}/customer/verify-by-phone`,'WAITER','POST',{branchId:fixture.branchId,phone:fixture.customerPhone,sessionId:session.id});assert.equal(stale.status,409);assert.equal(stale.code,'SESSION_CHANGED');checks++;
 const staleClear=await api(`/staff/tables/${fixture.tableId}/customer/clear`,'WAITER','POST',{branchId:fixture.branchId,sessionId:session.id});assert.equal(staleClear.status,409);checks++;
 const wrongBranch=await api(`/receipts/history?branchId=${fixture.branchId+999}`,'CASHIER');assert.equal(wrongBranch.status,403);checks++;
 // Real loss of network: retain kitchen tickets and expose retry; recover after reconnect.
 await chef.context().setOffline(true);await chef.locator('[data-kw-refresh]').click();await chef.getByText(/Dữ liệu cũ vẫn được giữ lại/).waitFor();assert.equal(await chef.locator('.kw-ticket').count(),1);await chef.context().setOffline(false);await chef.locator('[data-kw-refresh]').click();await chef.waitForFunction(()=>document.querySelector('[data-kw-error]')?.hidden);checks++;
 const managerContext=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});contexts.push(managerContext);await managerContext.addInitScript(auth=>{sessionStorage.setItem('dusko_token',auth.token);sessionStorage.setItem('dusko_user',JSON.stringify(auth.user));localStorage.setItem('dusko_branch',String(auth.user.branchId));},fixture.users.MANAGER);
 const manager=await managerContext.newPage();manager.on('pageerror',error=>errors.push(error.message));await manager.goto(managementUrl);await manager.locator('.nav-group').first().waitFor();await manager.locator('.nav-group').filter({hasText:'Vận hành'}).locator('summary').click();await manager.locator('[data-page="receipts"]').click();await manager.locator('.rm-row').waitFor();checks++;
 for(const [name,page] of [['service',waiter],['cashier',cashier],['kitchen',chef],['customer',guest],['management',manager]]){
  for(const colorScheme of ['light','dark']){await page.emulateMedia({colorScheme});for(const width of [390,1440]){await page.setViewportSize({width,height:1000});await page.evaluate(()=>scrollTo(0,0));await page.locator('.dusko-toast__close').evaluateAll(buttons=>buttons.forEach(button=>button.click()));await page.screenshot({path:path.join(output,`${name}-${colorScheme}-${width}.png`),fullPage:true,animations:'disabled'});await assertSurfaceContrast(page,['.staff-app-header small','.customer-app-header p','.customer-app-header .brand span','.sw-product strong','.sw-product span','.sw-product small','.sw-filters select','.sw-cart h3','.pos-cart-jump','.hero h1','.hero strong','.customer-menu h2','.dish-body strong','.dish-body small','.dish-body>b','.photo','.cart h2','.cart h2 span','.cart p','.cart .total','.service-actions button','.rm-heading h2','.kw-ticket h3']);const sizes=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth}));assert.ok(sizes.scroll<=sizes.width+1,`${name}/${colorScheme}/${width} overflow: ${JSON.stringify(sizes)}`);checks++;}}
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({checks,output}));
}catch(error){for(let i=0;i<contexts.length;i++){const page=contexts[i].pages()[0];if(page)await page.screenshot({path:path.join(output,`failure-${i}.png`),fullPage:true}).catch(()=>{});}throw error;}
finally{await browser.close();for(const server of servers)await server.close();}
