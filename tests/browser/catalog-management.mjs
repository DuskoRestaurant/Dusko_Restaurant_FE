import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'vite';
import {mkdir} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)('playwright');
const server=await createServer({configFile:'vite.config.js',server:{host:'127.0.0.1',port:0}});await server.listen();
const browser=await chromium.launch({channel:'msedge',headless:true});
await mkdir('docs/ui',{recursive:true});
let checks=0;
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const user={id:1,role:'ADMIN',fullName:'Quản trị viên',branchId:1};
  await page.addInitScript(user=>{sessionStorage.setItem('dusko_token','test');sessionStorage.setItem('dusko_user',JSON.stringify(user));},user);
  let categories=[{id:1,name:'Món Việt'},{id:2,name:'Đồ uống'},{id:3,name:'Nhóm trống'}];
  const products=Array.from({length:28},(_,i)=>({id:i+1,code:`MON-${i+1}`,name:i%2?'Trà đào cam sả':'Bò lúc lắc',categoryId:i%2?2:1,category:{name:i%2?'Đồ uống':'Món Việt'},sellingPrice:i%2?39000:129000,isActive:true,requiresPreparation:i%2===0,canOrder:true,maxOrderQuantity:40,_count:{recipes:2}}));
  let deleted=[];
  await page.route('**/api/**',async route=>{
    const req=route.request(),url=new URL(req.url());let data;
    if(url.pathname==='/api/bootstrap')data={user,branches:[{id:1,name:'Dusko Quận 1'}],branchId:1,page:'catalog',resources:{categories,products}};
    else if(url.pathname==='/api/workspace')data={categories,products};
    else if(req.method()==='DELETE'&&url.pathname.startsWith('/api/catalog/categories/')){
      const id=Number(url.pathname.split('/').at(-1)),body=req.postDataJSON();deleted.push({id,body});
      categories=categories.filter(c=>c.id!==id);for(const p of products)if(p.categoryId===id){p.categoryId=body.targetCategoryId;p.category={name:categories.find(c=>c.id===p.categoryId)?.name};}
      data={id,deleted:true};
    }else{await route.fulfill({status:503,json:{error:'Fixture endpoint disabled'}});return;}
    await route.fulfill({json:{success:true,data}});
  });
  await page.goto(server.resolvedUrls.local[0]);await page.locator('#menu-admin').waitFor();
  assert.equal(await page.locator('.ma-product').count(),12);
  await page.locator('#catalog-search').fill('bo luc lac');await page.getByText('14 món trong thực đơn',{exact:true}).waitFor();checks++;
  await page.locator('#catalog-search').fill('');await page.locator('[data-menu-category="2"]').click();assert.equal(await page.locator('#catalog-heading').innerText(),'Đồ uống');checks++;
  await page.locator('[data-menu-category="all"]').click();await page.locator('[data-menu-page="1"]').click();assert.equal(await page.locator('#catalog-page').innerText(),'2 / 3');checks++;
  await page.locator('[data-menu-page="-1"]').click();
  for(const width of [1440,1024,390]){
    await page.setViewportSize({width,height:1000});
    const size=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth}));assert.ok(size.scroll<=size.width+1,JSON.stringify(size));
    await page.screenshot({path:`docs/ui/catalog-${width}.png`,fullPage:true});checks++;
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.locator('[data-action="delete-category"][data-id="1"]').click();
  await page.locator('[name="targetCategoryId"]').selectOption('2');await page.getByRole('button',{name:'Chuyển món và xóa nhóm',exact:true}).click();
  await page.locator('[data-menu-category="1"]').waitFor({state:'detached'});assert.deepEqual(deleted[0],{id:1,body:{targetCategoryId:2}});checks++;
  await page.locator('[data-action="delete-category"][data-id="3"]').click();await page.getByRole('button',{name:'Xóa nhóm',exact:true}).click();
  await page.locator('[data-menu-category="3"]').waitFor({state:'detached'});assert.equal(deleted[1].id,3);checks++;
  assert.deepEqual(errors,[]);console.log(JSON.stringify({checks,errors}));
}finally{await browser.close();await server.close();}
