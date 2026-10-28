import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'vite';
import {mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {assertSurfaceContrast} from './theme-contrast.mjs';
const {chromium}=createRequire(import.meta.url)('playwright');
const server=await createServer({server:{host:'127.0.0.1',port:0}});await server.listen();
const browser=await chromium.launch({channel:'msedge',headless:true});
const output=path.join(tmpdir(),'dusko-ai-evidence');await mkdir(output,{recursive:true});
const source={from:'2026-09-28',to:'2026-10-27',orderCount:3,realOrders:2,syntheticOrders:1,totalQuantity:60,observedDays:2,baselineQuantity:30,daily:[{date:'2026-10-26',quantity:30},{date:'2026-10-27',quantity:30}],historicalHours:[{hour:12,quantity:60}]};
const baseline={productId:1,product:{id:1,name:'Cơm gà'},predictedQuantity:30,modelType:'BASELINE_MA',explanation:{source,model:null,fallbackReason:'Chưa có mô hình LSTM đã huấn luyện'}};
const rule={antecedents:['Cơm'],consequents:['Canh'],support:.5,confidence:1,lift:4/3,evidence:{total:4,together:2,antecedent:2,consequent:3}};
let mode='baseline',checks=0;const requests=[];
try{
 const context=await browser.newContext({serviceWorkers:'block'}),user={id:1,role:'ADMIN',fullName:'Quản lý kiểm thử',branchId:1};
 await context.addInitScript(user=>{sessionStorage.setItem('dusko_token','test');sessionStorage.setItem('dusko_user',JSON.stringify(user));},user);
 await context.route('**/api/**',async route=>{
  const u=new URL(route.request().url());requests.push(u.pathname);let data;
  if(u.pathname==='/api/bootstrap')data={user,branches:[{id:1,name:'Chi nhánh kiểm thử'}],branchId:1,page:'forecast',resources:{forecast:[]}};
  else if(u.pathname==='/api/catalog/products')data=[baseline.product];
  else if(u.pathname==='/api/forecast/daily'){
   if(mode==='error'){await route.fulfill({status:500,json:{error:'Lỗi dữ liệu kiểm thử'}});return;}
   data=mode==='empty'?[]:[mode==='baseline'?baseline:{...baseline,modelType:'LSTM',predictedQuantity:31,explanation:{source,model:{modelVersion:'v-test',trainedAt:'2026-10-28T01:00:00Z',trainingSamples:10,rawOutput:30.65,inputWindow:Array.from({length:14},(_,i)=>({date:`2026-10-${14+i}`,features:{lag_1d:30,lag_7d:28,lag_14d:25,rolling_avg_7d:29,rolling_std_7d:2.5,is_weekend:0,day_of_week:1,month:10}}))}}}];
  }else if(u.pathname==='/api/forecast/baskets')data={branchId:1,from:'2026-09-28',to:'2026-10-27',transactions:4,realOrders:3,syntheticOrders:1,thresholds:{support:.01,confidence:.2,lift:1},rules:[rule]};
  else if(u.pathname==='/api/inventory/plan')data=[{ingredient:{name:'Gạo',unit:'kg'},grossDemand:7.5,currentStock:5,safetyStock:2,suggestedOrderQty:4.5,explanation:{sources:[{productName:'Cơm gà',portions:30,recipeQuantity:.2,wasteRate:.2,demand:7.5}]}}];
  else{await route.fulfill({status:503,json:{error:'Disabled in browser test'}});return;}
  await route.fulfill({json:{success:true,data}});
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',err=>errors.push(err.message));
 await page.goto(server.resolvedUrls.local[0]);await page.locator('#ai-prepare').waitFor();
 assert.equal(await page.getByText(/Autoencoder|Rà soát biến động/).count(),0);checks++;
 await page.locator('[data-action=run-forecast]').click();await page.getByText('Vì sao ra 30 suất?',{exact:true}).click();
 await page.getByText(/60 suất ÷ 2 ngày có bán/).waitFor();checks++;
 await page.getByText('Lượng bán cũ theo giờ — chỉ để đối chiếu',{exact:true}).click();await page.getByText('không phải dự báo theo giờ',{exact:true}).waitFor();checks++;
 await page.locator('[data-action=analyze-baskets]').click();await page.getByText('Căn cứ gợi ý',{exact:true}).click();await page.getByText(/Confidence A → B = 2 ÷ 2 = 100%/).waitFor();checks++;
 // Opening the plan retains exact recipe quantities and never invokes receiving stock.
 await page.locator('[data-action=ai-plan]').click();await page.locator('.ai-action-dialog').waitFor();await page.locator('.ai-action-dialog .ai-evidence summary').click();await page.getByText(/30 suất × 0,2 kg\/suất ÷/).waitFor();checks++;
 for(const colorScheme of ['light','dark'])for(const width of [390,1440]){
  await page.emulateMedia({colorScheme});await page.setViewportSize({width,height:1000});
  assert.ok(await page.locator('.ai-action-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  await assertSurfaceContrast(page,['.ai-action-dialog h2','.ai-action-dialog .ai-evidence summary']);
  await page.screenshot({path:path.join(output,`mrp-${colorScheme}-${width}.png`)});checks++;
 }
 await page.locator('.ai-action-dialog [data-close]').first().click();
 mode='lstm';await page.locator('[data-action=run-forecast]').click();await page.getByText('Vì sao ra 31 suất?',{exact:true}).click();await page.getByText(/đầu ra thô 30,65/).waitFor();assert.equal(await page.locator('.forecast-dish .ai-evidence table').first().locator('tbody tr').count(),14);checks++;
 for(const colorScheme of ['light','dark'])for(const width of [390,1440]){
  await page.emulateMedia({colorScheme});await page.setViewportSize({width,height:1000});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await assertSurfaceContrast(page,['.ai-evidence summary','.ai-evidence p']);
  await page.screenshot({path:path.join(output,`forecast-${colorScheme}-${width}.png`),fullPage:true});checks++;
 }
 mode='error';await page.locator('[data-action=run-forecast]').click();await page.getByText('Lỗi dữ liệu kiểm thử',{exact:true}).waitFor();checks++;
 mode='empty';await page.locator('[data-action=run-forecast]').click();await page.waitForFunction(()=>!document.querySelector('.forecast-dish'));checks++;
 assert.deepEqual(errors,[]);assert.ok(!requests.some(p=>/anomaly|receive/.test(p)));await context.close();
 console.log(JSON.stringify({checks,output}));
}finally{await browser.close();await server.close();}
