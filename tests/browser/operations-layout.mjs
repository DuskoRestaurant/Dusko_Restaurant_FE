import {createRequire} from 'node:module';
import {createServer} from 'vite';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
const out=path.resolve(process.env.DUSKO_UI_OUTPUT||'../output/operations-layout');
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
async function contextFor(module){
 const context=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:'block'});
 await context.addInitScript(user=>{sessionStorage.setItem('dusko_token','fixture-audit');sessionStorage.setItem('dusko_user',JSON.stringify(user));},user);
 const state={module,failKitchen:false,historyRequests:[]};
 await context.route('**/api/**',async r=>{
  const req=r.request(),u=new URL(req.url()),p=u.pathname;
  if(req.method()==='OPTIONS')return r.fulfill({status:204,headers:cors(r)});
  if(!['GET','HEAD'].includes(req.method()))reports.mutations.push({path:p,method:req.method(),body:req.postData()});
  if(p==='/api/bootstrap')return ok(r,{user,branches,branchId:1,page:module,resources:{},revision:1});
  if(p==='/api/workspace')return ok(r,module==='locations'?{branches,tables,qr}:{categories,products});
  if(p==='/api/catalog/branches')return ok(r,branches);
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
 await page.goto(url);await page.locator(module==='catalog'?'#menu-admin':module==='locations'?'[data-location-table]':module==='kitchen'?'.kitchen-ticket':'.rm-row').first().waitFor();await page.evaluate(()=>document.fonts.ready);
 return {context,page,state};
}
async function capture(page,name,width,fullPage=false){
 await page.setViewportSize({width,height:900});await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(out,name+'-'+width+'.png'),fullPage,animations:'disabled'});
 const result=await page.evaluate(()=>{const measure=s=>{const el=document.querySelector(s);if(!el)return null;const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom,text:el.innerText?.trim().slice(0,180)}};return {viewport:{width:innerWidth,height:innerHeight},docWidth:document.documentElement.scrollWidth,docHeight:document.documentElement.scrollHeight,header:measure('.page-head'),search:measure('#catalog-search'),firstProduct:measure('.ma-product'),firstTable:measure('[data-action=edit-table]'),firstQr:measure('.qr-row'),firstQrAction:measure('.qr-row .manage-actions'),firstTicket:measure('.kitchen-ticket'),stale:measure('.kitchen-group:last-child'),receipt:measure('.rm-row')}});
 reports.screens.push({name,width,file:name+'-'+width+'.png',...result});return result;
}
let server;const metrics=[];
(async()=>{await fs.mkdir(out,{recursive:true});if(process.env.DUSKO_UI_DEPLOYED==='1')url='https://admin.dusko.io.vn/';else{server=await createServer({server:{host:'127.0.0.1',port:0}});await server.listen();url=server.resolvedUrls.local[0];}browser=await chromium.launch({channel:'msedge',headless:true});try{for(const module of ['receipts','catalog','locations','kitchen']){const obj=await contextFor(module);for(const size of [{width:1280,height:720},{width:1366,height:768},{width:1440,height:900},{width:1920,height:1080}]){await obj.page.setViewportSize(size);await obj.page.evaluate(()=>document.fonts.ready);await obj.page.evaluate(()=>scrollTo(0,0));await obj.page.screenshot({path:path.join(out,module+'-'+size.width+'.png')});const m=await obj.page.evaluate(()=>{const rect=s=>{const el=document.querySelector(s);if(!el)return null;const r=el.getBoundingClientRect(),c=getComputedStyle(el);return {x:r.x,y:r.y,w:r.width,h:r.height,gap:c.gap,padding:c.padding,columns:c.gridTemplateColumns};};return {scroll:document.documentElement.scrollWidth,width:innerWidth,content:rect('.content'),receipt:rect('.rm-row'),menu:rect('.ma-product'),table:rect('.location-table'),tableGrid:rect('[data-location-list]'),tableActions:rect('.location-table .manage-actions'),kitchen:rect('.kitchen-grid'),clipped:[...document.querySelectorAll('#page button,#page input,#page select')].filter(e=>e.clientWidth&&e.scrollWidth>e.clientWidth+2).map(e=>({text:e.innerText,name:e.name,scroll:e.scrollWidth,w:e.clientWidth}))};});assert.ok(m.scroll<=size.width);assert.deepEqual(m.clipped,[]);metrics.push({module,...size,...m});}await obj.context.close();}assert.deepEqual(reports.pageErrors,[]);await fs.writeFile(path.join(out,'measurements.json'),JSON.stringify(metrics,null,2));console.log(JSON.stringify({screens:metrics.length,output:out,errors:reports.pageErrors}));}finally{await browser?.close();await server?.close();}})().catch(e=>{console.error(e);process.exitCode=1;});