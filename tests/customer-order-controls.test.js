import test from 'node:test';
import assert from 'node:assert/strict';
import {customerItemStatus,customerOrderHistory} from '../customer-web/src/customer-order-history.js';
import {dishNotePlaceholder} from '../customer-web/src/customer-dish-details.js';
import {customerCartLines} from '../customer-web/src/customer-cart-lines.js';

test('order confirmation and rejection override stale kitchen status; payment does not imply served',()=>{
  assert.deepEqual(customerItemStatus({status:'CANCELLED'},{servedAt:'date'}),['cancelled','Đã từ chối']);
  assert.deepEqual(customerItemStatus({status:'AWAITING_CONFIRMATION'},{kdsStatus:'DONE'}),['waiting','Chờ xác nhận']);
  assert.deepEqual(customerItemStatus({status:'PAID'},{kdsStatus:'COOKING'}),['cooking','Đang chế biến']);
  assert.deepEqual(customerItemStatus({status:'PENDING'},{servedAt:'date'}),['served','Đã lên bàn']);
  assert.deepEqual(customerItemStatus({status:'PENDING'},{kdsStatus:'DONE'}),['ready','Sẵn sàng']);
});
test('history renders one row per dish and escapes names and cancellation notes',()=>{
  const html=customerOrderHistory([{id:1,status:'CANCELLED',createdAt:'2026-10-29',note:'<img onerror=bad>',items:[{product:{name:'<b>Gỏi</b>'},quantity:2},{product:{name:'Bia'},quantity:1}]}]);
  assert.equal((html.match(/<li>/g)||[]).length,2);
  assert.match(html,/&lt;b&gt;Gỏi&lt;\/b&gt;/);
  assert.match(html,/&lt;img onerror=bad&gt;/);
  assert.doesNotMatch(html,/<img|<b>Gỏi/);
});
test('note suggestions distinguish drinks, food in miscategorized catalogs, hotpot and desserts',()=>{
  assert.match(dishNotePlaceholder({name:'Bia Tiger',category:{name:'Bia'}}),/ít đá/);
  assert.match(dishNotePlaceholder({name:'Canh chua',category:{name:'Bia'}}),/không hành/);
  assert.match(dishNotePlaceholder({name:'Trà đào'}),/ít đá/);
  assert.match(dishNotePlaceholder({name:'Lẩu Thái'}),/nước lẩu/);
  assert.match(dishNotePlaceholder({name:'Dưa hấu',category:{name:'Tráng miệng'}}),/ít ngọt/);
  assert.match(dishNotePlaceholder(),/ít cay/);
});
test('shared cart renderer keeps server totals, line identity and accessible destructive controls',()=>{
  const html=customerCartLines([{productId:7,name:'Bia <Tiger>',quantity:2,lineTotal:45000,sellingPrice:25000,canOrder:true,note:'"<test>'}],{busy:true});
  assert.match(html,/data-remove="7"/);
  assert.match(html,/aria-label="Bỏ Bia &lt;Tiger&gt; khỏi giỏ"/);
  assert.match(html,/45\.000/);
  assert.doesNotMatch(html,/50\.000|Bỏ món này|data-clear-cart/);
  assert.match(html,/value="&quot;&lt;test&gt;"/);
  assert.match(html,/data-cart-plus="7"[^>]*disabled/);
});
