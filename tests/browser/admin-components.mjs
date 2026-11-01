// The real overview and backup entries, with API fixtures only.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
const {chromium}=createRequire(import.meta.url)('playwright');
const server=await createServer({configFile:false,server:{host:'127.0.0.1',port:0}});await server.listen();
const browser=await chromium.launch({channel:'msedge',headless:true});
const user={id:1,role:'ADMIN',fullName:'Component fixture'},rows=Array.from({length:5},(_,i)=>({id:i+1,orderCode:`HD-CN01-2026-${i}`,createdAt:'2026-10-31T12:00:00Z',finalAmount:164050,status:['PENDING','PAID','CANCELLED'][i%3]}));
const resources={dashboard:{todayRevenue:328100,totalOrdersCount:2,lowStockCount:0,lowStockItems:[]},orders:rows,batches:[]};
const backup={availability:'AVAILABLE',checkedAt:'2026-10-31T14:00:00Z',backups:rows.map((row,i)=>({id:`archive-${i}`,createdAt:row.createdAt,bytes:1024,requestedByName:user.fullName,trigger:'MANUAL',canRestore:true})),jobs:[],schedule:{frequency:'OFF'},capability:{canCreate:true,canRestore:true,canManageArchives:true},storage:{freeBytes:1024**3,totalBytes:5*1024**3,usedBytes:4*1024**3,usagePercent:80,backupBytes:5120}};
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(user=>{sessionStorage.setItem('dusko_token','fixture');sessionStorage.setItem('dusko_user',JSON.stringify(user));},user);
 await page.route('**/api/**',route=>{const url=new URL(route.request().url());const value=url.pathname==='/api/bootstrap'?{user,page:url.searchParams.get('page')||'overview',branchId:1,branches:[{id:1,name:'Dusko'}],resources,revision:1}:url.pathname==='/api/workspace'?resources:url.pathname==='/api/admin/backups'?backup:null;return value?route.fulfill({json:{success:true,data:value}}):route.fulfill({status:503,json:{success:false,error:'Fixture: realtime unavailable'}});});
 const measure=()=>page.evaluate(()=>{
  const css=selector=>{const el=document.querySelector(selector),s=getComputedStyle(el);return Object.fromEntries(['backgroundColor','color','borderColor','borderRadius','borderWidth','boxShadow','padding','fontSize','fontWeight','lineHeight','letterSpacing','minHeight'].map(key=>[key,s[key]]));};
  const metric=document.querySelector('.ui-metric')?'.ui-metric':'.metric',table=document.querySelector('.ui-table')?'.ui-table':'table';
  return {card:css(metric),label:css(metric+'>span'),value:css(metric+'>strong'),description:css(metric+'>small'),icon:css(metric+'>i'),header:css(table+' th'),cell:css(table+' td'),frame:css('.ui-table-frame,.table-scroll')};
 });
 const results=[];
 for(const width of [1440,768,390]){
  await page.setViewportSize({width,height:1050});await page.goto(server.resolvedUrls.local[0]+'?page=overview');await page.locator('.ui-metric,.metric').first().waitFor();await page.evaluate(()=>document.fonts.ready);
  const overview=await measure();results.push({width,...overview});
  if(!process.argv.includes('--capture')){
   const baseline=JSON.parse(await readFile('docs/ui/admin-components-baseline.json','utf8')).find(item=>item.width===width);
   for(const key of ['card','label','value','description','icon','header','cell'])assert.deepEqual(overview[key],baseline[key],`overview ${key} preserves reference at ${width}`);
   await page.screenshot({path:`docs/ui/shared-overview-${width}.png`,fullPage:true});
   await page.goto(server.resolvedUrls.local[0]+'?page=backups');await page.locator('.ui-metric').first().waitFor();const actual=await measure();
   for(const key of ['card','label','value','description','icon'])assert.deepEqual(actual[key],overview[key],`backup ${key} shares overview styles at ${width}`);
   if(width===1440)for(const key of ['header','cell'])assert.deepEqual(actual[key],overview[key],`backup ${key} shares table styles`);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  }
 }
 if(process.argv.includes('--capture'))await writeFile('docs/ui/admin-components-baseline.json',JSON.stringify(results,null,2)+'\n');
 assert.deepEqual(errors,[]);console.log(process.argv.includes('--capture')?JSON.stringify(results):'PASS: shared card/table styles match operational overview, responsive and unchanged reference design');
}finally{await browser.close();await server.close();}
