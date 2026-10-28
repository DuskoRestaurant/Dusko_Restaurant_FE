import test from 'node:test';
import assert from 'node:assert/strict';
import {serviceMenuPage} from '../src/service-menu.js';

const products = Array.from({length:120},(_,i)=>({id:i+1,name:`Món ${i+1}`,isActive:true,category:{name:i%2?'Nước':'Món chính'}}));

test('a large menu has bounded pages without dropping or repeating products',()=>{
  const collected=[];
  for(let page=1;page<=15;page++){
    const result=serviceMenuPage(products,{page});
    assert.equal(result.total,120);
    assert.equal(result.items.length,8);
    assert.equal(result.start,(page-1)*8+1);
    assert.equal(result.end,page*8);
    collected.push(...result.items.map(p=>p.id));
  }
  assert.deepEqual(collected,products.map(p=>p.id));
});
test('search and category apply before pagination; a stale page is clamped',()=>{
  const result=serviceMenuPage(products,{search:'  MÓN 12 ',category:'Nước',page:15});
  assert.deepEqual(result.items.map(p=>p.id),[12,120]);
  assert.equal(result.page,1);
  assert.equal(result.pages,1);
});
test('removed products and empty results cannot leave an invalid page',()=>{
  const inactive=products.map(p=>({...p,isActive:false}));
  assert.deepEqual(serviceMenuPage(inactive,{page:15}),{items:[],total:0,page:1,pages:1,start:0,end:0});
  const result=serviceMenuPage(products.slice(0,9),{page:15});
  assert.deepEqual(result.items.map(p=>p.id),[9]);
  assert.equal(result.page,2);
  assert.equal(result.end,9);
  assert.equal(serviceMenuPage(products,{search:'Không có món này'}).total,0);
  assert.equal(products.length,120);
});
