import test from 'node:test';
import assert from 'node:assert/strict';
import {selectCatalog,menuCatalogHtml} from '../src/catalog-manager.js';
const products=Array.from({length:28},(_,i)=>({id:i+1,code:`P${i+1}`,name:i===0?'Bò lúc lắc':`Món ${i+1}`,categoryId:i<14?1:2,isActive:i!==1,canOrder:i!==2,_count:{recipes:i===3?0:1},sellingPrice:59000}));
test('catalog combines accent-insensitive search, category and status; clamps pagination after filtering',()=>{
  assert.equal(selectCatalog(products,{search:'bo luc lac'}).items[0].id,1);
  assert.equal(selectCatalog(products,{category:'2',status:'ready'}).total,14);
  assert.equal(selectCatalog(products,{status:'inactive',page:3}).page,1);
  assert.equal(selectCatalog(products,{status:'recipe'}).items[0].id,4);
  assert.equal(selectCatalog(products,{page:3}).items.length,4);
});
test('category deletion is admin-only and untrusted catalog labels are escaped',()=>{
  const input={categories:[{id:1,name:'<script>bad</script>'}],products,admin:false,chef:false};
  const viewer=menuCatalogHtml(input);assert.ok(!viewer.includes('data-action="delete-category"'));assert.ok(!viewer.includes('<script>bad'));
  assert.match(menuCatalogHtml({...input,admin:true}),/data-action="delete-category"/);
});
