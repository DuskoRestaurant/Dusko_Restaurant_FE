import test from 'node:test';
import assert from 'node:assert/strict';
import {customerCartGroups,customerCartLines} from '../customer-web/src/customer-cart-lines.js';
import {customerDishImages} from '../customer-web/src/customer-dish-details.js';
import {customerBasketPricing} from '../customer-web/src/customer-basket-pricing.js';

const items=[{productId:1,name:'Gỏi',sellingPrice:60000,quantity:3,canOrder:true,note:'Ít cay'}, {productId:2,name:'Cơm',sellingPrice:40000,quantity:2,canOrder:true}];
test('whole bundles consume only allocated units, preserve extra dishes and match the basket total',()=>{
  const combos=[{key:'1-2',price:80000,quantity:2}],grouped=customerCartGroups(items,combos);
  assert.equal(grouped.combos.length,1);assert.equal(grouped.combos[0].lineTotal,160000);
  assert.deepEqual(grouped.items.map(i=>[i.productId,i.quantity,i.lineTotal]),[[1,1,60000]]);
  assert.equal(grouped.items[0].note,'Ít cay');
  const visibleTotal=grouped.combos.reduce((s,c)=>s+c.lineTotal,0)+grouped.items.reduce((s,i)=>s+i.lineTotal,0);
  assert.equal(visibleTotal,customerBasketPricing({items,combos}).total);
});
test('overlapping or incomplete bundles never double count component quantities',()=>{
  const grouped=customerCartGroups(items,[{key:'1-2',price:80000,quantity:2},{key:'2-1',price:70000,quantity:1}]);
  assert.equal(grouped.combos.length,1);
  assert.equal(customerCartGroups(items,[{key:'1-2',price:80000,quantity:3}]).combos.length,0);
});
test('bundle cards show discounted price and a bundle control instead of component steppers',()=>{
  const html=customerCartLines(items.map(i=>({...i,quantity:2})),{combos:[{key:'1-2',price:80000,quantity:2}],productById:()=>({imageUrl:'/dish.jpg'})});
  assert.match(html,/Combo Gỏi \+ Cơm/);assert.match(html,/160\.000/);
  assert.match(html,/data-combo-plus="1-2"/);assert.match(html,/guest-cart-photo/);
  assert.doesNotMatch(html,/data-cart-plus=/);
});
test('photo gallery uses provided images once and leaves a single-photo dish as one photo',()=>{
  assert.deepEqual(customerDishImages({imageUrl:'/one.jpg'}),['/one.jpg']);
  assert.deepEqual(customerDishImages({imageUrl:'/one.jpg',imageUrls:['/one.jpg','/two.jpg',null],images:[{url:'/three.jpg'}]}),['/one.jpg','/two.jpg','/three.jpg']);
  assert.deepEqual(customerDishImages({}),[]);
});
