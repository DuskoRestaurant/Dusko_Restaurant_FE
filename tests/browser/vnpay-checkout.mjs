// Browser regression with a mocked API: never creates a real payment.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {createServer} from 'vite';
const {chromium}=createRequire(import.meta.url)('playwright');
const baseline=process.env.TEST_BASELINE;
const server=await createServer({configFile:false,plugins:baseline?[{name:'baseline',enforce:'pre',load(id){if(id.endsWith('/src/service-workspace.js'))return execFileSync('git',['show',`${baseline}:src/service-workspace.js`],{encoding:'utf8'});}}]:[],server:{host:'127.0.0.1',port:0}});
await server.listen();
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/payment-test',r=>r.fulfill({contentType:'text/html',body:'<main id="root"></main>'}));
 await page.goto(server.resolvedUrls.local[0]+'payment-test');
 await page.evaluate(async()=>{
   const {createServiceWorkspace}=await import('/src/service-workspace.js');
   const table={id:1,tableName:'Bàn 1',status:'OCCUPIED',checkoutReady:true,pendingOrderCount:1,seatingCapacity:4};
   window.fixture={session:{id:'session-1',status:'OPEN',orders:[{id:'order-1',orderCode:'HD-TEST',status:'PENDING',finalAmount:667000,createdAt:new Date().toISOString(),items:[{id:1,productId:1,quantity:1,price:667000,kdsStatus:'DONE',servedAt:new Date().toISOString(),product:{name:'Món kiểm thử'}}]}]},posts:[],conflict:false};
   const request=async(path,options={})=>{
     if(options.method==='POST'){
       fixture.posts.push({path,body:options.body});
       if(fixture.conflict)throw Object.assign(Error('Giao dịch trước cần đối soát. Không thu tiền lần hai.'),{status:409});
       if(path==='/api/payments/vnpay/tables/1')return {id:'test-payment',amount:667000,expiresAt:new Date(Date.now()+900000).toISOString(),paymentUrl:'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?test=1',qrDataUrl:'data:image/png;base64,iVBORw0KGgo='};
       throw Error('Unexpected checkout endpoint');
     }
     if(path.includes('/session?'))return structuredClone({table,session:fixture.session,serviceRequests:[]});
     if(path==='/api/catalog/products')return [];
     if(path.includes('/tables'))return [table];
     if(path==='/api/payments/vnpay/test-payment')return {status:'PENDING'};
     throw Error('No live connection in test');
   };
   window.workspace=createServiceWorkspace({root:document.querySelector('#root'),request,branchId:1,role:'CASHIER',userId:1,initialData:{tables:[table],products:[]}});
 });
 await page.locator('[data-sw="table"]').click();
 const method=page.locator('[data-sw-input="payment"]');
 await method.selectOption('QR_BANKING');
 // A full render caused by switching tabs used to silently reset to CASH.
 await page.locator('[data-tab="ready"]').click();
 await page.locator('[data-tab="bill"]').click();
 assert.equal(await method.inputValue(),'QR_BANKING');
 assert.equal(await method.locator('option:checked').innerText(),'VNPay');
 // Background refresh changes the bill snapshot and patches the panel.
 await page.evaluate(()=>fixture.session.orders[0].orderCode='HD-UPDATED');
 await page.locator('[data-sw="refresh"]').click();
 await page.waitForFunction(()=>document.querySelector('#root').getAttribute('aria-busy')==='false');
 assert.equal(await method.inputValue(),'QR_BANKING');
 await page.locator('[data-sw="checkout"]').click();
 await page.locator('.vnpay-payment').waitFor();
 assert.deepEqual(await page.evaluate(()=>fixture.posts),[{path:'/api/payments/vnpay/tables/1',body:{branchId:1}}]);
 await page.locator('.vnpay-close').click();
 // A business conflict remains visible near the viewport and never falls back to cash.
 await page.evaluate(()=>fixture.conflict=true);
 await page.locator('[data-sw="checkout"]').click();
 await page.locator('.dusko-toast--error').waitFor();
 assert.match(await page.locator('.dusko-toast--error').innerText(),/đối soát/);
 assert.equal(await method.inputValue(),'QR_BANKING');
 assert.ok((await page.evaluate(()=>fixture.posts)).every(p=>p.path==='/api/payments/vnpay/tables/1'));
 // A new dining session must not inherit the previous customer's selection.
 await page.evaluate(()=>fixture.session.id='session-2');
 await page.locator('[data-sw="refresh"]').click();
 await page.waitForFunction(()=>document.querySelector('[data-sw-input="payment"]').value==='CASH');
 assert.deepEqual(errors,[]);
 await page.evaluate(()=>workspace.destroy());
 console.log('PASS: selection survives tabs/refresh, VNPay route only, 409 visible, new session resets');
} finally {await browser.close();await server.close();}
