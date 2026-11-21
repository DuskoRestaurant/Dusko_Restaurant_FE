// Real application entries with isolated API fixtures; no restaurant data is written.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createServer} from 'vite';
import {assertSurfaceContrast} from './theme-contrast.mjs';
const {chromium}=createRequire(import.meta.url)('playwright');
const output=path.resolve(process.env.DUSKO_UI_OUTPUT||'../output/ui-design-system');
await mkdir(output,{recursive:true});
const servers=[];
async function serve(root,configFile){const server=await createServer({root,configFile,server:{host:'127.0.0.1',port:0}});await server.listen();servers.push(server);return server.resolvedUrls.local[0]}
const deployed=process.env.DUSKO_UI_DEPLOYED==='1';
const managementUrl=deployed?'https://admin.dusko.io.vn/':await serve('.','vite.config.js');
const staffUrl=deployed?'https://staff.dusko.io.vn/':await serve('staff-app','staff-app/vite.config.js');
const customerUrl=deployed?'https://order.dusko.io.vn/':await serve('customer-web','customer-web/vite.config.js');
const browser=await chromium.launch({channel:'msedge',headless:true});
const errors=[],results=[];
const products=[
 {id:1,name:'Cơm chiên Dusko',description:'Cơm chiên cùng rau củ và hải sản.',sellingPrice:65000,isActive:true,canOrder:true,requiresPreparation:true,availableQuantity:50,maxOrderQuantity:50,imageUrl:'/dishes/seafood-fried-rice.webp',category:{name:'Món chính'}},
 {id:2,name:'Lẩu Thái',description:'Nước dùng chua cay, hải sản và rau tươi.',sellingPrice:289000,isActive:true,canOrder:true,requiresPreparation:true,availableQuantity:20,maxOrderQuantity:20,imageUrl:'/dishes/lau-thai.webp',category:{name:'Lẩu'},tags:['SPICY']},
 {id:3,name:'Trà đào',sellingPrice:35000,isActive:true,canOrder:true,requiresPreparation:false,availableQuantity:40,maxOrderQuantity:40,category:{name:'Đồ uống'}},
 {id:4,name:'Món tạm hết',sellingPrice:49000,isActive:false,canOrder:false,availableQuantity:0,availabilityReason:'Tạm hết',category:{name:'Món chính'}},
];
const table={id:1,tableName:'Bàn 01',name:'Bàn 01',status:'SERVING',seatingCapacity:4,checkoutReady:true};
const user={id:1,role:'ADMIN',roles:['ADMIN'],fullName:'Quản trị kiểm thử',branchId:1};
const now=new Date().toISOString();
const resources={dashboard:{todayRevenue:130000,totalOrdersCount:2,lowStockCount:1,lowStockItems:[{name:'Gạo',unit:'kg',currentStock:3,minStock:5}]},orders:[{id:1,orderCode:'HD-CN01-001',createdAt:now,finalAmount:65000,status:'PENDING',table}],batches:[]};
const cors=route=>({'access-control-allow-origin':route.request().headers().origin||'*','access-control-allow-headers':'authorization,content-type','access-control-allow-methods':'GET,POST,PATCH,DELETE,OPTIONS'});
const preflight=route=>route.fulfill({status:204,headers:cors(route)});
const fulfill=(route,data)=>route.fulfill({headers:cors(route),json:{success:true,data}});
const fail=route=>route.fulfill({status:503,headers:cors(route),json:{success:false,error:'Không kết nối trực tiếp trong kiểm thử'}});
async function pageFor(context){const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));return page}
async function check(page,name,width){
 await page.setViewportSize({width,height:1000});await page.evaluate(()=>document.fonts.ready);
 const measurement=await page.evaluate(()=>{
  const s=getComputedStyle(document.body),root=getComputedStyle(document.documentElement);
  const styles=selector=>[...document.querySelectorAll(selector)].filter(el=>el.getClientRects().length).map(el=>{const c=getComputedStyle(el),r=el.getBoundingClientRect();return {text:el.textContent.trim().slice(0,60),width:r.width,height:r.height,font:c.fontSize,weight:c.fontWeight,numbers:c.fontVariantNumeric,radius:c.borderRadius,shadow:c.boxShadow,padding:c.padding,background:c.backgroundColor,color:c.color}});
  const palette=Object.fromEntries(['canvas','surface','surface-sunken','primary','primary-dark','primary-soft','ink','muted','line'].map(name=>[name,root.getPropertyValue('--'+name).trim()]));
  return {width:innerWidth,scroll:document.documentElement.scrollWidth,font:s.fontFamily,body:s.fontSize,primary:root.getPropertyValue('--primary').trim(),palette,background:s.backgroundColor,sidebar:styles('.sidebar'),navigation:styles('.nav-item.active'),pageTitles:styles('.page-head h1,.entry-form-box h1,.hero h1,.kw-heading h2'),summaryValues:styles('.ui-metric>strong'),cards:styles('.ui-metric,.panel,.guest-dish'),actions:styles('.entry-submit,.sw-button,.guest-dish-order button,.customer-cart-dock'),tableHeaders:styles('.ui-responsive th'),tableRows:styles('.ui-responsive tbody tr')};
 });
 assert.ok(measurement.scroll<=width+1,name+'/'+width+' overflow '+JSON.stringify(measurement));
 assert.ok(measurement.font.includes('Inter'),name+' must use Inter');
 assert.equal(measurement.body,'14px');assert.equal(measurement.primary,'#0F766E');
 assert.deepEqual(measurement.palette,{canvas:'#F8FAFA',surface:'#FFFFFF','surface-sunken':'#F1F5F4',primary:'#0F766E','primary-dark':'#115E59','primary-soft':'#E6F4F1',ink:'#1F2933',muted:'#52616B',line:'#E2E8E7'});
 if(width>760)for(const sidebar of measurement.sidebar)assert.equal(sidebar.width,240);
 for(const nav of measurement.navigation){assert.equal(nav.background,'rgb(230, 244, 241)');assert.equal(nav.color,'rgb(15, 118, 110)');assert.ok(nav.height>=40&&nav.height<=44)}
 for(const value of measurement.summaryValues){assert.equal(value.font,'28px');assert.equal(value.weight,'600');assert.ok(value.numbers.includes('tabular-nums'))}
 for(const card of measurement.cards){assert.equal(card.radius,'12px');assert.equal(card.shadow,'none');assert.equal(card.background,'rgb(255, 255, 255)')}
 for(const title of measurement.pageTitles){assert.equal(title.font,'24px');assert.equal(title.weight,'600')}
 if(width===1440){const sidebarWidth=await page.locator('.sidebar').count()?await page.locator('.sidebar').evaluate(el=>el.getBoundingClientRect().width):null;if(sidebarWidth!==null)assert.equal(sidebarWidth,240);for(const header of measurement.tableHeaders)assert.equal(header.height,44);for(const row of measurement.tableRows)assert.ok(row.height>=48&&row.height<=56,JSON.stringify(row))}
 for(const action of measurement.actions)assert.ok([32,40,48,56].some(height=>Math.abs(action.height-height)<1),`${name}: action height ${action.height}: ${action.text}`);
 await assertSurfaceContrast(page,['h1','h2','h3','h4','label','button','p','.ui-metric>span','.ui-metric>strong','.guest-dish-price strong','.sw-product span','.kw-ticket li']);
 if([1440,390].includes(width))await page.screenshot({path:path.join(output,name+'-'+width+'.png'),fullPage:true,animations:'disabled'});
 results.push({name,...measurement});
}
try {
 const loginContext=await browser.newContext({serviceWorkers:'block'}),login=await pageFor(loginContext);await login.goto(staffUrl);await login.locator('.entry-submit').waitFor();for(const width of [1440,390])await check(login,'login',width);await login.locator('[name=username]').focus();await login.keyboard.press('Tab');assert.equal(await login.locator('[name=password]').evaluate(el=>el===document.activeElement),true);await loginContext.close();
 const management=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
 await management.addInitScript(user=>{sessionStorage.setItem('dusko_token','fixture');sessionStorage.setItem('dusko_user',JSON.stringify(user))},user);
 await management.route('**/api/**',route=>{if(route.request().method()==='OPTIONS')return preflight(route);const url=new URL(route.request().url());return url.pathname==='/api/bootstrap'?fulfill(route,{user,page:url.searchParams.get('page')||'overview',branchId:1,branches:[{id:1,name:'Dusko Quận 1'}],resources,revision:1}):url.pathname==='/api/workspace'?fulfill(route,resources):fail(route)});
 const admin=await pageFor(management);await admin.goto(managementUrl);await admin.locator('.ui-metric').first().waitFor();
 for(const width of [1440,1024,768,390,320])await check(admin,'management',width);
 await admin.locator('[data-navigation-toggle]').click();assert.equal(await admin.locator('[data-navigation-toggle]').getAttribute('aria-expanded'),'true');await admin.locator('.nav-group').filter({hasText:'Vận hành'}).locator('summary').click();await admin.locator('[data-page=orders]').waitFor({state:'visible'});
 await admin.locator('[data-navigation-toggle]').click();assert.equal(await admin.locator('#management-navigation').isVisible(),false);
 await management.close();

 const staff=await browser.newContext({serviceWorkers:'block'});
 const staffUser={...user,role:'WAITER',roles:['WAITER'],fullName:'Nhân viên kiểm thử'};
 await staff.addInitScript(user=>sessionStorage.setItem('dusko-auth',JSON.stringify({token:'fixture',user})),staffUser);
 await staff.route('**/api/**',route=>{
  if(route.request().method()==='OPTIONS')return preflight(route);
  const p=new URL(route.request().url()).pathname;
  if(p==='/api/auth/profile')return fulfill(route,staffUser);
  if(p==='/api/catalog/branches/1/tables')return fulfill(route,[table]);
  if(p==='/api/catalog/products')return fulfill(route,products);
  if(p.includes('/session'))return fulfill(route,{table,session:{id:'session-1',status:'OPEN',orders:[]},serviceRequests:[]});
  if(p==='/api/kds/batches')return fulfill(route,[{id:1,batchCode:'BEP-001',status:'SCHEDULED',totalQuantity:2,scheduledTime:new Date(Date.now()-61*60000).toISOString(),stationType:'WOK_STATION',product:products[0],orderItems:[{quantity:2,note:'Ít cay',order:{table}}]}]);
  return fail(route);
 });
 const employee=await pageFor(staff);await employee.goto(staffUrl);await employee.locator('[data-shell=service]').click();await employee.locator('.sw-table').waitFor();
 for(const width of [1440,768,390,320])await check(employee,'staff-tables',width);
 await employee.locator('[data-sw=table]').click();await employee.locator('[data-sw=tab][data-tab=menu]').click();await employee.locator('.sw-product').first().waitFor();
 await employee.locator('.sw-product').first().click();await employee.locator('.sw-cart-item').first().waitFor();
 for(const width of [1440,768,390,320])await check(employee,'staff-menu',width);
 await employee.locator('#switch-role').click();await employee.locator('[data-shell=kitchen]').click();await employee.locator('.kw-ticket').waitFor();
 assert.match(await employee.locator('.kw-wait').innerText(),/Từ lúc nhận:.*1 giờ/s);
 assert.match(await employee.locator('.kw-wait').innerText(),/Chờ lâu · Cần kiểm tra/);
 for(const width of [1440,390])await check(employee,'staff-kitchen',width);
 await staff.close();

 const customer=await browser.newContext({serviceWorkers:'block'});
 let quantity=1,version=1;
 const basket=()=>({sessionId:'session-1',version:version++,items:[{id:1,productId:1,name:'Cơm chiên Dusko',quantity,sellingPrice:65000,lineTotal:65000*quantity,canOrder:true,maxOrderQuantity:50,note:'',product:products[0]}],combos:[],subtotal:quantity*65000,itemCount:quantity});
 await customer.route('**/api/**',route=>{
  if(route.request().method()==='OPTIONS')return preflight(route);
  const p=new URL(route.request().url()).pathname;
  if(p.endsWith('/cart/items')){quantity+=JSON.parse(route.request().postData()).quantity;return fulfill(route,basket())}
  if(p.endsWith('/cart'))return fulfill(route,basket());
  if(p.endsWith('/orders'))return fulfill(route,[]);
  if(p.endsWith('/combos'))return fulfill(route,{combos:[]});
  if(p.endsWith('/customer'))return fulfill(route,{verified:false,customer:null});
  if(/^\/api\/public\/tables\/[a-f0-9]{64}$/.test(p))return fulfill(route,{branch:{id:1,name:'Dusko Quận 1'},table,sessionId:'session-1',sessionOpen:true,products,serviceRequests:[]});
  return fail(route);
 });
 const guest=await pageFor(customer);await guest.goto(customerUrl+'t/'+'a'.repeat(64));await guest.locator('.guest-dish').first().waitFor();
 for(const width of [1440,1024,768,390,320])await check(guest,'customer-menu',width);
 await guest.locator('[data-menu-add="1"]').click();await guest.locator('.guest-dish-dialog').waitFor();
 await check(guest,'customer-details',390);
 await guest.locator('[data-detail-plus]').click();await guest.locator('button[form=guest-detail-form]').click();await guest.locator('.guest-dish-dialog').waitFor({state:'hidden'});
 assert.equal(quantity,3);
 await guest.locator('.customer-cart-dock').click();await guest.locator('.customer-cart-dialog[open]').waitFor();
 await check(guest,'customer-cart',390);
 await guest.keyboard.press('Escape');assert.equal(await guest.locator('.customer-cart-dialog').isVisible(),false);
 await guest.locator('[data-open-history]').click();await guest.locator('#customer-history-view').waitFor({state:'visible'});await check(guest,'customer-history',390);
 await guest.locator('[data-close-history]').click();await guest.locator('#customer-menu-view').waitFor({state:'visible'});
 await customer.close();
 assert.deepEqual(errors,[]);const summary={mode:deployed?'production-assets-with-isolated-fixtures':'local',checks:results.length,results,errors};await writeFile(path.join(output,'requirements-measurements.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify({mode:summary.mode,checks:results.length,output,errors}));
} finally {await browser.close();for(const server of servers)await server.close()}
