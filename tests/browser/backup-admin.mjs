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
  ], invalidCount: 1, truncated: false };
  let reads = 0;
  await page.addInitScript(() => {
    sessionStorage.setItem('dusko_token', 'mock-token');
    sessionStorage.setItem('dusko_user', JSON.stringify({ id: 1, role: 'ADMIN', fullName: 'Quản trị viên' }));
  });
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    let result;
    if (path === '/api/bootstrap') result = { user: { id: 1, role: 'ADMIN', fullName: 'Quản trị viên' }, page: 'backups', branchId: 1,
      branches: [{ id: 1, name: 'Dusko' }], resources: {}, revision: 1 };
    else if (path === '/api/admin/backups') { result = data; reads++; }
    else return route.fulfill({ status: 503, json: { success: false, error: 'Mock: realtime unavailable' } });
    return route.fulfill({ json: { success: true, data: result } });
  });
  await page.goto(server.resolvedUrls.local[0] + '?page=backups');
  await page.getByRole('heading', { name: 'Sao lưu dữ liệu', exact: true }).waitFor();
  assert.equal(await page.locator('[data-page=backups]').count(), 1);
  assert.match(await page.locator('#page').innerText(), /quá 24 giờ/);
  assert.match(await page.locator('#page').innerText(), /S3 · chưa sao lưu ảnh/);
  await mkdir('docs/ui', { recursive: true });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: `docs/ui/backup-admin-${width}.png`, fullPage: true });
  }
  data.availability = 'NOT_FOUND'; data.backups = []; data.invalidCount = 0;
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await page.getByText('Chưa kết nối thư mục sao lưu', { exact: true }).waitFor();
  assert.ok(reads >= 2);
  assert.match(await page.locator('#page').innerText(), /chưa kết luận hệ thống không có backup/);
  assert.deepEqual(errors, []);
  console.log('PASS: ADMIN deep link/navigation, stale/cloud/empty states, refresh, 1440/390px layout');
} finally { await browser.close(); await server.close(); }
