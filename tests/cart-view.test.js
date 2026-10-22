import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cartLineMap, cartItemsById, cartSubtotal, cartItemCount, cartBlockingItems, cartCheckoutable,
  comboSelectionsFromCart, cartOrderSnapshot, nextQuantity,
} from '../src/cart-view.js';

const line = (productId, quantity, extra = {}) => ({
  productId, quantity, sellingPrice: 25000, note: null,
  canOrder: true, maxOrderQuantity: 10, ...extra,
});

test('cart totals count every line', () => {
  const items = [line(1, 2), line(2, 1, { sellingPrice: 40000 })];
  assert.equal(cartSubtotal(items), 90000);
  assert.equal(cartItemCount(items), 3);
});

test('the line map holds quantities so the pricing helper can use it', () => {
  const items = [line(1, 2), line(2, 3, { sellingPrice: 40000 })];
  const map = cartLineMap(items);
  assert.equal(map.get(1), 2);
  assert.equal(map.get(2), 3);
  // The pricing helper multiplies the price by this value, so it must be a number.
  assert.equal(typeof map.get(1), 'number');
  const priced = [...map].reduce((sum, [id, quantity]) => sum + (items.find(item => item.productId === id)?.sellingPrice || 0) * quantity, 0);
  assert.equal(priced, 170000);
  assert.equal(cartItemsById(items).get(1).sellingPrice, 25000);
});

test('a sold out dish blocks the checkout', () => {
  const items = [line(1, 1, { canOrder: false, availabilityReason: 'Không đủ nguyên liệu' })];
  assert.equal(cartBlockingItems(items).length, 1);
  assert.equal(cartCheckoutable(items, { sessionOpen: true, busy: false }), false);
});

test('a quantity above the remaining stock blocks the checkout', () => {
  const items = [line(1, 4, { maxOrderQuantity: 3 })];
  assert.equal(cartBlockingItems(items).length, 1);
  assert.equal(cartCheckoutable(items, { sessionOpen: true, busy: false }), false);
});

test('a healthy basket can be sent when the table is open', () => {
  const items = [line(1, 2)];
  assert.equal(cartBlockingItems(items).length, 0);
  assert.equal(cartCheckoutable(items, { sessionOpen: true, busy: false }), true);
});

test('a closed table or a busy request blocks the checkout', () => {
  const items = [line(1, 2)];
  assert.equal(cartCheckoutable(items, { sessionOpen: false, busy: false }), false);
  assert.equal(cartCheckoutable(items, { sessionOpen: true, busy: true }), false);
  assert.equal(cartCheckoutable([], { sessionOpen: true, busy: false }), false);
});

test('combo selections carry the product ids of their key', () => {
  const combos = comboSelectionsFromCart({ combos: [{ key: '17-4-9', quantity: 2, price: 50000 }] });
  assert.deepEqual(combos[0].productIds, [17, 4, 9]);
  assert.equal(combos[0].quantity, 2);
  assert.deepEqual(comboSelectionsFromCart({}), []);
  assert.deepEqual(comboSelectionsFromCart(null), []);
});

test('the order snapshot keeps price and note so a retry matches the first request', () => {
  const snapshot = cartOrderSnapshot([line(1, 2, { note: 'ít cay' }), line(2, 1)]);
  assert.deepEqual(snapshot[0], { productId: 1, quantity: 2, price: 25000, note: 'ít cay' });
  assert.deepEqual(snapshot[1], { productId: 2, quantity: 1, price: 25000 });
});

test('a stepper never goes below zero or above the remaining stock', () => {
  assert.equal(nextQuantity(0, 1, 5), 1);
  assert.equal(nextQuantity(0, -1, 5), 0);
  assert.equal(nextQuantity(5, 1, 5), 5);
  assert.equal(nextQuantity(5, -1, 5), 4);
  assert.equal(nextQuantity(0, 1, undefined), 1);
  assert.equal(nextQuantity(0, 1, 0), 0);
});
