// Mocked APIs: exercises real management navigation without accessing a database.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'vite';
const { chromium } = createRequire(import.meta.url)('playwright');
const server = await createServer({ configFile: false, server: { host: '127.0.0.1', port: 0 } });
await server.listen();
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const data = { checkedAt: '2026-10-31T00:00:00Z', availability: 'AVAILABLE', backups: [
    { createdAt: '2026-10-29T00:00:00Z', bytes: 2400000, artifactCount: 21, imageProvider: 's3' }
  ], invalidCount: 1, truncated: false, capability:{canCreate:true,enabled:true,reason:null}, jobs:[], activeJob:null };
  let reads = 0, posts = 0;
  await page.addInitScript(() => {
    sessionStorage.setItem('dusko_token', 'mock-token');
    sessionStorage.setItem('dusko_user', JSON.stringify({ id: 1, role: 'ADMIN', fullName: 'Quản trị viên' }));
  });
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    let result;
    if (path === '/api/bootstrap') result = { user: { id: 1, role: 'ADMIN', fullName: 'Quản trị viên' }, page: 'backups', branchId: 1,
      branches: [{ id: 1, name: 'Dusko' }], resources: {}, revision: 1 };
    else if (path === '/api/admin/backups') {
      if (route.request().method() === 'POST') {
        posts++;
        const {code}=route.request().postDataJSON();
        if (code === '000000') return route.fulfill({status:400,json:{success:false,error:'Mã Authenticator không đúng hoặc đã được dùng.'}});
        assert.equal(code,'123456');
        data.activeJob={id:'test-job',state:'RUNNING',phase:'POSTGRES',requestedAt:data.checkedAt,requestedBy:1};
        data.jobs=[data.activeJob]; data.capability={canCreate:false,enabled:true,reason:'Đang có một tác vụ backup.'};
        return route.fulfill({status:202,json:{success:true,data:data.activeJob}});
      }
      result = data; reads++;
    }
    else return route.fulfill({ status: 503, json: { success: false, error: 'Mock: realtime unavailable' } });
    return route.fulfill({ json: { success: true, data: result } });
  });
  await page.goto(server.resolvedUrls.local[0] + '?page=backups');
  await page.getByRole('heading', { name: 'Sao lưu dữ liệu', exact: true }).waitFor();
  assert.equal(await page.locator('[data-page=backups]').count(), 1);
  assert.match(await page.locator('#page').innerText(), /quá 24 giờ/);
  assert.match(await page.locator('#page').innerText(), /S3 · chưa sao lưu ảnh/);
  await page.getByRole('button',{name:'Tạo backup ngay',exact:true}).click();
  await page.locator('input[name=code]').fill('000000');
  await page.getByRole('button',{name:'Xác nhận tạo backup',exact:true}).click();
  await page.locator('.backup-create-error:not([hidden])').waitFor();
  assert.equal(await page.locator('input[name=code]').inputValue(),'');
  await page.locator('input[name=code]').fill('123456');
  await page.getByRole('button',{name:'Xác nhận tạo backup',exact:true}).click();
  await page.locator('.backup-job').waitFor();
  assert.match(await page.locator('.backup-job').innerText(), /Đang sao lưu/);
  assert.equal(await page.locator('[data-backup=create]').isDisabled(),true);
  assert.equal(posts,2);
  await mkdir('docs/ui', { recursive: true });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: `docs/ui/backup-admin-${width}.png`, fullPage: true });
  }
  data.jobs[0]={...data.jobs[0],state:'COMPLETED',phase:'COMPLETED',message:'Đã tạo bản sao lưu. Chưa kiểm chứng khôi phục.'};
  data.activeJob=null; data.capability={enabled:true,canCreate:true,reason:null};
  await page.getByRole('heading',{name:'Đã tạo backup',exact:true}).waitFor({timeout:7000});
  assert.equal(await page.locator('[data-backup=create]').isDisabled(),false);
  data.availability = 'NOT_FOUND'; data.backups = []; data.invalidCount = 0;
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await page.getByText('Chưa kết nối thư mục sao lưu', { exact: true }).waitFor();
  assert.ok(reads >= 2);
  assert.match(await page.locator('#page').innerText(), /chưa kết luận hệ thống không có backup/);
  assert.deepEqual(errors, []);
  await page.getByRole('button',{name:'Tạo backup ngay',exact:true}).click();
  await page.locator('dialog.backup-confirm').waitFor();
  await page.locator('[data-page=overview]').evaluate(button=>button.click());
  await page.locator('dialog.backup-confirm').waitFor({state:'detached'});
  await page.waitForTimeout(100);
  assert.deepEqual(errors, []);
  console.log('PASS: MFA error/retry, queued versus completed, disabled duplicate creation, polling, cleanup, inventory states, 1440/390px layout');
} finally { await browser.close(); await server.close(); }
