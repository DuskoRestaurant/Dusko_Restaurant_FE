/**
 * Helpers for the shared table basket.
 *
 * The basket lives on the server so every guest at a table shares it, but the
 * rendering rules (totals, what blocks the checkout, how a retry record is
 * built) stay pure so they can be tested on their own.
 */

/**
 * Basket lines keyed by product id, holding the ordered quantity.
 *
 * The pricing helper works on a product id to quantity map, so the shared
 * basket is exposed in the same shape.
 */
export function cartLineMap(items) {
  return new Map((items || []).map(item => [item.productId, item.quantity]));
}

/** The full basket lines keyed by product id. */
export function cartItemsById(items) {
  return new Map((items || []).map(item => [item.productId, item]));
}

export function cartSubtotal(items) {
  return (items || []).reduce((sum, item) => sum + item.sellingPrice * item.quantity, 0);
}
export function cartItemCount(items) {
  return (items || []).reduce((sum, item) => sum + item.quantity, 0);
}

/**
 * Lines that must be fixed before the basket can be sent.
 *
 * A dish that ran out, or a quantity above the remaining stock, would be
 * rejected by the kitchen, so the guest is told before sending.
 */
export function cartBlockingItems(items) {
  return (items || []).filter(item => !item.canOrder || item.quantity > item.maxOrderQuantity);
}

export function cartCheckoutable(items, { sessionOpen, busy } = {}) {
  if (!sessionOpen || busy) return false;
  if (!items || !items.length) return false;
  return cartBlockingItems(items).length === 0;
}

/** Combo selections stored on the shared basket, with their product ids. */
export function comboSelectionsFromCart(cart) {
  return ((cart && cart.combos) || []).map(combo => ({
    ...combo,
    productIds: String(combo.key).split('-').map(Number),
  }));
}

/**
 * Snapshot of the basket used as the idempotency record.
 *
 * The same snapshot must produce the same request id, so a retry after a
 * network drop cannot create a second order.
 */
export function cartOrderSnapshot(items) {
  return (items || []).map(item => ({
    productId: item.productId,
    quantity: item.quantity,
    price: item.sellingPrice,
    ...(item.note ? { note: item.note } : {}),
  }));
}

/** Normalise the quantity a stepper should move to, respecting the stock limit. */
export function nextQuantity(current, delta, maxOrderQuantity) {
  const limit = Math.min(1000, maxOrderQuantity ?? 1000);
  return Math.max(0, Math.min(limit, (current || 0) + delta));
}
