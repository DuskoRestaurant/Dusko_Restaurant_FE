import test from 'node:test';
import assert from 'node:assert/strict';
import { EVENT_TARGETS, eventTarget, targetsFor, isServiceCall } from '../src/live-events.js';

test('every scoped backend action maps to a screen', () => {
  assert.equal(eventTarget('cart.updated'), 'cart');
  assert.equal(eventTarget('order.confirmed'), 'orders');
  assert.equal(eventTarget('service.request'), 'service');
  assert.equal(eventTarget('table.session.closed'), 'session');
  assert.equal(eventTarget('inventory.changed'), 'inventory');
  assert.equal(eventTarget('presence.changed'), 'presence');
});

test('an unknown action is ignored instead of forcing a refresh', () => {
  assert.equal(eventTarget('something.unknown'), 'none');
  assert.deepEqual(targetsFor(['something.unknown']), []);
});

test('a batch of events produces the distinct screens to refresh', () => {
  assert.deepEqual(targetsFor(['cart.updated', 'order.created', 'cart.updated']), ['cart', 'orders']);
  assert.deepEqual(targetsFor([]), []);
});

test('only a guest call is treated as a service call', () => {
  assert.equal(isServiceCall('service.request'), true);
  assert.equal(isServiceCall('service.resolved'), false);
});

test('the action table covers every event the backend publishes', () => {
  for (const action of ['cart.updated', 'order.created', 'order.confirmed', 'order.rejected', 'order.served',
    'service.request', 'service.resolved', 'table.session.opened', 'table.session.closed', 'inventory.changed', 'presence.changed']) {
    assert.ok(Object.prototype.hasOwnProperty.call(EVENT_TARGETS, action), `${action} is missing from the event table`);
  }
});
