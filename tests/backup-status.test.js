import test from 'node:test';
import assert from 'node:assert/strict';
import {backupStatusHtml} from '../src/backup-status.js';
const base={availability:'AVAILABLE',checkedAt:'2026-10-31T00:00:00Z',backups:[],jobs:[]};
test('missing inventory has no invented quota or safety claim and keeps actions disabled',()=>{
 for(const availability of ['NOT_FOUND','UNAVAILABLE','AVAILABLE']){
  const html=backupStatusHtml({...base,availability});
  assert.ok(html.includes('Chưa ghi nhận bản sao'));
  assert.ok(html.includes('chưa đọc được dung lượng'));
  assert.ok(html.includes('data-backup="create" disabled'));
  assert.ok(!html.includes('Hệ thống an toàn'));
 }
});
test('storage meter uses measured quota; archive actions, destination state and escaped actors are visible',()=>{
 const html=backupStatusHtml({...base,capability:{canCreate:true,canRestore:true,canManageArchives:true},totalBackups:2,storage:{totalBytes:50*1024**3,usedBytes:15*1024**3,freeBytes:35*1024**3,backupBytes:1024**3,usagePercent:30},
 backups:[{id:'archive',createdAt:'2026-10-30T20:00:00Z',bytes:1048576,trigger:'AUTO',requestedByName:'<script>',imageProvider:'s3',canRestore:true}]});
 for(const text of ['15 GB','50 GB','value="30"','Tự động','&lt;script&gt;','Không gồm ảnh cloud','data-backup="restore"','data-backup="download"','data-backup="delete"','Nhật ký hoạt động','Chưa cấu hình'])assert.ok(html.includes(text),text);
 assert.ok(!html.includes('data-backup="create" disabled'));
});
test('active progress is a real bounded value and stale records do not show a green system claim',()=>{
 const html=backupStatusHtml({...base,backups:[{createdAt:'2026-10-29T00:00:00Z',bytes:1}],activeJob:{state:'RUNNING',operation:'RESTORE',phase:'RESTORE_SQL',progress:28},capability:{canCreate:false},jobs:[{operation:'DELETE',state:'FAILED',requestedAt:base.checkedAt,requestedByName:'<private>'}]});
 assert.ok(html.includes('28%'));assert.ok(html.includes('Khôi phục PostgreSQL'));
 assert.ok(html.includes('Cần bản sao mới'));assert.ok(html.includes('&lt;private&gt;'));
 assert.ok(!html.includes('Hệ thống an toàn'));
});
