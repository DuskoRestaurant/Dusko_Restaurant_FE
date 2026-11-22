import {createRequire} from 'node:module';
import {createServer} from 'vite';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
const out=path.resolve(process.env.DUSKO_UI_OUTPUT||'../output/service-layout');
let url;
const now=Date.now();
const user={id:1,role:'ADMIN',roles:['ADMIN'],fullName:'Quản trị kiểm thử',branchId:1};
const branches=Array.from({length:8},(_,i)=>({id:i+1,code:'CN'+(i+1),name:['Dusko Quận 1','Dusko Gò Vấp','Dusko Thủ Đức','Dusko Bình Thạnh','Dusko Quận 7','Dusko Tân Bình','Dusko Quận 3','Dusko Phú Nhuận'][i],address:'120 Nguyễn Văn Bảo, phường Hạnh Thông, TP. Hồ Chí Minh',phone:'0901234567'}));
const tables=Array.from({length:30},(_,i)=>({id:i+1,tableName:'Bàn '+String(i+1).padStart(2,'0'),seatingCapacity:4,status:['EMPTY','SERVING','RESERVED'][i%3],unconfirmedOrderCount:i===1?2:0}));
const qr=tables.map(t=>({...t,qrToken:{isActive:true,lastUsedAt:new Date(now-1800000).toISOString()}}));
const categories=['Món chính','Đồ uống','Món khai vị','Lẩu','Hải sản','Món chay','Tráng miệng','Combo'].map((name,i)=>({id:i+1,code:'NH'+i,name}));
const products=Array.from({length:54},(_,i)=>({id:i+1,code:'MON-'+String(i+1).padStart(3,'0'),name:(i%3===1?'Trà đào cam sả ':i%3===0?'Cơm chiên hải sản ':'Gỏi ngó sen tôm thịt ')+String(i+1).padStart(2,'0'),categoryId:i%3+1,category:{name:categories[i%3].name},sellingPrice:i%3===1?39000:129000,costPrice:25000,stationType:i%3===1?'BAR_STATION':'WOK_STATION',prepTimeMinutes:10,isActive:true,requiresPreparation:i%3!==1,canOrder:true,maxOrderQuantity:40,_count:{recipes:2}}));
const batch=(id,status,minutes,stationType='WOK_STATION')=>({id,batchCode:'BEP-'+id,status,scheduledTime:new Date(now-minutes*60000).toISOString(),stationType,totalQuantity:2,product:{...products[id%54],name:'Mẻ '+id+' · '+products[id%54].name},orderItems:[{id:id*10,quantity:2,note:id%3===0?'Không hành, ít cay':'',order:{orderCode:'HD-CN01-'+id,table:{tableName:'Bàn '+String(id).padStart(2,'0')}}}]});
const batches=[...Array.from({length:14},(_,i)=>batch(i+1,'SCHEDULED',i+2,i%2?'FRY_STATION':'WOK_STATION')),...Array.from({length:3},(_,i)=>batch(i+15,'COOKING',i+20,'FRY_STATION')),batch(18,'SCHEDULED',65),batch(19,'SCHEDULED',95)];
const receipt={id:'receipt-1',snapshot:{code:'HD-20261121-CN01-001',restaurantName:'DUSKO RESTAURANT',address:branches[0].address,tableName:'Bàn 02',issuedAt:new Date(now-3600000).toISOString(),openedAt:new Date(now-7200000).toISOString(),paidAt:new Date(now-3600000).toISOString(),staffName:'Thu ngân ca sáng',paymentMethods:['CASH'],subtotal:645000,discount:0,total:645000,items:Array.from({length:5},()=>({name:'Cơm chiên hải sản',quantity:1,price:129000,total:129000}))}};
const reports={mode:'local frontend with isolated API fixtures',baseUrl:url,createdAt:new Date().toISOString(),fixture:{branches:8,tables:30,categories:8,products:54,batches:19,receipts:42},screens:[],checks:{},apiErrors:[],pageErrors:[],mutations:[]};
const cors=r=>({'access-control-allow-origin':r.request().headers().origin||'*','access-control-allow-headers':'authorization,content-type','access-control-allow-methods':'GET,POST,PATCH,PUT,DELETE,OPTIONS'});
const ok=(r,data)=>r.fulfill({headers:cors(r),json:{success:true,data}});
const error=(r,status,message)=>r.fulfill({status,headers:cors(r),json:{success:false,error:message,message}});
let browser;
const counterOrders=['PENDING','PAID'].map((status,i)=>({id:'fixture-order-'+i,orderCode:'HD-MANGDI-00'+i,createdAt:new Date().toISOString(),finalAmount:129000,status,items:[{quantity:1,product:products[0]}]}));
let currentTables=tables;
async function contextFor(module){
 const context=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:'block'});
 await context.addInitScript(user=>{sessionStorage.setItem('dusko_token','fixture-audit');sessionStorage.setItem('dusko_user',JSON.stringify(user));},user);
 const state={module,failKitchen:false,historyRequests:[]};
 await context.route('**/api/**',async r=>{
  const req=r.request(),u=new URL(req.url()),p=u.pathname;
  if(req.method()==='OPTIONS')return r.fulfill({status:204,headers:cors(r)});
  if(!['GET','HEAD'].includes(req.method()))reports.mutations.push({path:p,method:req.method(),body:req.postData()});
  if(p==='/api/bootstrap')return ok(r,{user,branches,branchId:1,page:module,resources:{},revision:1});
  if(p==='/api/workspace')return ok(r,module==='orders'?{orders:counterOrders,products,tables:currentTables}:module==='locations'?{branches,tables,qr}:{categories,products});
  if(p==='/api/catalog/branches')return ok(r,branches);
  if(p==='/api/catalog/branches/1/tables')return ok(r,currentTables);
  if(p==='/api/catalog/products')return ok(r,products);
  if(p.includes('/session'))return ok(r,{table:currentTables.find(t=>t.id===Number(p.split('/')[4])),session:null,serviceRequests:[]});
  if(p==='/api/orders'&&req.method()==='GET')return ok(r,counterOrders);
  if(p==='/api/orders'&&req.method()==='POST')return ok(r,{id:'fixture-order'});
  if(p==='/api/kds/batches')return state.failKitchen?error(r,503,'Mất kết nối kiểm thử'):ok(r,batches);
  if(p.endsWith('/schedules/current'))return error(r,404,'No schedule');
  if(p.endsWith('/operating-policy'))return ok(r,{mode:'OFF',targetCompletionMinutes:20,targetDishGapMinutes:5,priority:'BALANCED',stationSlots:{WOK_STATION:2,STEAM_STATION:2,FRY_STATION:2,BAR_STATION:2,COLD_DISH:2},solverConfigured:true});
  if(p==='/api/inventory/ingredients')return ok(r,Array.from({length:5},(_,i)=>({id:i+1,name:'Nguyên liệu '+(i+1),unit:'kg'})));
  if(p.endsWith('/recipe'))return ok(r,Array.from({length:5},(_,i)=>({ingredientId:i+1,quantity:0.12,wasteRate:0.05})));
  if(p==='/api/receipts/history'){
   state.historyRequests.push(Object.fromEntries(u.searchParams));
   const from=u.searchParams.get('from'),to=u.searchParams.get('to');
   if(from&&to&&from>to)return error(r,400,'Ngày bắt đầu phải trước ngày kết thúc.');
   const page=Number(u.searchParams.get('page')||1),q=u.searchParams.get('q')||'';
   return ok(r,{items:q==='none'?[]:Array.from({length:page===3?2:20},(_,i)=>({...receipt,id:'r'+((page-1)*20+i+1),snapshot:{...receipt.snapshot,code:'HD-20261121-CN01-'+String((page-1)*20+i+1).padStart(3,'0')}})),total:q==='none'?0:42,page,pageSize:20});
  }
  if(/^\/api\/catalog\/products\/\d+$/.test(p)&&req.method()==='PATCH'){
   const product=products.find(x=>x.id===Number(p.split('/').at(-1)));Object.assign(product,req.postDataJSON());return ok(r,product);
  }
  if(p==='/api/live')return error(r,503,'Live disabled in audit');
  reports.apiErrors.push({module,path:p,method:req.method()});return error(r,503,'Unmatched fixture endpoint');
 });
 const page=await context.newPage();page.on('pageerror',e=>reports.pageErrors.push({module,message:e.message}));
 await page.goto(url);await page.locator(module==='orders'?'.sw-tables':module==='catalog'?'#menu-admin':module==='locations'?'[data-location-table]':module==='kitchen'?'.kitchen-ticket':'.rm-row').first().waitFor();await page.evaluate(()=>document.fonts.ready);
 return {context,page,state};
}
async function capture(page,name,width,fullPage=false){
 await page.setViewportSize({width,height:900});await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(out,name+'-'+width+'.png'),fullPage,animations:'disabled'});
 const result=await page.evaluate(()=>{const measure=s=>{const el=document.querySelector(s);if(!el)return null;const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom,text:el.innerText?.trim().slice(0,180)}};return {viewport:{width:innerWidth,height:innerHeight},docWidth:document.documentElement.scrollWidth,docHeight:document.documentElement.scrollHeight,header:measure('.page-head'),search:measure('#catalog-search'),firstProduct:measure('.ma-product'),firstTable:measure('[data-action=edit-table]'),firstQr:measure('.qr-row'),firstQrAction:measure('.qr-row .manage-actions'),firstTicket:measure('.kitchen-ticket'),stale:measure('.kitchen-group:last-child'),receipt:measure('.rm-row')}});
 reports.screens.push({name,width,file:name+'-'+width+'.png',...result});return result;
}
async function checkFocus(page,selector){
 const control=page.locator(selector);
 const measure=()=>control.evaluate(el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return {width:r.width,height:r.height,border:s.borderTopWidth,color:s.borderTopColor,outline:s.outlineStyle,shadow:s.boxShadow};});
 await control.evaluate(el=>el.blur());const before=await measure();await control.focus();const after=await measure();
 assert.equal(after.border,'1px',selector);assert.equal(after.outline,'none',selector);assert.equal(after.shadow,'none',selector);
 assert.equal(after.width,before.width,selector);assert.equal(after.height,before.height,selector);assert.notEqual(after.color,before.color,selector);
 await control.evaluate(el=>el.blur());
}
let server;let checks=0;const measurements=[];
(async()=>{await fs.mkdir(out,{recursive:true});server=await createServer({server:{host:'127.0.0.1',port:0}});await server.listen();url=server.resolvedUrls.local[0];browser=await chromium.launch({channel:'msedge',headless:true});try{
 for(const count of [0,2,12,48]){currentTables=Array.from({length:count},(_,i)=>({id:i+1,tableName:'Bàn '+String(i+1).padStart(2,'0'),status:['SERVING','EMPTY','RESERVED'][i%3],seatingCapacity:4,pendingOrderCount:0,serviceRequestCount:i===0?1:0,unconfirmedOrderCount:i===0?2:0,readyQuantity:i===0?3:0,billRequested:i===0,sessionOpenedAt:i%3===0?new Date(now-65*60000).toISOString():null,partySize:i%3===0?3:null}));
 const obj=await contextFor('orders'),page=obj.page;
 assert.equal(await page.locator('.breadcrumb').count(),0);
 assert.equal(await page.locator('.service-page-heading p').count(),0);
 for(const selector of ['#branch','[data-sw-input=table-search]','[data-sw-input=table-filter]']){await checkFocus(page,selector);checks++;}
 for(const size of [{width:1280,height:720},{width:1366,height:768},{width:1440,height:900},{width:1920,height:1080}]){await page.setViewportSize(size);await page.evaluate(()=>scrollTo(0,0));const metrics=await page.evaluate(()=>{const boxes=[...document.querySelectorAll('.sw-table')].map(el=>({borderWidths:['Top','Right','Bottom','Left'].map(side=>getComputedStyle(el)['border'+side+'Width']),borderColors:['Top','Right','Bottom','Left'].map(side=>getComputedStyle(el)['border'+side+'Color']),w:el.getBoundingClientRect().width,h:el.getBoundingClientRect().height,scroll:el.scrollHeight,client:el.clientHeight}));return {doc:document.documentElement.scrollWidth,viewport:innerWidth,cards:boxes,columns:[...document.querySelectorAll('.sw-table-grid')].map(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),tabY:document.querySelector('.service-operation-tabs').getBoundingClientRect().y};});assert.ok(metrics.doc<=size.width);assert.ok(metrics.columns.every(n=>n<=8));assert.ok(metrics.cards.length<=12);assert.ok(metrics.cards.every(c=>new Set(c.borderWidths).size===1&&new Set(c.borderColors).size===1),JSON.stringify(metrics));assert.ok(metrics.cards.every(c=>c.w<=241&&c.h>=112&&c.h<=220&&c.scroll<=c.client+1),JSON.stringify(metrics));assert.ok(metrics.tabY<260);assert.equal(await page.locator('.service-operation-panel:visible').count(),1);await page.screenshot({path:path.join(out,'tables-'+count+'-'+size.width+'.png')});measurements.push({count,...size,...metrics});checks++;}
 if(count===48){await page.locator('[data-sw=tables-next]').click();assert.match(await page.locator('.sw-table-pagination').innerText(),/Trang 2/);await page.locator('[data-sw-input=table-search]').fill('Bàn 48');assert.equal(await page.locator('.sw-table').count(),1);assert.match(await page.locator('.sw-table-pagination').innerText(),/Trang 1/);await page.locator('[data-sw-input=table-search]').fill('');await page.locator('[data-sw-input=table-filter]').selectOption('EMPTY');assert.ok((await page.locator('.sw-table').count())<=12);assert.equal(await page.locator('.sw-table-group').count(),1);await page.locator('[data-sw-input=table-filter]').selectOption('ALL');checks++;}
 await page.locator('[data-service-section=takeaway]').click();assert.equal(await page.locator('#service-panel-tables').isVisible(),false);await page.locator('[data-action=select-product]').first().click();await checkFocus(page,'#qty');checks++;await page.locator('#qty').fill('2');await page.locator('[data-action=add-item]').click();assert.equal(await page.locator('[data-service-section=takeaway]').getAttribute('aria-selected'),'true');assert.equal(await page.locator('.takeaway-summary .cart-item').count(),1);checks++;
 await page.locator('[data-service-section=orders]').click();assert.equal(await page.locator('#service-panel-takeaway').isVisible(),false);await checkFocus(page,'#order-filter');checks++;await page.locator('#order-filter').selectOption('PENDING');assert.equal(await page.locator('#orders-list .order-card').count(),1);await page.locator('[data-service-section=takeaway]').click();assert.equal(await page.locator('.takeaway-summary .cart-item').count(),1);await page.screenshot({path:path.join(out,'takeaway-'+count+'.png')});checks++;
 if(count===2){await page.locator('[data-service-section=tables]').click();await page.locator('.sw-table').first().click();await page.locator('[data-sw=open]').waitFor();await page.locator('[data-service-section=takeaway]').click();await page.locator('[data-action=add-item]').click();await page.locator('[data-service-section=tables]').click();assert.equal(await page.locator('[data-sw=open]').isVisible(),true);checks++;await page.locator('[data-service-section=tables]').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('[data-service-section=takeaway]').getAttribute('aria-selected'),'true');await page.locator('[data-action=create-order]').click();await page.locator('.takeaway-summary .cart-item').waitFor({state:'detached'});await page.waitForFunction(()=>document.querySelector('[data-action=create-order]').disabled);const posted=reports.mutations.filter(m=>m.path==='/api/orders').at(-1);assert.equal(JSON.parse(posted.body).items[0].quantity,2);assert.equal(JSON.parse(posted.body).tableId,undefined);checks++;}
 await obj.context.close();}
 for(const app of ['staff','management']){
  const page=await browser.newPage();
  await page.goto(url+'tools/service-preview.html?app='+app);
  await page.locator('.sw-table').first().waitFor();
  for(const selector of ['[data-sw-input=table-search]','[data-sw-input=table-filter]']){await checkFocus(page,selector);checks++;}
  if(app==='management')await page.locator('[data-sw-input=table-filter]').selectOption('ALL');
  for(const width of [390,768,1440]){
   await page.setViewportSize({width,height:900});
   const result=await page.evaluate(()=>({width:innerWidth,doc:document.documentElement.scrollWidth,cards:[...document.querySelectorAll('.sw-table')].map(el=>({w:el.getBoundingClientRect().width,h:el.getBoundingClientRect().height,scroll:el.scrollHeight,client:el.clientHeight}))}));
   assert.ok(result.doc<=width,JSON.stringify(result));
   assert.ok(result.cards.every(c=>c.w<=241&&c.h>=112&&c.h<=240&&c.scroll<=c.client+1),JSON.stringify(result));
   await page.screenshot({path:path.join(out,app+'-compact-'+width+'.png'),fullPage:true});checks++;
  }
  await page.close();
 }
 assert.deepEqual(reports.pageErrors,[]);assert.deepEqual(reports.apiErrors,[]);await fs.writeFile(path.join(out,'measurements.json'),JSON.stringify(measurements,null,2));console.log(JSON.stringify({checks,errors:reports.pageErrors,output:out}));
 }finally{await browser?.close();await server?.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
