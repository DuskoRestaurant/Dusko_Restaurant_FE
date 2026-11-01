import test from 'node:test';
import assert from 'node:assert/strict';
import {backupStatusHtml} from '../src/backup-console.js';
import {backupAuditView,backupAuditCsv} from '../src/backup-management.js';

const jobs=Array.from({length:10},(_,i)=>({id:`job-${i}`,backupId:`archive-${i}`,operation:i%2?'SCHEDULE':'BACKUP',requestedByName:i%2?'Quản trị':'Vận hành',requestedAt:`2026-10-${20+i}T12:00:00Z`,state:i%3?'COMPLETED':'FAILED'}));
test('audit filters combine operation, actor and result before pagination and sort newest first',()=>{
 const result=backupAuditView(jobs,{auditQuery:'vận',auditOperation:'BACKUP',auditState:'COMPLETED'});
 assert.deepEqual(result.items.map(job=>job.id),['job-8','job-4','job-2']);
 assert.equal(backupAuditView(jobs,{auditPage:2}).items[0].id,'job-4');
 assert.equal(backupAuditView(jobs,{auditQuery:'missing',auditPage:999}).page,1);
 assert.equal(backupAuditView(jobs,{auditPage:999}).page,2);
 assert.equal(backupAuditView(jobs,{auditOperation:'RESTORE'}).total,0);
});
test('CSV exports the entire filtered set, escapes quotes and neutralizes formulas; private metadata is excluded',()=>{
 const data=[...jobs,{id:'job-extra',backupId:'archive-extra',operation:'BACKUP',requestedByName:' \t=HYPERLINK("bad")',requestedAt:'2026-10-31',state:'COMPLETED',monitorToken:'SECRET_TOKEN',code:'SECRET_MFA',metadata:{password:'SECRET_PASSWORD'},message:'SECRET_MESSAGE'}];
 const csv=backupAuditCsv(data,{auditOperation:'BACKUP',auditPage:2});
 assert.ok(csv.startsWith('\uFEFF'));assert.equal(csv.split('\r\n').length,7);
 assert.ok(csv.includes("' \t=HYPERLINK("));assert.ok(csv.includes('""bad""'));
 assert.ok(!csv.includes('SECRET_'));assert.ok(!csv.includes('Thay đổi lịch'));
 assert.equal(backupAuditCsv(jobs,{auditQuery:'missing'}).split('\r\n').length,1);
});
test('all tabs retain one overview with four metrics; unsupported settings never imply saved configuration',()=>{
 const data={checkedAt:'2026-11-01',availability:'AVAILABLE',capability:{canCreate:true,canManageArchives:true},jobs,backups:[]};
 for(const tab of ['archives','activity','settings']){
  const html=backupStatusHtml(data,{tab});
  assert.equal((html.match(/class="ui-metric /g)||[]).length,4);
  assert.ok(html.indexOf('bk-metric-grid')<html.indexOf('class="bk-tabs"'));
  assert.equal((html.match(/data-backup="create"/g)||[]).length,1);
 }
 const settings=backupStatusHtml(data,{tab:'settings'});
 assert.ok(settings.includes('Chưa có tự động xóa bản cũ'));assert.ok(settings.includes('chưa tích hợp gửi backup'));
 assert.ok(!settings.includes('role="switch"'));assert.ok(!settings.includes('value="30"'));
});
test('audit details render only public fields and safely escape server messages',()=>{
 const job={...jobs[0],id:'<job>',requestedByName:'<actor>',message:'<script>bad</script>',monitorToken:'SECRET_TOKEN'};
 const html=backupStatusHtml({jobs:[job]},{tab:'activity',auditDetailId:'<job>'});
 assert.ok(html.includes('&lt;actor&gt;'));assert.ok(html.includes('&lt;script&gt;bad&lt;/script&gt;'));
 assert.ok(!html.includes('SECRET_TOKEN'));assert.ok(!html.includes('<script>'));
 assert.ok(html.includes('tối đa 10 tác vụ gần nhất'));
});
