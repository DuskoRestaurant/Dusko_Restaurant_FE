import test from 'node:test';
import assert from 'node:assert/strict';
import { request, ApiError, money, escapeHtml } from './api.js';

test('request sends JSON and bearer token, reads data', async () => {
  const result = await request('/api/orders', { method: 'POST', body: { branchId: 1 }, token: 'abc', fetcher: async (url, options) => {
    assert.equal(url, '/api/orders'); assert.equal(options.headers.Authorization, 'Bearer abc');
    assert.deepEqual(JSON.parse(options.body), { branchId: 1 });
    return { ok: true, json: async () => ({ success: true, data: { id: 1 } }) };
  }});
  assert.deepEqual(result, { id: 1 });
});

test('request surfaces backend errors', async () => {
  await assert.rejects(request('/api/auth/login', { fetcher: async () => ({ ok: false, status: 401, json: async () => ({ success: false, error: 'Sai mật khẩu' }) }) }), error => error instanceof ApiError && error.status === 401 && /Sai mật khẩu/.test(error.message));
  await assert.rejects(request('/api/orders', { fetcher: async () => { throw new TypeError('Failed to fetch'); } }), TypeError);
});

test('display helpers format and escape values', () => {
  assert.match(money(120000), /120.000/);
  assert.equal(escapeHtml('<script>'), '&lt;script&gt;');
});
