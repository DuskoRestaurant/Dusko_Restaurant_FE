// Browser regression with a mocked API: never creates a real payment.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {createServer} from 'vite';
const {chromium}=createRequire(import.meta.url)('playwright');
const server=await createServer({configFile:false,server:{host:'127.0.0.1',port:0}});
await server.listen();
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/payment-test',r=>r.fulfill({contentType:'text/html',body:'<main id="root"></main>'}));
 await page.goto(server.resolvedUrls.local[0]+'payment-test');
 await page.evaluate(async()=>{
   await import('/src/tokens.css');await import('/staff-app/src/style.css');await import('/src/readability.css');await import('/src/font.css');await import('/src/pos-theme.css');const {createServiceWorkspace}=await import('/src/service-workspace.js');
   const table={id:1,tableName:'Bàn 1',status:'OCCUPIED',checkoutReady:true,pendingOrderCount:1,seatingCapacity:4};
   window.fixture={session:{id:'session-1',status:'OPEN',orders:[{id:'order-1',orderCode:'HD-TEST',status:'PENDING',totalAmount:667000,discountAmount:0,finalAmount:667000,createdAt:new Date().toISOString(),items:[{id:1,productId:1,quantity:1,price:667000,kdsStatus:'DONE',servedAt:new Date().toISOString(),product:{name:'Món kiểm thử'}}]}]},posts:[],conflict:false};
   const request=async(path,options={})=>{
     if(options.method==='POST'){
       fixture.posts.push({path,body:options.body});
       if(path.endsWith('/promotion')){
         const code=options.body.code;
         if(code&&(code!=='GOOD'||fixture.rejectPromotion))throw Object.assign(Error('Mã khuyến mãi không áp dụng được'),{status:400});
         fixture.session.checkoutPromotion=code?{code,amount:66700}:null;
         fixture.session.orders[0].discountAmount=code?66700:0;
         fixture.session.orders[0].finalAmount=code?600300:667000;
         return {};
       }
       if(fixture.conflict)throw Object.assign(Error('Giao dịch trước cần đối soát. Không thu tiền lần hai.'),{status:409});
       if(path==='/api/payments/vnpay/tables/1')return {id:'test-payment',amount:667000,expiresAt:new Date(Date.now()+900000).toISOString(),paymentUrl:'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?test=1',qrDataUrl:'data:image/png;base64,iVBORw0KGgo='};
       throw Error('Unexpected checkout endpoint');
     }
     if(path.includes('/promotions?'))return fixture.noPromotions?[]:[{code:'GOOD',name:'Giảm mười phần trăm',discountAmount:66700}];
     if(path.includes('/session?'))return structuredClone({table,session:fixture.session,serviceRequests:[]});
     if(path==='/api/catalog/products')return [];
     if(path.includes('/tables'))return [table];
     if(path==='/api/payments/vnpay/test-payment')return {status:'PENDING'};
     throw Error('No live connection in test');
   };
   window.workspace=createServiceWorkspace({root:document.querySelector('#root'),request,branchId:1,role:'CASHIER',userId:1,initialData:{tables:[table],products:[]}});
 });
 await page.locator('[data-sw="table"]').click();
 const input=page.locator('[data-sw-input="promotion"]');
 await input.selectOption('GOOD');
 await page.locator('[data-sw="tab"][data-tab="ready"]').click();await page.locator('[data-tab="bill"]').click();
 assert.equal(await input.inputValue(),'GOOD');
 await page.locator('[data-sw=apply-promotion]').click();await page.locator('.sw-promotion-applied').waitFor();
 assert.match(await page.locator('.sw-bill-total').innerText(),/600.300/);
 assert.match(await page.locator('.sw-promotion-applied').innerText(),/66.700/);
 await page.evaluate(()=>fixture.rejectPromotion=true);await input.selectOption('GOOD');await page.locator('[data-sw="apply-promotion"]').click();await page.locator('.dusko-toast--error').waitFor();
 assert.match(await page.locator('.sw-bill-total').innerText(),/600.300/);
 await mkdir('docs/ui',{recursive:true});
 for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.locator('.sw-promotion').scrollIntoViewIfNeeded();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:'docs/ui/checkout-promotion-'+width+'.png'});}
 await page.locator('[data-sw="remove-promotion"]').click();await page.locator('.sw-promotion-applied').waitFor({state:'detached'});
 assert.match(await page.locator('.sw-bill-total').innerText(),/667.000/);
 await page.evaluate(()=>fixture.noPromotions=true);await page.locator('[data-sw=refresh]').click();await page.waitForFunction(()=>document.querySelector('[data-sw-input=promotion]').disabled);assert.equal(await input.locator('option').count(),1);
 const calls=await page.evaluate(()=>fixture.posts);assert.deepEqual(calls.map(p=>p.body.code),['GOOD','GOOD','']);assert.ok(calls.every(p=>p.body.sessionId==='session-1'&&p.body.branchId===1));
 assert.deepEqual(errors,[]);await page.evaluate(()=>workspace.destroy());
 console.log('PASS: promotion apply/remove/error/Enter, input survives rerender, totals and mobile layout');
} finally {await browser.close();await server.close();}
