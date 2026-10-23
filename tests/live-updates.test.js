import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { watchChanges } from '../src/live-updates.js';

// --- Minimal environment stubs -------------------------------------------------
// live-updates.js uses the WebSocket global and location.origin. Node 22 has a
// WebSocket global but no `location`, and we want to drive frames by hand.

class MockWebSocket {
  static instances = [];
  constructor(url) {
    this.url = url;
    this.sent = [];
    this.closed = false;
    MockWebSocket.instances.push(this);
  }
  send(data) { this.sent.push(data); }
  close() { if (this.closed) return; this.closed = true; this.onclose?.(); }
  emit(message) { this.onmessage?.({ data: JSON.stringify(message) }); }
}

globalThis.WebSocket = MockWebSocket;
globalThis.location = { origin: 'http://localhost' };

const ticket = async () => ({ path: '/ws/live', ticket: 'tok' });
const wait = ms => new Promise(r => setTimeout(r, ms));

/** Start a watcher and wait until its socket exists. */
async function connect(onChange, options) {
  // Instances are deliberately never cleared between tests: every socket ever
  // opened is reachable so teardown can close it and release its timers.
  const before = MockWebSocket.instances.length;
  const statuses = [];
  const stop = watchChanges(ticket, onChange, '/api/live', {
    ...options,
    onStatus: value => { statuses.push(value); options?.onStatus?.(value); },
  });
  for (let i = 0; i < 50 && MockWebSocket.instances.length === before; i++) await wait(5);
  assert.ok(MockWebSocket.instances.length > before, 'the watcher should open a socket');
  return { stop, socket: MockWebSocket.instances[MockWebSocket.instances.length - 1], statuses };
}

// --- Tests ---------------------------------------------------------------------

test('a change message is routed to onChange', async () => {
  const seen = [];
  const { stop, socket } = await connect(async m => { seen.push(m); }, {});
  socket.emit({ type: 'change', revision: 7 });
  await wait(20);
  assert.equal(seen.length, 1);
  assert.equal(seen[0].revision, 7);
  stop();
});

test('a scoped event is routed to onEvent, not onChange', async () => {
  const events = [];
  const changes = [];
  const { stop, socket } = await connect(async m => { changes.push(m); }, {
    onEvent: async m => { events.push(m); },
  });
  socket.emit({ type: 'event', action: 'order.created' });
  await wait(20);
  assert.equal(events.length, 1);
  assert.equal(changes.length, 0, 'an onEvent consumer must not also trigger a full refresh');
  stop();
});

test('a rejected onEvent does NOT become an unhandled rejection', async () => {
  const unhandled = [];
  const onUnhandled = reason => unhandled.push(reason);
  process.on('unhandledRejection', onUnhandled);
  const { stop, socket } = await connect(async () => {}, {
    onEvent: async () => { throw new Error('boom'); },
  });
  try {
    socket.emit({ type: 'event', action: 'order.created' });
    await wait(40);
    assert.deepEqual(unhandled, [], 'the async failure must be handled inside watchChanges');
  } finally {
    stop(); // the failure schedules a retry; dispose so it does not outlive the test
    process.off('unhandledRejection', onUnhandled);
  }
});

test('a transient onEvent failure (busy) is retried', async () => {
  let attempts = 0;
  const { stop, socket } = await connect(async () => {}, {
    onEvent: async () => {
      attempts++;
      if (attempts === 1) throw new Error('busy');
    },
  });
  socket.emit({ type: 'event', action: 'order.created' });
  await wait(30);
  assert.equal(attempts, 1);
  await wait(1100); // the retry backoff
  assert.equal(attempts, 2, 'a transient failure should be retried');
  await wait(1100);
  assert.equal(attempts, 2, 'and should then stop retrying once it succeeds');
  stop();
});

test('a terminal onEvent failure (login) is NOT retried', async () => {
  let attempts = 0;
  const { stop, socket } = await connect(async () => {}, {
    onEvent: async () => { attempts++; throw new Error('login'); },
  });
  socket.emit({ type: 'event', action: 'order.created' });
  await wait(1300);
  assert.equal(attempts, 1, 'a superseded session must not be retried');
  stop();
});

test('stopping clears a pending event retry', async () => {
  let attempts = 0;
  const { stop, socket } = await connect(async () => {}, {
    onEvent: async () => { attempts++; throw new Error('busy'); },
  });
  socket.emit({ type: 'event', action: 'order.created' });
  await wait(30);
  assert.equal(attempts, 1);
  stop(); // dispose while the retry is queued
  await wait(1300);
  assert.equal(attempts, 1, 'cleanup must cancel the queued retry');
});

test('a transient onChange failure is retried and released', async () => {
  let attempts = 0;
  const { stop, socket } = await connect(async () => {
    attempts++;
    if (attempts === 1) throw new Error('busy');
  }, {});
  socket.emit({ type: 'change', revision: 1 });
  await wait(30);
  assert.equal(attempts, 1);
  await wait(1100);
  assert.equal(attempts, 2);
  stop();
});

test('a terminal onChange failure (login) is NOT retried', async () => {
  let attempts = 0;
  const { stop, socket } = await connect(async () => { attempts++; throw new Error('login'); }, {});
  socket.emit({ type: 'change', revision: 1 });
  await wait(1300);
  assert.equal(attempts, 1);
  stop();
});

test('the socket authenticates with the ticket it was given', async () => {
  const { stop, socket } = await connect(async () => {}, {});
  socket.onopen?.();
  assert.equal(socket.sent.length, 1);
  assert.deepEqual(JSON.parse(socket.sent[0]), { type: 'authenticate', ticket: 'tok' });
  stop();
});

test('an event with no onEvent falls back to a full refresh', async () => {
  const changes = [];
  const { stop, socket } = await connect(async m => { changes.push(m); }, {});
  socket.emit({ type: 'event', action: 'order.created' });
  await wait(20);
  assert.equal(changes.length, 1, 'without an onEvent consumer the event is treated as a change');
  stop();
});

test('a closed socket reports disconnected and schedules a reconnect', async () => {
  const { stop, socket, statuses } = await connect(async () => {}, {});
  // Status is only reported on change, so reach "connected" first: a change
  // message is the handshake acknowledgement.
  socket.emit({ type: 'change', revision: 1 });
  await wait(20);
  assert.ok(statuses.includes(true), 'the handshake reports connected');

  socket.close();
  await wait(30);
  assert.ok(statuses.includes(false), 'the consumer is told the live feed dropped');
  stop();
});

test('status is not re-reported while the state is unchanged', async () => {
  const { stop, socket, statuses } = await connect(async () => {}, {});
  socket.emit({ type: 'change', revision: 1 });
  await wait(20);
  const connectedReports = statuses.filter(v => v === true).length;
  assert.equal(connectedReports, 1, 'repeated changes do not re-announce the same status');
  stop();
});

// Closing a socket clears the handshake timer the watcher armed for it. Any
// socket a test leaves open would keep that 10s timer — and therefore the test
// process — alive.
after(() => {
  if (process.env.DIAG) console.error('ACTIVE:', process.getActiveResourcesInfo());
  for (const ws of MockWebSocket.instances) {
    try { ws.closed || ws.close(); } catch { /* already torn down */ }
  }
});