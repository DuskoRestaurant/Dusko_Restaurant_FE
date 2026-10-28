import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {serviceMenuPage} from '../src/service-menu.js';
import {filterServiceTables,serviceTableFilters} from '../src/service-tables.js';

// Exercise the actual workspace controller in Node without loading CSS or the
// browser-only socket/toast adapters. This covers startup and opening a session,
// which pure menu/filter tests cannot catch after a merge.
const source=readFileSync(new URL('../src/service-workspace.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replace('export function createServiceWorkspace','function createServiceWorkspace');
const factory=new Function('deps','document','localStorage','setInterval','clearInterval',`const {serviceMenuPage,filterServiceTables,serviceTableFilters,watchChanges,sharedToast}=deps;${source}\nreturn createServiceWorkspace;`);
for(const role of ['ADMIN','CASHIER','WAITER'])test(`${role} workspace starts, reports sync and opens customer summary without runtime errors`,async()=>{
  const listeners=new Map(),sync={textContent:''},message={textContent:'',classList:{toggle(){}}};
  const root={innerHTML:'',classList:{add(){}},setAttribute(){},querySelectorAll:()=>[],contains:()=>true,
    querySelector:selector=>selector==='[data-sw-sync]'?sync:selector==='[data-sw-message]'?message:null,
    addEventListener:(name,handler)=>listeners.set(name,handler),removeEventListener:name=>listeners.delete(name)};
  const table={id:1,tableName:'Bàn 1',status:'SERVING',checkoutReady:true};
  const create=factory({serviceMenuPage,filterServiceTables,serviceTableFilters,sharedToast:()=>({}),watchChanges:(_request,_callback,_url,options)=>{options.onStatus(true);return()=>{};}},{hidden:false},{getItem:()=>null},()=>0,()=>{});
  const workspace=create({root,role,userId:'test',branchId:1,initialData:{tables:[table],products:[]},request:async()=>({table,session:{id:'session',orders:[{id:'order',status:'PENDING',createdAt:new Date(),finalAmount:1000,items:[]}]}})});
  try{
    await new Promise(resolve=>setImmediate(resolve));
    assert.match(root.innerHTML,/Danh sách bàn/);
    assert.match(sync.textContent,/Đang kết nối trực tiếp/);
    const target={dataset:{sw:'table',id:'1'}};
    await listeners.get('click')({target:{closest:()=>target}});
    assert.equal(message.textContent,'');
    assert.match(root.innerHTML,/Khách vãng lai/);
    assert.match(root.innerHTML,/Gắn khách hàng/);
    assert.match(root.innerHTML,/sw-panel/);
  }finally{workspace.destroy();}
});
