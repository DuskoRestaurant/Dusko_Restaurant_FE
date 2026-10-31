// Uses only mocked APIs; never restores or deletes production data.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {createServer} from 'vite';
const {chromium}=createRequire(import.meta.url)('playwright');
const server=await createServer({configFile:false,server:{host:'127.0.0.1',port:0}});await server.listen();
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 const ids=[1,2,3].map(n=>`2026-10-31T00-00-00-000Z-${String(n).repeat(8)}-1111-4111-8111-111111111111`);
 const cap={enabled:true,canCreate:true,canRestore:true,canManageArchives:true,reason:null};
 const data={checkedAt:'2026-10-31T09:00:00Z',availability:'AVAILABLE',invalidCount:0,truncated:false,totalBackups:3,
  capability:{...cap},activeJob:null,jobs:[],schedule:{frequency:'DAILY',hour:2,minute:0,weekday:1,nextRunAt:'2026-10-31T19:00:00Z'},
  storage:{totalBytes:50*1024**3,usedBytes:15*1024**3,freeBytes:35*1024**3,backupBytes:2.3*1024**3,usagePercent:30},
  backups:ids.map((id,i)=>({id,createdAt:`2026-10-${31-i}T07:00:00Z`,bytes:1200000000-i*120000000,trigger:i?'AUTO':'MANUAL',requestedBy:1,requestedByName:'Nguyễn Quản Trị',imageProvider:'s3',canRestore:true}))};
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
 assert.match(await page.locator('.bk-storage').innerText(),/15 GB/);assert.equal(await page.locator('.bk-storage progress').getAttribute('value'),'30');
 assert.equal(await page.locator('[data-backup=restore]').count(),3);
 await mkdir('docs/ui',{recursive:true});
 for(const width of [1440,390]){await page.setViewportSize({width,height:1050});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:`docs/ui/backup-admin-${width}.png`,fullPage:true});}
 await page.setViewportSize({width:1440,height:1050});
 // Dangerous action stays disabled until exact confirmation plus MFA and credential acknowledgement.
 await page.locator('[data-backup=restore]').first().click();await page.locator('input[name=code]').fill('123456');await page.locator('input[name=credentialsConfirmed]').check();await page.locator('input[name=confirmation]').fill('confirm');
 assert.equal(await page.locator('dialog [type=submit]').isDisabled(),true);
 await page.locator('input[name=confirmation]').fill('CONFIRM');assert.equal(await page.locator('dialog [type=submit]').isDisabled(),false);
 await page.screenshot({path:'docs/ui/backup-restore-confirm.png'});await page.getByRole('button',{name:'Hủy',exact:true}).click();assert.equal(restores,0);
 await page.locator('[data-backup=delete]').nth(1).click();await page.locator('input[name=confirmation]').fill('CONFIRM');await page.locator('input[name=code]').fill('123456');await page.getByRole('button',{name:'Xóa bản sao lưu',exact:true}).click();
 await page.waitForFunction(()=>document.querySelectorAll('[data-backup=delete]').length===2);assert.equal(deletes,1);
 await page.locator('[data-backup=download]').first().click();await page.locator('input[name=code]').fill('123456');const download=page.waitForEvent('download');await page.getByRole('button',{name:'Tải file ZIP',exact:true}).click();assert.match((await download).suggestedFilename(),/\.zip$/);assert.equal(downloads,1);await page.locator('dialog').waitFor({state:'detached'});
 await page.locator('[data-backup=schedule]').click();await page.locator('select[name=frequency]').selectOption('WEEKLY');await page.locator('input[name=code]').fill('123456');await page.getByRole('button',{name:'Lưu lịch trình',exact:true}).click();await page.getByText('Hằng tuần',{exact:true}).waitFor();assert.equal(schedules,1);
 await page.locator('[data-backup=create]').click();await page.locator('input[name=code]').fill('000000');await page.locator('dialog [type=submit]').click();await page.locator('.backup-create-error:not([hidden])').waitFor();assert.equal(await page.locator('input[name=code]').inputValue(),'');
 await page.locator('input[name=code]').fill('123456');await page.locator('dialog [type=submit]').click();await page.locator('.bk-running').waitFor();assert.match(await page.locator('.bk-running').innerText(),/40%/);assert.equal(await page.locator('[data-backup=create]').isDisabled(),true);assert.equal(creates,1);
 data.jobs[0]={...data.jobs[0],state:'COMPLETED',phase:'COMPLETED',progress:100};data.activeJob=null;data.capability={...cap};
 await page.locator('[data-backup=create]:not([disabled])').waitFor({timeout:7000});
 await page.locator('[data-backup=restore]').first().click();await page.locator('input[name=confirmation]').fill('CONFIRM');await page.locator('input[name=credentialsConfirmed]').check();await page.locator('input[name=code]').fill('123456');await page.getByRole('button',{name:'Xác nhận khôi phục',exact:true}).click();
 await page.getByRole('heading',{name:'Đang khôi phục dữ liệu',exact:true}).waitFor();assert.match(await page.locator('.bk-running').innerText(),/28%/);assert.equal(restores,1);
 const beforeReload=bootstrap;await page.reload();await page.getByRole('heading',{name:'Đang khôi phục dữ liệu',exact:true}).waitFor();assert.equal(bootstrap,beforeReload);
 monitor={...monitor,state:'COMPLETED',phase:'COMPLETED',progress:100,maintenance:false,message:'Đã khôi phục. Cần đăng nhập lại.'};await page.getByRole('heading',{name:'Đã khôi phục dữ liệu',exact:true}).waitFor({timeout:7000});
 await page.getByRole('button',{name:'Đăng nhập lại',exact:true}).click();assert.equal(await page.evaluate(()=>sessionStorage.getItem('dusko_backup_restore_monitor')),null);
 expired=true;await page.evaluate(({id,token})=>sessionStorage.setItem('dusko_backup_restore_monitor',JSON.stringify({id,token})),{id:jobId,token:monitorToken});await page.reload();await page.getByRole('heading',{name:'Phiên theo dõi đã hết hạn',exact:true}).waitFor();await page.getByRole('button',{name:'Đăng nhập lại',exact:true}).click();assert.equal(await page.evaluate(()=>sessionStorage.getItem('dusko_backup_restore_monitor')),null);
 assert.deepEqual(errors,[]);console.log('PASS: measured storage, responsive archives, CONFIRM/MFA safeguards, ZIP download, delete, weekly schedule, backup progress, restore monitor through reload and session replacement');
}finally{await browser.close();await server.close();}
