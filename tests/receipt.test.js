import test from 'node:test';
import assert from 'node:assert/strict';
import {receiptMarkup} from '../src/receipt-format.js';
test('receipt shows restaurant address, exact discount and escapes stored menu content',()=>{
 const html=receiptMarkup({snapshot:{restaurantName:'DUSKO RESTAURANT',address:'120 Nguyễn Văn Bảo, Gò Vấp',code:'HD-123',tableName:'Bàn 2',openedAt:'2026-10-18T10:00:00Z',issuedAt:'2026-10-18T11:00:00Z',cashier:'Thu ngân',paymentMethods:['CASH'],items:[{name:'<img src=x onerror=alert(1)>',quantity:2,price:35000,total:70000,note:'ít cay'}],subtotal:70000,discount:10000,total:60000}});
 assert.match(html,/120 Nguyễn Văn Bảo, Gò Vấp/);assert.match(html,/Giảm giá combo/);assert.match(html,/60\.000/);assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img src=x/);
});
