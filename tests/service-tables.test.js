import test from 'node:test';
import assert from 'node:assert/strict';
import {filterServiceTables,serviceTableFilters} from '../src/service-tables.js';
const tables=[
  {id:10,tableName:'Bàn 10',status:'EMPTY'},
  {id:2,tableName:'Bàn 2',status:'EMPTY'},
  {id:3,tableName:'Bàn 3',status:'SERVING',unconfirmedOrderCount:2,readyQuantity:3},
  {id:4,tableName:'Bàn 4',status:'SERVING',serviceRequestCount:1},
  {id:5,tableName:'Bàn 5',status:'RESERVED'},
];
test('quick filters count requests and ready quantities, including missing optional counters',()=>{
  const counts=Object.fromEntries(serviceTableFilters(tables).map(f=>[f.id,f.count]));
  assert.deepEqual(counts,{ALL:5,PAY:0,SERVING:2,CONFIRM:2,READY:3,CALL:1,EMPTY:2,RESERVED:1});
  assert.ok(serviceTableFilters([]).every(f=>f.count===0));
});
test('each quick filter selects the relevant tables without losing simultaneous requests',()=>{
  for(const [filter,expected] of Object.entries({SERVING:[4,3],CONFIRM:[3],READY:[3],CALL:[4],EMPTY:[2,10],RESERVED:[5]}))
    assert.deepEqual(filterServiceTables(tables,{filter}).map(t=>t.id),expected);
});
test('urgent tables stay first; ordinary tables use natural numeric order without mutating input',()=>{
  assert.deepEqual(filterServiceTables(tables).map(t=>t.id),[4,3,2,5,10]);
  assert.deepEqual(tables.map(t=>t.id),[10,2,3,4,5]);
  assert.deepEqual(filterServiceTables(tables,{search:'  BÀN 2  ',filter:'EMPTY'}).map(t=>t.id),[2]);
  assert.deepEqual(filterServiceTables(tables,{search:'Không tồn tại'}),[]);
});

test('cashier filter keeps payment-ready tables and prioritizes bill requests',()=>{
  const input=[...tables,{id:6,tableName:'Bàn 6',status:'SERVING',checkoutReady:true},{id:7,tableName:'Bàn 7',status:'SERVING',billRequested:true}];
  assert.deepEqual(filterServiceTables(input,{filter:'PAY'}).map(t=>t.id),[6,7]);
  assert.deepEqual(filterServiceTables(input,{prioritizePayment:true}).slice(0,2).map(t=>t.id),[6,7]);
});
