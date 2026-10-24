import test from 'node:test';
import assert from 'node:assert/strict';
import { createSingleFlight } from '../src/single-flight.js';

test('a single call runs the work once and resolves with its result', async () => {
  const run = createSingleFlight();
  let calls = 0;
  const result = await run('a', async () => { calls++; return 'receipt'; });
  assert.equal(result, 'receipt');
  assert.equal(calls, 1);
});

test('repeated calls while a request is pending collapse onto one request', async () => {
  const run = createSingleFlight();
  let calls = 0;
  let release;
  const gate = new Promise(resolve => { release = resolve; });

  // Three "clicks" before the first request settles.
  const first = run('order:1', async () => { calls++; await gate; return 'ok'; });
  const second = run('order:1', async () => { calls++; return 'duplicate'; });
  const third = run('order:1', async () => { calls++; return 'duplicate'; });

  release('done');
  const [a, b, c] = await Promise.all([first, second, third]);

  assert.equal(calls, 1, 'the mutating request must only be issued once');
  assert.equal(a, 'ok');
  assert.equal(b, 'ok', 'later callers await the in-flight result, not their own');
  assert.equal(c, 'ok');
});

test('different keys do not block each other', async () => {
  const run = createSingleFlight();
  let calls = 0;
  const release = [];
  const one = run('order:1', async () => { calls++; await new Promise(r => release.push(r)); return 1; });
  const two = run('order:2', async () => { calls++; await new Promise(r => release.push(r)); return 2; });
  assert.equal(calls, 2, 'distinct receipts are independent requests');
  assert.equal(run.size(), 2);
  release.forEach(r => r());
  assert.deepEqual(await Promise.all([one, two]), [1, 2]);
});

test('a failed call settles and does not leave the key stuck', async () => {
  const run = createSingleFlight();
  let calls = 0;
  const failed = await run('order:1', async () => { calls++; throw new Error('offline'); })
    .then(() => 'resolved', error => error.message);
  assert.equal(failed, 'offline');
  assert.equal(run.pending('order:1'), false, 'the in-flight entry is released on failure');
});

test('a retry after a genuine failure is allowed and succeeds', async () => {
  const run = createSingleFlight();
  let calls = 0;
  const attempt = () => run('order:1', async () => {
    calls++;
    if (calls === 1) throw new Error('timeout');
    return 'receipt';
  });

  assert.equal(await attempt().catch(e => e.message), 'timeout');
  assert.equal(await attempt(), 'receipt', 'the retry must issue a fresh request');
  assert.equal(calls, 2);
});

test('a rejected call does not surface as an unhandled rejection', async () => {
  const run = createSingleFlight();
  const seen = [];
  const onUnhandled = reason => seen.push(reason);
  process.on('unhandledRejection', onUnhandled);
  try {
    // Deliberately ignore the returned promise, as a fire-and-forget caller would.
    run('order:1', async () => { throw new Error('boom'); });
    await new Promise(resolve => setTimeout(resolve, 30));
    assert.deepEqual(seen, [], 'the internal release handler must absorb the rejection');
  } finally {
    process.off('unhandledRejection', onUnhandled);
  }
});

test('after settling, a later click starts a new request', async () => {
  const run = createSingleFlight();
  let calls = 0;
  await run('order:1', async () => { calls++; return 1; });
  await run('order:1', async () => { calls++; return 2; });
  assert.equal(calls, 2, 'sequential requests are not collapsed — only concurrent ones are');
  assert.equal(run.pending('order:1'), false);
});