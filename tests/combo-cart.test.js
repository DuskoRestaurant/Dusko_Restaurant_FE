import test from 'node:test';
import assert from 'node:assert/strict';
import {cartComboPricing} from '../src/combo-cart.js';
import {preparePendingOrder} from '../src/browser-storage.js';
const products=[{id:1,sellingPrice:60000},{id:2,sellingPrice:40000}],combo={key:'1-2',productIds:[1,2],quantity:2,price:80000};
test('cart combines discounted bundles with additional retail items',()=>{
 const result=cartComboPricing(new Map([[1,3],[2,2]]),products,[combo]);
 assert.equal(result.retail,260000);assert.equal(result.discount,40000);assert.equal(result.total,220000);
 assert.equal(cartComboPricing(new Map([[1,1],[2,2]]),products,[combo]).discount,0);
});
test('changing selected combos creates a new retry key even when product quantities match',()=>{
 const data=new Map(),storage={getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)},items=[{productId:1,quantity:1,price:60000}];
 assert.equal(preparePendingOrder(storage,'pending','s',items,()=> 'one',[]).id,'one');
 assert.equal(preparePendingOrder(storage,'pending','s',items,()=> 'two',[{key:'1-2',quantity:1,price:80000}]).id,'two');
});
