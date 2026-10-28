import test from 'node:test';
import assert from 'node:assert/strict';
import {staffShellsFor} from '../staff-app/src/role-picker.js';
import {canTakePayment,canManage,effectiveRoles} from '../src/permissions.js';
import {jsonRequest} from '../src/json-request.js';
test('all employees can choose all three workspaces without receiving management access',()=>{
 for(const role of ['WAITER','CASHIER','CHEF','MANAGER','ADMIN']){
  assert.deepEqual(staffShellsFor({role}),['kitchen','cashier','service']);
  assert.equal(canTakePayment({role}),true);
 }
 assert.deepEqual(staffShellsFor({role:'UNKNOWN'}),[]);
 assert.equal(canTakePayment({role:'UNKNOWN'}),false);
 for(const role of ['WAITER','CASHIER','CHEF'])assert.equal(canManage({role}),false);
 assert.deepEqual(staffShellsFor({role:'UNKNOWN',roles:['CHEF']}),['kitchen','cashier','service']);
 assert.equal(canManage({role:'CASHIER',roles:['MANAGER']}),true);
 assert.deepEqual(effectiveRoles({role:'WAITER',roles:['WAITER','CHEF']}),['WAITER','CHEF']);
});
test('request serializes a kitchen update once and preserves API errors',async()=>{
 const body={status:'COOKING',branchId:1};let options;
 const result=await jsonRequest('', '/api/kds/batches/1/status',{method:'PATCH',body,token:'test',fetcher:async(_,o)=>{options=o;return {ok:true,json:async()=>({data:{id:1}})};}});
 assert.deepEqual(JSON.parse(options.body),body);assert.equal(options.headers.Authorization,'Bearer test');assert.equal(result.id,1);
 await assert.rejects(()=>jsonRequest('','/',{body:JSON.stringify(body)}),/must be an object/);
 await assert.rejects(()=>jsonRequest('','/',{fetcher:async()=>({status:409,ok:false,json:async()=>({error:'Phiên đã đổi',code:'SESSION_CHANGED'})})}),error=>error.status===409&&error.code==='SESSION_CHANGED');
});
