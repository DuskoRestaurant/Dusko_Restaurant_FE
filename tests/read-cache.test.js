import test from 'node:test';
import assert from 'node:assert/strict';
import { createReadCache } from '../src/read-cache.js';
const tick = () => new Promise(resolve => setImmediate(resolve));

test('revisiting uses cached data, revalidates stale data, and keeps separate session/branch keys', async () => {
  let clock=0, calls=0, refreshes=0;
  const cache=createReadCache({now:()=>clock,onRefresh:()=>refreshes++});
  const fetch=async()=>++calls;
  assert.equal(await cache.read('user1:branch1',fetch),1);
  assert.equal(await cache.read('user1:branch1',fetch),1);
  assert.equal(calls,1);
  assert.equal(await cache.read('user2:branch1',fetch),2);
  assert.equal(await cache.read('user1:branch2',fetch),3);
  clock=16000;
  assert.equal(await cache.read('user1:branch1',fetch),1);
  await tick();
  assert.equal(await cache.read('user1:branch1',fetch),4);
  assert.equal(refreshes,1);
});

test('concurrent reads share a request; invalidation cannot be undone by its late response', async () => {
  let resolve, calls=0;
  const cache=createReadCache();
  const fetch=()=>{calls++;return new Promise(done=>{resolve=done;});};
  const first=cache.read('key',fetch), second=cache.read('key',fetch);
  await tick(); assert.equal(calls,1);
  cache.clear(); resolve('old');
  assert.deepEqual(await Promise.all([first,second]),['old','old']);
  assert.equal(await cache.read('key',async()=>'new'),'new');
});

test('expired entries wait for the server and background permission errors evict cached data', async () => {
  let clock=0, error;
  const cache=createReadCache({now:()=>clock,onError:value=>{error=value;}});
  await cache.read('key',async()=>'cached');
  clock=16000;
  const forbidden=Object.assign(new Error('forbidden'),{status:403});
  assert.equal(await cache.read('key',async()=>{throw forbidden;}),'cached');
  await tick(); assert.equal(error,forbidden);
  assert.equal(await cache.read('key',async()=>'authorized again'),'authorized again');
  clock=100000;
  await assert.rejects(cache.read('key',async()=>{throw forbidden;}),{status:403});
});
