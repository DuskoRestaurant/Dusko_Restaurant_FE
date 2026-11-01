// Uses only mocked APIs; never restores or deletes production data.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile} from 'node:fs/promises';
import {createServer} from 'vite';
const {chromium}=createRequire(import.meta.url)('playwright');
const reference=JSON.parse(await readFile('docs/ui/backup-menu-sizing.json','utf8'));
const server=await createServer({configFile:false,server:{host:'127.0.0.1',port:0}});await server.listen();
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 const ids=[1,2,3].map(n=>`2026-10-31T00-00-00-000Z-${String(n).repeat(8)}-1111-4111-8111-111111111111`);
 const cap={enabled:true,canCreate:true,canRestore:true,canManageArchives:true,reason:null};
 const data={checkedAt:'2026-10-31T09:00:00Z',availability:'AVAILABLE',invalidCount:0,truncated:false,totalBackups:3,
  capability:{...cap},activeJob:null,jobs:[],schedule:{frequency:'OFF',hour:2,minute:0,weekday:1,nextRunAt:null},
  storage:{totalBytes:50*1024**3,usedBytes:39.5*1024**3,freeBytes:10.5*1024**3,backupBytes:14*1024**3,usagePercent:79},
  backups:ids.map((id,i)=>({id,createdAt:`2026-10-${31-i}T07:00:00Z`,bytes:1200000000-i*120000000,trigger:i?'AUTO':'MANUAL',requestedBy:1,requestedByName:i===0?'Vận hành hệ thống — kiểm chứng triển khai':'Nguyễn Quản Trị',imageProvider:'s3',canRestore:true}))};
 let bootstrap=0,creates=0,deletes=0,downloads=0,restores=0,schedules=0,expired=false;
 const jobId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',monitorToken='a'.repeat(64);
 let monitor={id:jobId,operation:'RESTORE',state:'RUNNING',phase:'RESTORE_SQL',progress:28,maintenance:true};
 const addJob=(operation,state='COMPLETED',phase='COMPLETED',progress=100)=>({id:jobId,operation,state,phase,progress,requestedBy:1,requestedByName:'Nguyễn Quản Trị',requestedAt:data.checkedAt,backupId:ids[0]});
 await page.addInitScript(()=>{if(!sessionStorage.getItem('dusko_token')){sessionStorage.setItem('dusko_token','mock');sessionStorage.setItem('dusko_user',JSON.stringify({id:1,role:'ADMIN',fullName:'Nguyễn Quản Trị'}));}});
 await page.route('**/api/**',async route=>{
  const url=new URL(route.request().url()),p=url.pathname,method=route.request().method();
  const ok=result=>route.fulfill({json:{success:true,data:result}});
  if(p==='/api/bootstrap'){bootstrap++;return ok({user:{id:1,role:'ADMIN',fullName:'Nguyễn Quản Trị'},page:'backups',branchId:1,branches:[{id:1,name:'Dusko'}],resources:{},revision:1});}
  if(p.startsWith('/api/admin/backups/restore-status/')){if(expired)return route.fulfill({status:403,json:{success:false,error:'Monitor expired'}});assert.equal(route.request().headers()['x-backup-monitor'],monitorToken);return ok(monitor);}
  if(p==='/api/admin/backups'&&method==='GET')return ok(data);
  if(p.startsWith('/api/admin/backups')&&method!=='GET'){
   const body=route.request().postDataJSON();
   if(body.code==='000000')return route.fulfill({status:400,json:{success:false,error:'Mã Authenticator không đúng hoặc đã dùng.'}});
   assert.equal(body.code,'123456');
   if(p.endsWith('/download')){downloads++;return route.fulfill({contentType:'application/zip',body:Buffer.from('504b0506000000000000000000000000000000000000','hex')});}
   if(method==='DELETE'){assert.equal(body.confirmation,'CONFIRM');deletes++;data.backups=data.backups.filter(item=>!p.includes(item.id));data.totalBackups=data.backups.length;data.jobs.unshift(addJob('DELETE'));return ok(data.jobs[0]);}
   if(p.endsWith('/schedule')){schedules++;assert.equal(body.schedule.frequency,'WEEKLY');data.schedule={...body.schedule,nextRunAt:'2026-11-01T19:00:00Z'};data.jobs.unshift(addJob('SCHEDULE'));return ok(data.schedule);}
   if(p.endsWith('/restore')){assert.equal(body.confirmation,'CONFIRM');assert.equal(body.credentialsConfirmed,true);restores++;return route.fulfill({status:202,json:{success:true,data:{...addJob('RESTORE','QUEUED','PREPARING',0),monitorToken}}});}
   creates++;data.activeJob=addJob('BACKUP','RUNNING','MONGO_AI',40);data.jobs.unshift(data.activeJob);data.capability={...cap,canCreate:false,canRestore:false,canManageArchives:false,reason:'Đang có tác vụ sao lưu.'};return route.fulfill({status:202,json:{success:true,data:data.activeJob}});
  }
  return route.fulfill({status:503,json:{success:false,error:'Fixture: realtime unavailable'}});
 });
 await page.goto(server.resolvedUrls.local[0]+'?page=backups');await page.getByRole('heading',{name:'Sao lưu dữ liệu',exact:true}).waitFor();
 await page.evaluate(()=>{window.__backupBranchControl=document.querySelector('#branch');});
 const checkBranch=async()=>assert.equal(await page.evaluate(()=>window.__backupBranchControl===document.querySelector('#branch')),true,'backup must not replace shared branch control');
 const switchTab=async name=>{await page.locator(`.bk-tabs [data-backup=tab-${name}]`).click();};
 const menuAction=async(kind,index=0)=>{const menu=page.locator('.bk-row-menu').nth(index);if(!(await menu.getAttribute('open')))await menu.locator('summary').click();await menu.locator(`[data-backup=${kind}]`).click();};
 assert.equal(await page.locator('.bk-heading .eyebrow').count(),0);assert.equal(await page.locator('[data-backup=create]').count(),1);assert.equal(await page.locator('[data-backup-filter=from]').isVisible(),true);assert.equal(await page.locator('[data-backup-filter=to]').isVisible(),true);
 assert.equal(await page.locator('.bk-activity').count(),0);assert.match(await page.locator('.bk-storage').innerText(),/79%/);assert.equal(await page.locator('.bk-storage--normal').count(),1);assert.equal(await page.locator('.bk-settings-link').count(),0);
 assert.match(await page.locator('.bk-storage').innerText(),/Còn/);assert.equal(await page.locator('.bk-overview .bk-protection-notes').count(),0);assert.equal(await page.locator('.bk-archives [data-backup=restore]').count(),3);assert.equal(await page.locator('.bk-pagination nav').count(),1);
 await page.locator('.bk-record-link').first().click();await page.getByRole('region',{name:'Thông tin bản sao',exact:true}).waitFor();
 assert.match(await page.locator('.bk-archive-detail').innerText(),/tất cả chi nhánh/);assert.match(await page.locator('.bk-archive-detail').innerText(),/Không gồm ảnh cloud/);
 await page.locator('[data-backup=close-details]').click();
 await page.locator('.bk-row-menu').first().locator('summary').click();await page.locator('.bk-row-menu').nth(1).locator('summary').click();
 assert.equal(await page.locator('.bk-row-menu[open]').count(),1);await page.keyboard.press('Escape');assert.equal(await page.locator('.bk-row-menu[open]').count(),0);
 const layoutPosition=()=>page.evaluate(()=>['.bk-heading','.bk-overview','.bk-tabs'].map(selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {top:r.top+scrollY,height:r.height};}));
 const initialPositions=await layoutPosition();
 data.jobs=Array.from({length:10},(_,i)=>({id:`audit-${i}`,backupId:ids[i%3],operation:['BACKUP','RESTORE','DOWNLOAD','DELETE','SCHEDULE'][i%5],state:i%3===1?'FAILED':'COMPLETED',phase:'COMPLETED',progress:100,requestedBy:i+1,requestedByName:`Audit ${i}`,requestedAt:`2026-10-${31-i}T07:00:00Z`,message:i===1?'Fixture failure details':'Fixture completed',monitorToken:'SECRET_MONITOR',metadata:{code:'SECRET_MFA'}}));
 await switchTab('settings');await page.getByRole('heading',{name:'Cấu hình sao lưu',exact:true}).waitFor();
 assert.match(await page.locator('.bk-settings').innerText(),/ADMIN chính/);assert.equal(await page.locator('.bk-archives').count(),0);
 assert.deepEqual(await layoutPosition(),initialPositions,'settings retains overview and tab geometry');
 await checkBranch();await switchTab('activity');assert.equal(await page.locator('.bk-activity').count(),1);
 assert.deepEqual(await layoutPosition(),initialPositions,'activity retains overview and tab geometry');
 await page.locator('[data-backup=refresh]').click();await page.locator('[data-backup=audit-next]:not([disabled])').waitFor();
 await page.locator('[data-backup=audit-next]').click();await switchTab('archives');await switchTab('activity');assert.equal(await page.locator('[data-audit-page]').getAttribute('data-audit-page'),'2');
 await page.locator('[data-backup=audit-previous]').click();assert.equal(await page.locator('.bk-activity [data-backup=audit-next]').evaluate(el=>el.getBoundingClientRect().height),28);
 await page.locator('[data-backup-filter=auditQuery]').fill('Audit 1');
 await page.locator('[data-backup-filter=auditOperation]').selectOption('RESTORE');await page.locator('[data-backup-filter=auditState]').selectOption('FAILED');
 assert.equal(await page.locator('.bk-audit-open').count(),1);
 await page.locator('[data-backup-filter=auditQuery]').focus();await page.waitForTimeout(4300);
 assert.equal(await page.locator('[data-backup-filter=auditQuery]').inputValue(),'Audit 1');assert.equal(await page.evaluate(()=>document.activeElement.dataset.backupFilter),'auditQuery');
 const csvDownload=page.waitForEvent('download');await page.locator('[data-backup=export-audit]').click();const csvFile=await csvDownload;
 assert.match(csvFile.suggestedFilename(),/\.csv$/);const csv=await readFile(await csvFile.path(),'utf8');assert.equal(csv.split('\r\n').length,2);assert.ok(csv.includes('audit-1'));assert.ok(!csv.includes('SECRET_'));
 await page.locator('[data-backup=audit-details]').click();await page.locator('.bk-audit-detail h3').waitFor();assert.match(await page.locator('.bk-audit-detail').innerText(),/Fixture failure details/);
 await page.locator('[data-backup=close-audit-detail]').click();await page.locator('[data-backup=clear-audit]').click();
 await page.screenshot({path:'docs/ui/backup-activity-1440.png',fullPage:true});
 await switchTab('archives');assert.deepEqual(await layoutPosition(),initialPositions);

 // All filters are visible immediately and survive server polling.
 const originals=[...data.backups];data.backups.push(...Array.from({length:9},(_,i)=>({...originals[i%3],id:`extra-${i}`,requestedByName:`Tester ${i}`})));data.totalBackups=data.backups.length;
 await page.locator('[data-backup=refresh]').click();await page.waitForFunction(()=>document.querySelectorAll('.bk-row-menu').length===5);
 await page.getByRole('button',{name:'Trang sau',exact:true}).click();
 assert.match(await page.locator('.bk-pagination').innerText(),/Trang 2 \/ 3/);
 await page.getByRole('button',{name:'Trang cuối',exact:true}).click();assert.match(await page.locator('.bk-pagination').innerText(),/Trang 3 \/ 3/);assert.equal(await page.locator('.bk-row-menu').count(),2);
 await page.getByRole('button',{name:'Trang đầu',exact:true}).click();assert.match(await page.locator('.bk-pagination').innerText(),/Trang 1 \/ 3/);
 await page.locator('.bk-page-number[data-page="2"]').click();assert.match(await page.locator('.bk-pagination').innerText(),/Trang 2 \/ 3/);
 await page.waitForTimeout(4300);assert.equal(await page.evaluate(()=>document.activeElement?.classList.contains('bk-page-number')&&document.activeElement.dataset.page),'2');
 await page.locator('[data-backup-filter=query]').fill('Tester 8');assert.equal(await page.locator('.bk-row-menu').count(),1);
 await page.waitForTimeout(4300);assert.equal(await page.locator('[data-backup-filter=query]').inputValue(),'Tester 8');assert.equal(await page.locator('[data-backup-filter=from]').isVisible(),true);
 await page.locator('[data-backup-filter=type]').selectOption('MANUAL');await page.getByRole('heading',{name:'Không có bản sao phù hợp'}).waitFor();
 await page.locator('[data-backup=clear-filters]').click();await page.locator('[data-backup-filter=from]').fill('2026-11-01');await page.locator('[data-backup-filter=from]').dispatchEvent('change');await page.getByRole('heading',{name:'Không có bản sao phù hợp'}).waitFor();
 await page.locator('[data-backup=clear-filters]').click();
 await mkdir('docs/ui',{recursive:true});
 for(const width of [390,768,1024,1280,1440,1920,2560,3840]){
  await page.setViewportSize({width,height:1050});await page.evaluate(()=>window.scrollTo(0,0));
  const bounds=await page.locator('.backup-console').boundingBox();assert.ok(bounds.width<=1201);assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.equal(await page.locator('[data-backup=create]').count(),1);assert.equal(await page.locator('[data-backup=create]').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(24, 112, 67)');
  if(width===1440||width===390){
   const menu=reference.find(item=>item.role==='WAITER'&&item.width===width);
   const dimensions=await page.evaluate(()=>{const style=selector=>{const s=getComputedStyle(document.querySelector(selector));return {font:s.fontSize,radius:s.borderRadius,minHeight:s.minHeight};};return {button:style('[data-backup=create]'),input:style('[data-backup-filter=query]'),body:style('.backup-console'),name:style('.bk-archives td strong'),panel:style('.bk-table-frame')};});
   assert.equal(dimensions.button.font,menu.button.fontSize);assert.equal(dimensions.button.radius,menu.button.borderRadius);assert.equal(dimensions.button.minHeight,menu.button.minHeight);
   assert.equal(dimensions.input.font,width===390?'16px':'14px');assert.equal(dimensions.input.radius,menu.input.borderRadius);assert.equal(dimensions.input.minHeight,width===390?'40px':'36px');
   assert.equal(dimensions.body.font,menu.body.fontSize);assert.equal(dimensions.name.font,'12px');assert.equal(dimensions.panel.radius,'10px');
  }
  if(width>=1440){
   const overview=await page.locator('.bk-overview').boundingBox();assert.ok(overview.height>=140&&overview.height<=300,`overview height ${overview.height} at ${width}px`);
   const row=await page.locator('.bk-archives tbody tr').first().boundingBox();assert.ok(row.height>=59&&row.height<=90,`row height ${row.height}`);
   assert.equal(await page.locator('.bk-heading h1').evaluate(el=>getComputedStyle(el).fontSize),'24px');
   const filter=await page.locator('[data-backup-filter=from]').boundingBox(),refresh=await page.locator('[data-backup=refresh]').boundingBox();assert.ok(Math.abs(filter.y-refresh.y)<=1,'date fields and refresh share the toolbar baseline');
   assert.equal(await page.locator('.bk-page-number').first().evaluate(el=>el.getBoundingClientRect().height),28);
   for(const key of ['query','type','from','to','pageSize']){
    const field=page.locator(`[data-backup-filter=${key}]`);
    const idle=await field.evaluate(el=>{const s=getComputedStyle(el);return {border:s.borderColor,width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height};});
    await field.focus();
    const focused=await field.evaluate(el=>{const s=getComputedStyle(el),probe=document.createElement('span');probe.style.color='var(--focus-ring)';el.parentElement.append(probe);const expected=getComputedStyle(probe).color;probe.remove();return {border:s.borderColor,width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height,outline:s.outlineColor,style:s.outlineStyle,offset:s.outlineOffset,expected};});
    assert.equal(focused.border,idle.border,key);assert.equal(focused.width,idle.width,key);assert.equal(focused.height,idle.height,key);assert.equal(focused.style,'solid',key);assert.equal(focused.offset,'2px',key);assert.equal(focused.outline,focused.expected,key);
    await field.blur();
   }
  }
  const cards=await page.locator('.ui-metric').evaluateAll(els=>els.map(el=>({top:el.getBoundingClientRect().top,left:el.getBoundingClientRect().left,height:el.getBoundingClientRect().height})));
  if(width>=1440){assert.equal(new Set(cards.map(card=>card.top)).size,1);assert.equal(new Set(cards.map(card=>card.height)).size,1);}
  if(width===390)assert.equal(new Set(cards.map(card=>card.left)).size,2);
  const position=await layoutPosition();
  for(const tab of ['activity','settings','archives']){await switchTab(tab);assert.deepEqual(await layoutPosition(),position,`${tab} layout stable at ${width}`);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));if(width===1440&&tab==='settings')await page.screenshot({path:'docs/ui/backup-settings.png',fullPage:true});if(width===390&&tab!=='archives')await page.screenshot({path:`docs/ui/backup-${tab}-390.png`,fullPage:true});}
  if([390,1440,2560].includes(width))await page.screenshot({path:`docs/ui/backup-admin-${width}.png`,fullPage:true});
  const menu=page.locator('.bk-row-menu').first();await menu.locator('summary').click();
  for(const kind of ['restore','download','delete']){
   const rect=await menu.locator(`[data-backup=${kind}]`).boundingBox();assert.ok(rect.x>=0&&rect.x+rect.width<=width,`${kind} menu clipped at ${width}px`);assert.ok(rect.height>=(44));
  }
  assert.equal(await menu.locator('.bk-menu-danger [data-backup=download]').count(),0);
  if(width===1440)await page.screenshot({path:'docs/ui/backup-actions-menu.png',fullPage:true});
  await page.keyboard.press('Escape');
 }
 await page.setViewportSize({width:1920,height:1080});
 for(const zoom of [.67,.8,1.25]){
  await page.evaluate(value=>{document.body.style.zoom=String(value);},zoom);
  assert.ok(await page.locator('.backup-console').evaluate(el=>parseFloat(getComputedStyle(el).width)<=1200));
  assert.ok(await page.locator('[data-backup=create]').evaluate(el=>parseFloat(getComputedStyle(el).minHeight)>=44));
 }
 await page.evaluate(()=>{document.body.style.zoom='';});await page.setViewportSize({width:1440,height:1050});
 const oldFootprint=data.storage.backupBytes;data.backups=[{...originals[0],bytes:4094560}];data.totalBackups=1;data.storage.backupBytes=4100000;
 await page.locator('[data-backup=refresh]').click();await page.waitForFunction(()=>document.querySelectorAll('.bk-row-menu').length===1);
 assert.ok((await page.locator('.bk-archives').boundingBox()).height<300,'a single archive must not stretch the table card');
 assert.equal((await page.locator('.bk-row-menu>summary').innerText()).trim(),'⋯');
 await page.screenshot({path:'docs/ui/backup-admin-single.png',fullPage:true});
 await page.locator('.bk-row-menu>summary').click();assert.equal(await page.locator('.bk-row-menu [data-backup=delete]').isDisabled(),true);await page.keyboard.press('Escape');data.storage.backupBytes=oldFootprint;
 data.backups=originals;data.totalBackups=originals.length;await page.locator('[data-backup=refresh]').click();await page.waitForFunction(()=>document.querySelectorAll('.bk-row-menu').length===3);
 await checkBranch();
 // Destructive operations retain exact confirmation, fresh MFA and source-credential acknowledgement.
 await menuAction('restore');await page.locator('input[name=code]').fill('123456');await page.locator('input[name=credentialsConfirmed]').check();await page.locator('input[name=confirmation]').fill('confirm');assert.equal(await page.locator('dialog [type=submit]').isDisabled(),true);
 await page.locator('input[name=confirmation]').fill('CONFIRM');assert.equal(await page.locator('dialog [type=submit]').isDisabled(),false);await page.screenshot({path:'docs/ui/backup-restore-confirm.png'});await page.getByRole('button',{name:'Hủy',exact:true}).click();assert.equal(restores,0);
 await menuAction('delete',1);await page.locator('input[name=confirmation]').fill('CONFIRM');await page.locator('input[name=code]').fill('123456');await page.getByRole('button',{name:'Xóa bản sao lưu',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.bk-row-menu').length===2);assert.equal(deletes,1);
 await menuAction('download');await page.locator('input[name=code]').fill('123456');const download=page.waitForEvent('download');await page.getByRole('button',{name:'Tải file ZIP',exact:true}).click();assert.match((await download).suggestedFilename(),/\.zip$/);assert.equal(downloads,1);await page.locator('dialog').waitFor({state:'detached'});
 await switchTab('settings');await page.locator('.bk-settings [data-backup=schedule]').click();await page.locator('select[name=frequency]').selectOption('WEEKLY');await page.locator('input[name=code]').fill('123456');await page.getByRole('button',{name:'Lưu lịch trình',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.bk-settings')?.textContent.includes('Hằng tuần'));assert.equal(schedules,1);
 await switchTab('archives');
 await page.locator('[data-backup=create]').click();await page.locator('input[name=code]').fill('000000');await page.locator('dialog [type=submit]').click();await page.locator('.backup-create-error:not([hidden])').waitFor();assert.equal(await page.locator('input[name=code]').inputValue(),'');
 await page.locator('input[name=code]').fill('123456');await page.locator('dialog [type=submit]').click();await page.locator('.bk-running').waitFor();assert.match(await page.locator('.bk-running').innerText(),/40%/);assert.equal(await page.locator('[data-backup=create]').isDisabled(),true);assert.equal(creates,1);
 data.jobs[0]={...data.jobs[0],state:'COMPLETED',phase:'COMPLETED',progress:100};data.activeJob=null;data.capability={...cap};await page.locator('[data-backup=create]:not([disabled])').waitFor({timeout:7000});
 await menuAction('restore');await page.locator('input[name=confirmation]').fill('CONFIRM');await page.locator('input[name=credentialsConfirmed]').check();await page.locator('input[name=code]').fill('123456');await page.getByRole('button',{name:'Xác nhận khôi phục',exact:true}).click();
 await page.getByRole('heading',{name:'Đang khôi phục dữ liệu',exact:true}).waitFor();assert.match(await page.locator('.bk-running').innerText(),/28%/);assert.equal(restores,1);
 const beforeReload=bootstrap;await page.reload();await page.getByRole('heading',{name:'Đang khôi phục dữ liệu',exact:true}).waitFor();assert.equal(bootstrap,beforeReload);
 monitor={...monitor,state:'COMPLETED',phase:'COMPLETED',progress:100,maintenance:false,message:'Đã khôi phục. Cần đăng nhập lại.'};await page.getByRole('heading',{name:'Đã khôi phục dữ liệu',exact:true}).waitFor({timeout:7000});await page.getByRole('button',{name:'Đăng nhập lại',exact:true}).click();assert.equal(await page.evaluate(()=>sessionStorage.getItem('dusko_backup_restore_monitor')),null);
 expired=true;await page.evaluate(({id,token})=>sessionStorage.setItem('dusko_backup_restore_monitor',JSON.stringify({id,token})),{id:jobId,token:monitorToken});await page.reload();await page.getByRole('heading',{name:'Phiên theo dõi đã hết hạn',exact:true}).waitFor();await page.getByRole('button',{name:'Đăng nhập lại',exact:true}).click();assert.equal(await page.evaluate(()=>sessionStorage.getItem('dusko_backup_restore_monitor')),null);
 assert.deepEqual(errors,[]);console.log('PASS: single admin workspace, fixed overview and tabs, audit filters/details/CSV/pagination, honest settings, compact controls, shared-token focus, menus/details, settings/activity tabs, unchanged shared branch control, responsive/zoom, MFA/CONFIRM and restore monitoring');
}finally{await browser.close();await server.close();}
