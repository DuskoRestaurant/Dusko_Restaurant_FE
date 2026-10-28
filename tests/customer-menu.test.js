import test from 'node:test';
import assert from 'node:assert/strict';
import {customerMenuGroups} from '../customer-web/src/customer-menu-data.js';
import {customerBasketPricing} from '../customer-web/src/customer-basket-pricing.js';
import {customerDishBadges,nextDishQuantity} from '../customer-web/src/customer-dish-details.js';
import {categoryScrollTarget} from '../customer-web/src/customer-category-scroll.js';

test('category centering clamps both edges and handles a short category bar',()=>{
  assert.equal(categoryScrollTarget(200,100,300,800),100);
  assert.equal(categoryScrollTarget(0,100,300,800),0);
  assert.equal(categoryScrollTarget(740,60,300,800),500);
  assert.equal(categoryScrollTarget(100,80,400,300),0);
});

test('dish labels require explicit metadata and filter all matching dishes',()=>{
  assert.deepEqual(customerDishBadges({name:'Rau xào cay bán chạy'}),[]);
  assert.deepEqual(customerDishBadges({tags:['UNKNOWN','SPICY','SPICY']}).map(tag=>tag.label),['Món cay']);
  const products=Array.from({length:20},(_,id)=>({id,name:`Món ${id}`,tags:id%2?['VEGETARIAN']:['BEST_SELLER'],category:{name:'Món chính'}}));
  const group=customerMenuGroups(products,{tag:'VEGETARIAN'})[0];
  assert.equal(group.total,10);assert.equal(group.items.length,10);
  assert.ok(group.items.every(item=>item.id%2===1));
});

test('continuous categories expose every product once, including unavailable dishes',()=>{
  const products=Array.from({length:37},(_,id)=>({id,name:`Món ${id}`,category:{name:id<25?'Món chính':'Rau'},canOrder:id%4!==0}));
  const groups=customerMenuGroups(products);
  assert.deepEqual(groups.map(g=>[g.name,g.total]),[['Món chính',25],['Rau',12]]);
  for (const group of groups) {
    const ids=group.items.map(p=>p.id);
    assert.deepEqual(ids,products.filter(p=>p.category.name===group.name).map(p=>p.id));
  }
});

test('best seller filter removes empty categories and counts only matches across categories',()=>{
  const products=[
    {id:1,name:'Gỏi',category:{name:'Khai vị'},tags:['BEST_SELLER']},
    {id:2,name:'Súp',category:{name:'Khai vị'},tags:[]},
    {id:3,name:'Cơm',category:{name:'Món chính'},tags:['BEST_SELLER']},
    {id:4,name:'Lẩu',category:{name:'Lẩu'},tags:[]},
  ];
  const result=customerMenuGroups(products,{tag:'BEST_SELLER'});
  assert.deepEqual(result.map(group=>[group.name,group.total,group.items.map(item=>item.id)]),[['Khai vị',1,[1]],['Món chính',1,[3]]]);
  assert.deepEqual(customerMenuGroups(products,{tag:'BEST_SELLER',search:'súp'}),[]);
  assert.equal(customerMenuGroups(products)[0].total,2);
});
test('search covers the whole catalog and keeps category grouping',()=>{
  const products=[{id:1,name:'Cơm chiên',category:{name:'Cơm'}},{id:2,name:'Cơm gà',category:{name:'Cơm'}},{id:3,name:'Canh'}];
  const result=customerMenuGroups(products,{search:'  CƠM GÀ '});
  assert.equal(result.length,1);assert.deepEqual(result[0].items.map(p=>p.id),[2]);
  assert.equal(customerMenuGroups(products).at(-1).name,'Món khác');
  assert.deepEqual(customerMenuGroups(products,{search:'không tồn tại'}),[]);
});

test('detail stepper stops at one and the remaining stock limit',()=>{
  assert.equal(nextDishQuantity(1,-1,5),1);
  assert.equal(nextDishQuantity(1,1,5),2);
  assert.equal(nextDishQuantity(5,1,5),5);
  assert.equal(nextDishQuantity(3,-1,5),2);
});
test('basket totals use the actual selected line identities and prices',()=>{
  const cart={items:[{productId:5,name:'Rau',sellingPrice:49000,quantity:2},{productId:9,name:'Khoai',sellingPrice:39000,quantity:1}],combos:[]};
  assert.equal(customerBasketPricing(cart).total,137000);
  assert.equal(customerBasketPricing(null).total,0);
});
test('basket combo discount agrees with server line prices',()=>{
  const cart={items:[{productId:5,sellingPrice:49000,quantity:2},{productId:9,sellingPrice:39000,quantity:1}],combos:[{key:'5-9',quantity:1,price:80000}]};
  assert.deepEqual(customerBasketPricing(cart),{retail:137000,discount:8000,total:129000,valid:[{key:'5-9',quantity:1,price:80000,productIds:[5,9]}]});
});
