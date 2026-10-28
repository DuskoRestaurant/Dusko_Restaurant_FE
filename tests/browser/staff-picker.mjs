import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createServer} from 'vite';
import {assertSurfaceContrast} from './theme-contrast.mjs';
const {chromium}=createRequire(import.meta.url)('playwright');
const server=await createServer({root:'staff-app',configFile:'staff-app/vite.config.js',server:{host:'127.0.0.1',port:0}});await server.listen();
const browser=await chromium.launch({channel:'msedge',headless:true});
const output=path.join(tmpdir(),'dusko-staff-picker');await mkdir(output,{recursive:true});
let checks=0;
try{
  for(const role of ['WAITER','CASHIER','CHEF']){
    const context=await browser.newContext({serviceWorkers:'block'});
    const user={id:1,role,roles:[role],fullName:'Nhân viên kiểm thử',branchId:1};
    await context.addInitScript(()=>sessionStorage.setItem('dusko-shell','cashier'));
    await context.route('**/api/**',async route=>{
      const url=new URL(route.request().url());let data;
      if(url.pathname==='/api/auth/login')data={token:'test',user};
      else if(url.pathname==='/api/auth/profile')data=user;
      else if(url.pathname==='/api/catalog/branches/1/tables')data=[];
      else if(url.pathname==='/api/catalog/products'||url.pathname==='/api/kds/batches')data=[];
      else {await route.fulfill({status:503,json:{error:'Live disabled in test'}});return;}
      await route.fulfill({json:{success:true,data}});
    });
    const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(server.resolvedUrls.local[0]);
    await page.locator('[name=username]').fill(role);await page.locator('[name=password]').fill('test-password');await page.locator('.entry-submit').click();
    await page.locator('.role-picker').waitFor();assert.equal(await page.locator('[data-shell]').count(),3);checks++;
    for(const shell of ['kitchen','cashier','service']){
      await page.locator(`[data-shell=${shell}]`).click();
      await page.locator(shell==='kitchen'?'.kw-workspace':'.sw-tables').waitFor();
      assert.equal(await page.locator('[data-view=receipts]').count(),shell==='cashier'?1:0);
      assert.equal(await page.getByText('Trang quản lý ↗',{exact:true}).count(),0);
      await page.locator('#switch-role').click();await page.locator('.role-picker').waitFor();checks++;
    }
    await page.locator('[data-shell=service]').click();await page.locator('.sw-tables').waitFor();await page.reload();await page.locator('.role-picker').waitFor();checks++;
    if(role==='WAITER')for(const colorScheme of ['light','dark'])for(const width of [390,1440]){
      await page.emulateMedia({colorScheme});await page.setViewportSize({width,height:1000});
      await page.screenshot({path:path.join(output,`picker-${colorScheme}-${width}.png`),fullPage:true,animations:'disabled'});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      await assertSurfaceContrast(page,['.role-card strong','.role-card>span','.role-picker h1','.role-picker>p']);checks++;
    }
    await page.locator('[data-picker-logout]').click();await page.locator('.entry-submit').waitFor();assert.equal(await page.evaluate(()=>sessionStorage.getItem('dusko-auth')),null);checks++;
    assert.deepEqual(errors,[]);await context.close();
  }
  console.log(JSON.stringify({checks,output}));
}finally{await browser.close();await server.close();}
