import {cartComboPricing} from '../../src/combo-cart.js';
import {cartLineMap, comboSelectionsFromCart} from '../../src/cart-view.js';
// Rows and total must use the same server basket snapshot, even when a menu
// refresh has different prices or no longer contains a selected product.
export function customerBasketPricing(cart) {
  const items = cart?.items || [];
  return cartComboPricing(cartLineMap(items), items.map(item => ({id:item.productId, sellingPrice:item.sellingPrice})), comboSelectionsFromCart(cart));
}

// A delayed poll must not overwrite a newer bundle change from another response.
export function newestCustomerBasket(current,next,sessionId){
  if(sessionId&&next?.sessionId!==sessionId)return current;
  if(current?.sessionId===next?.sessionId&&(next?.version??0)<(current?.version??0))return current;
  return next;
}
