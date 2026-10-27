import test from 'node:test';
import assert from 'node:assert/strict';
import {staffShellsFor} from '../staff-app/src/role-picker.js';
import {canTakePayment,canManage,effectiveRoles} from '../src/permissions.js';
import {jsonRequest} from '../src/json-request.js';
test('each operational role has its own workspace and unknown roles have none',()=>{
 assert.deepEqual(staffShellsFor({role:'WAITER'}),['service']);
 assert.deepEqual(staffShellsFor({role:'CASHIER'}),['cashier']);
 assert.deepEqual(staffShellsFor({role:'CHEF'}),['kitchen']);
 assert.deepEqual(staffShellsFor({role:'UNKNOWN'}),[]);
});
test('primary and extra roles are combined without granting payment to a waiter',()=>{
 assert.deepEqual(staffShellsFor({role:'WAITER',roles:['CHEF']}),['service','kitchen']);
 assert.deepEqual(staffShellsFor({role:'ADMIN'}),['service','cashier','kitchen']);
 assert.deepEqual(staffShellsFor({role:'MANAGER'}),['service','cashier','kitchen']);
 assert.equal(canTakePayment({role:'WAITER'}),false);
 assert.equal(canTakePayment({role:'WAITER',roles:['CASHIER']}),true);
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
