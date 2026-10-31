import test from 'node:test';
import assert from 'node:assert/strict';
import { backupStatusHtml } from '../src/backup-status.js';

test('missing and unavailable inventory never claims no backups exist or restore success', () => {
  for (const availability of ['NOT_FOUND', 'UNAVAILABLE', 'AVAILABLE']) {
    const html = backupStatusHtml({ availability, checkedAt: '2026-10-31T00:00:00Z', backups: [] });
    assert.match(html, /chưa kết luận hệ thống không có backup/);
    assert.match(html, /Chưa có thao tác khôi phục trực tiếp/);
    assert.match(html, /data-backup="create" disabled/);
    assert.doesNotMatch(html, /Đã kiểm chứng khôi phục/);
  }
});

test('ready state enables creation and running/failed jobs do not claim restore success', () => {
  const base = { availability:'AVAILABLE', checkedAt:'2026-10-31T00:00:00Z', backups:[], capability:{canCreate:true} };
  assert.doesNotMatch(backupStatusHtml(base), /data-backup="create" disabled/);
  const html = backupStatusHtml({...base, capability:{canCreate:false,reason:'Đang sao lưu'}, activeJob:{id:'job-1',state:'RUNNING',phase:'POSTGRES',requestedAt:base.checkedAt,requestedBy:1},
    jobs:[{id:'old',state:'FAILED',phase:'MONGO_APP',requestedAt:base.checkedAt,requestedBy:2,message:'<private>'}]});
  assert.match(html,/Đang sao lưu/); assert.match(html,/Thất bại/); assert.match(html,/&lt;private&gt;/);
  assert.doesNotMatch(html, /Đã kiểm chứng khôi phục/);
});

test('old backups are flagged, untrusted labels escaped, cloud coverage and limits visible', () => {
  const html = backupStatusHtml({ availability: 'AVAILABLE', checkedAt: '2026-10-31T00:00:00Z', invalidCount: 2, truncated: true,
    backups: [{ createdAt: '2026-10-29T00:00:00Z', bytes: 1048576, artifactCount: '<script>', imageProvider: 's3' }] });
  assert.match(html, /quá 24 giờ/);
  assert.match(html, /1 MB/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /S3 · chưa sao lưu ảnh/);
  assert.match(html, /Chưa xác minh trên dashboard/);
  assert.match(html, /Danh sách đã được giới hạn/);
});
