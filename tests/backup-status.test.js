import test from 'node:test';
import assert from 'node:assert/strict';
import {backupStatusHtml} from '../src/backup-status.js';
import {backupArchiveView} from '../src/backup-console.js';
const base={availability:'AVAILABLE',checkedAt:'2026-10-31T00:00:00Z',backups:[],jobs:[]};
test('missing inventory never invents protection or capacity and keeps create disabled',()=>{
 for(const availability of ['NOT_FOUND','UNAVAILABLE','AVAILABLE']){
  const html=backupStatusHtml({...base,availability});
  assert.ok(html.includes('Chưa ghi nhận bản sao'));assert.ok(html.includes('chưa đọc được dung lượng'));
  assert.ok(html.includes('data-backup="create" disabled'));assert.ok(!html.includes('Hệ thống an toàn'));
 }
});
test('archive summary separates server usage from backup footprint and escapes metadata',()=>{
 const data={...base,capability:{canCreate:true,canRestore:true,canManageArchives:true},totalBackups:2,storage:{totalBytes:50*1024**3,usedBytes:15*1024**3,freeBytes:35*1024**3,backupBytes:1024**3,usagePercent:30},backups:[{id:'archive',createdAt:'2026-10-30T20:00:00Z',bytes:1048576,trigger:'AUTO',requestedByName:'<script>',imageProvider:'s3',canRestore:true}]};
 const html=backupStatusHtml(data);
 for(const text of ['Dung lượng máy chủ','Kho backup: 1 GB','Còn 35 GB','value="30"','Tự động','&lt;script&gt;','data-backup="restore"','data-backup="download"','data-backup="delete"'])assert.ok(html.includes(text),text);
 assert.equal((html.match(/data-backup="create"/g)||[]).length,1);
 assert.ok(!html.includes('bk-workspace'));assert.ok(!html.includes('class="bk-activity"'));
 const settings=backupStatusHtml(data,{tab:'settings'});
 for(const text of ['15 GB / 50 GB','Chưa cấu hình','ADMIN chính','tất cả chi nhánh','Không gồm source code'])assert.ok(settings.includes(text),text);
 const detail=backupStatusHtml(data,{detailId:'archive'});assert.ok(detail.includes('Không gồm ảnh cloud'));assert.ok(detail.includes('SAFETY'));
});
test('active progress and failures are shown without a blanket safety claim',()=>{
 const data={...base,backups:[{createdAt:'2026-10-29T00:00:00Z',bytes:1}],activeJob:{state:'RUNNING',operation:'RESTORE',phase:'RESTORE_SQL',progress:28},capability:{canCreate:false},jobs:[{operation:'DELETE',state:'FAILED',requestedAt:base.checkedAt,requestedByName:'<private>',message:'<error>'}]};
 const html=backupStatusHtml(data);assert.ok(html.includes('28%'));assert.ok(html.includes('Khôi phục PostgreSQL'));assert.ok(html.includes('Khôi phục đang chạy'));assert.ok(!html.includes('Hệ thống an toàn'));
 const activity=backupStatusHtml(data,{tab:'activity'});assert.ok(activity.includes('&lt;private&gt;'));assert.ok(activity.includes('&lt;error&gt;'));assert.ok(!activity.includes('class="bk-archives"'));
});
test('archive filters combine text/type and inclusive Vietnam dates before pagination',()=>{
 const records=Array.from({length:12},(_,i)=>({id:`id-${i}`,requestedByName:'Nguyễn Quản Trị',trigger:i%2?'AUTO':'MANUAL',createdAt:'2026-10-31T16:59:59Z'}));
 records.push({id:'next-day',requestedByName:'Other',trigger:'AUTO',createdAt:'2026-10-31T17:00:00Z'});
 assert.equal(backupArchiveView(records,{query:'nguyễn',type:'AUTO',from:'2026-11-01',to:'2026-11-01'}).total,0);
 const result=backupArchiveView(records,{query:'quản',type:'AUTO',from:'2026-10-31',to:'2026-10-31',page:2,pageSize:5});
 assert.equal(result.total,6);assert.equal(result.pages,2);assert.equal(result.items[0].id,'id-11');
 assert.equal(backupArchiveView(records,{from:'2026-11-01',to:'2026-11-01'}).items[0].id,'next-day');
 assert.equal(backupArchiveView(records,{query:'missing',page:999}).page,1);assert.equal(backupArchiveView(records,{page:999}).page,3);
});
test('storage alerts only trigger at measured thresholds and never promise next-run capacity',()=>{
 for(const [usagePercent,tone] of [[74,'normal'],[75,'warning'],[79,'warning'],[89,'warning'],[90,'danger'],[100,'danger']]){
  const html=backupStatusHtml({...base,storage:{usagePercent}});assert.ok(html.includes(`bk-storage--${tone}`));assert.ok(html.includes(`value="${usagePercent}"`));assert.equal(html.includes('Kiểm tra dung lượng trống'),usagePercent>=75);
 }
 assert.ok(!backupStatusHtml(base).includes('Kiểm tra dung lượng trống'));
});
test('locks, filtered emptiness, truncation and protection limits remain truthful',()=>{
 const data={...base,truncated:true,capability:{canManageArchives:true,canRestore:true},totalBackups:30,backups:[{id:'a',createdAt:base.checkedAt,canRestore:true}],activeJob:{state:'RUNNING',progress:12}};
 const html=backupStatusHtml(data);assert.ok(html.includes('data-backup="delete" data-archive-id="a" disabled'));assert.ok(html.includes('Bộ lọc chỉ áp dụng cho các bản đã tải'));
 assert.ok(backupStatusHtml(data,{query:'not-found'}).includes('Không có bản sao phù hợp'));
 assert.ok(html.includes('Thiết lập lịch'));assert.ok(html.includes('Chưa có kết quả kiểm chứng khôi phục'));assert.ok(html.includes('Chưa ghi nhận bản sao ngoài máy chủ'));
});
