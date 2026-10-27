/**
 * Which part of an interface a scoped real-time event affects.
 *
 * The backend only says *what* changed; every surface maps that to the screen
 * it owns. Keeping the mapping in one pure module means the customer menu,
 * the staff app and the console react consistently.
 */
export const EVENT_TARGETS = {
  'customer.verified': 'session',
  'cart.updated': 'cart',
  'order.created': 'orders',
  'order.confirmed': 'orders',
  'order.rejected': 'orders',
  'order.served': 'orders',
  'service.request': 'service',
  'service.resolved': 'service',
  'table.session.opened': 'session',
  'table.session.closed': 'session',
  'inventory.changed': 'inventory',
  'presence.changed': 'presence',
};

export function eventTarget(action) {
  return EVENT_TARGETS[action] || 'none';
}

/** The distinct screens that a batch of events touches. */
export function targetsFor(actions) {
  return [...new Set((actions || []).map(eventTarget))].filter(target => target !== 'none');
}

/** True when the event means a guest is waiting for a waiter. */
export function isServiceCall(action) {
  return action === 'service.request';
}
