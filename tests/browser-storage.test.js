import test from 'node:test';
import assert from 'node:assert/strict';
import { readStoredJson, storeJson, tryStoreJson, preparePendingOrder } from '../src/browser-storage.js';
test('corrupt or inaccessible storage cannot crash customer startup', () => {
  for (const storage of [{getItem:()=>'{broken'}, {getItem:()=>'{"unexpected":true}'}, {getItem:()=>{throw Error('denied');}}]) {
    assert.deepEqual(readStoredJson(storage,'history',[],Array.isArray),[]);
  }
});
test('retry after a lost response reuses the saved UUID; changed session gets a new request', () => {
  const data=new Map(); const storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};
  const items=[{productId:1,quantity:2,price:100}];
  const first=preparePendingOrder(storage,'pending','session1',items,()=> 'uuid1');
  assert.deepEqual(preparePendingOrder(storage,'pending','session1',items,()=>{throw Error('must reuse');}),first);
  assert.equal(preparePendingOrder(storage,'pending','session2',items,()=> 'uuid2').id,'uuid2');
  data.set('pending','{broken');
  assert.throws(()=>preparePendingOrder(storage,'pending','session2',items),/Không đọc được/);
});
test('pending order persistence fails explicitly before a request; optional history writes can fail safely', () => {
  const storage={setItem:()=>{throw Error('quota');}};
  assert.throws(()=>storeJson(storage,'pending',{id:'same-uuid'}),/quota/);
  assert.equal(tryStoreJson(storage,'history',[]),false);
});
