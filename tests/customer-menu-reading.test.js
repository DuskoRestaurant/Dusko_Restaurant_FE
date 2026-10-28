import test from 'node:test';
import assert from 'node:assert/strict';
import {categoryAtReadingLine} from '../customer-web/src/customer-category-spy.js';
import {customerOrderHistory} from '../customer-web/src/customer-order-history.js';

test('scrollspy waits until the next section reaches the sticky reading line',()=>{
  assert.equal(categoryAtReadingLine([-500,350,800],120,0),0);
  assert.equal(categoryAtReadingLine([-500,100,800],120,0),0);
  assert.equal(categoryAtReadingLine([-500,90,800],120,0),1);
});
test('hysteresis prevents tiny boundary movements from flipping back and forth',()=>{
  assert.equal(categoryAtReadingLine([-500,100,800],120,0),0);
  assert.equal(categoryAtReadingLine([-500,100,800],120,1),1);
  assert.equal(categoryAtReadingLine([-500,150,800],120,1),0);
  assert.equal(categoryAtReadingLine([-500,-200,90],120,0),2);
});
test('scrollspy handles filtered catalogs and the document end',()=>{
  assert.equal(categoryAtReadingLine([],120),-1);
  assert.equal(categoryAtReadingLine([200],120,8),0);
  assert.equal(categoryAtReadingLine([-900,-300,400],120,1,{atEnd:true}),2);
});
test('order history is collapsed by default, preserves details and escapes text',()=>{
  const orders=[{id:'one',createdAt:'2026-10-28T10:00:00Z',status:'AWAITING_CONFIRMATION',finalAmount:49000,items:[]},
    {id:'two',createdAt:'2026-10-28T10:01:00Z',status:'PENDING',items:[{product:{name:'<script>bad</script>'},quantity:1,kdsStatus:'DONE'}]}];
  const html=customerOrderHistory(orders);
  assert.match(html,/<details class="receipt guest-order-history" >/);
  assert.match(html,/2 lượt · 1 chờ xác nhận/);
  assert.match(html,/&lt;script&gt;bad&lt;\/script&gt;/);
  assert.doesNotMatch(html,/<script>/);
  assert.match(customerOrderHistory(orders,{open:true}),/guest-order-history" open>/);
  assert.equal(customerOrderHistory([]),'');
});
