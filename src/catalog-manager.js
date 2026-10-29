import {escapeHtml as e,money} from './api.js';
import {productPhoto} from './product-photo.js';
export const catalogSearch=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase().trim();
export const catalogStatus=p=>!p.isActive?'inactive':p._count?.recipes===0?'recipe':p.canOrder===false?'stock':'ready';
export function selectCatalog(products,{search='',category='all',status='all',page=1,pageSize=12}={}){
  const query=catalogSearch(search);
  const matches=products.filter(p=>(category==='all'||String(p.categoryId)===String(category))&&(status==='all'||catalogStatus(p)===status)&&catalogSearch(`${p.name} ${p.code}`).includes(query));
  const pages=Math.max(1,Math.ceil(matches.length/pageSize)),current=Math.max(1,Math.min(page,pages));
  return {items:matches.slice((current-1)*pageSize,current*pageSize),total:matches.length,page:current,pages};
}
const action=(label,name,id,extra='')=>`<button type="button" class="ma-action ${extra}" data-action="${name}" data-id="${id}">${label}</button>`;
export function menuCatalogHtml({categories,products,admin,chef}){
  const count=c=>c._count?.products??products.filter(p=>p.categoryId===c.id).length;
  const ready=products.filter(p=>catalogStatus(p)==='ready').length,missing=products.filter(p=>catalogStatus(p)==='recipe').length;
  return `<div id="menu-admin">
    <div class="ma-summary"><div><strong>${products.length}</strong><span>Món trong thực đơn</span></div><div><strong>${ready}</strong><span>Sẵn sàng phục vụ</span></div><div><strong>${categories.length}</strong><span>Nhóm món</span></div><div class="${missing?'ma-attention':''}"><strong>${missing}</strong><span>Cần thêm công thức</span></div></div>
    <div class="ma-layout"><aside class="ma-groups"><header><h2>Nhóm món</h2>${admin?action('+ Thêm','new-category',''):''}</header><button type="button" class="ma-group-filter is-selected" data-menu-category="all" aria-pressed="true"><span>Tất cả món</span><b>${products.length}</b></button><div class="ma-group-list">${categories.map(c=>`<div class="ma-group"><button type="button" class="ma-group-filter" data-menu-category="${c.id}" aria-pressed="false"><span>${e(c.name)}</span><b>${count(c)}</b></button>${admin?`<div class="ma-group-actions" aria-label="Quản lý ${e(c.name)}">${action('Sửa','edit-category',c.id)}${action('Xóa','delete-category',c.id,'ma-danger')}</div>`:''}</div>`).join('')||'<p class="ma-empty">Chưa có nhóm món.</p>'}</div></aside>
    <section class="ma-products"><header><div><h2 id="catalog-heading">Tất cả món</h2><p>Quản lý giá bán, công thức và tình trạng phục vụ.</p></div>${admin?action('+ Thêm món','new-product','','ma-primary'):''}</header>
    <div class="ma-toolbar"><label><span>Tìm món</span><input id="catalog-search" type="search" placeholder="Tên hoặc mã món…" autocomplete="off"></label><label><span>Tình trạng</span><select id="catalog-filter"><option value="all">Tất cả trạng thái</option><option value="ready">Sẵn sàng bán</option><option value="recipe">Chưa có công thức</option><option value="stock">Thiếu nguyên liệu</option><option value="inactive">Ngừng bán</option></select></label></div>
    <div class="ma-table-head" aria-hidden="true"><span>Món ăn</span><span>Giá bán</span><span>Tình trạng</span><span>Thao tác</span></div>
    <div id="catalog-results">${catalogRows(products.slice(0,12),admin,chef)}</div><p id="catalog-empty" class="ma-empty" hidden>Không tìm thấy món phù hợp. Thử tên khác hoặc đổi bộ lọc.</p>
    <footer class="ma-pagination"><span id="catalog-count" aria-live="polite"></span><div><button type="button" class="ma-action" data-menu-page="-1" aria-label="Trang trước">←</button><span id="catalog-page"></span><button type="button" class="ma-action" data-menu-page="1" aria-label="Trang sau">→</button></div></footer></section></div></div>`;
}
function catalogRows(products,admin,chef){return products.map(p=>{
  const status=catalogStatus(p),label={ready:'Sẵn sàng bán',inactive:'Ngừng bán',recipe:'Chưa có công thức',stock:'Thiếu nguyên liệu'}[status];
  return `<article class="ma-product" data-product-id="${p.id}"><div class="ma-product-name">${productPhoto(p,'product-photo ma-photo')}<div><h3>${e(p.name)}</h3><p>${e(p.category?.name||'Chưa phân nhóm')}</p><small>${e(p.code)} · ${p.requiresPreparation?'Cần chế biến':'Phục vụ trực tiếp'}</small></div></div><strong class="ma-price">${money(p.sellingPrice)}</strong><div class="ma-product-status"><span class="ma-status ma-${status}">${label}</span>${status==='ready'?`<small>Tối đa ${p.maxOrderQuantity??'—'} suất</small>`:''}</div><div class="ma-product-actions">${admin?action('Sửa','edit-product',p.id):''}${admin||chef?action('Công thức','recipe',p.id):''}${admin?action(p.isActive?'Ngừng bán':'Bán lại','toggle-product',p.id):''}</div></article>`;
}).join('');}
export function bindCatalog(root,{categories,products,admin,chef}){
  const state={search:'',category:'all',status:'all',page:1};
  const apply=()=>{
    const selected=selectCatalog(products,state);state.page=selected.page;
    root.querySelector('#catalog-results').innerHTML=catalogRows(selected.items,admin,chef);
    root.querySelector('#catalog-empty').hidden=selected.total>0;
    root.querySelector('#catalog-count').textContent=`${selected.total} món${state.category==='all'?' trong thực đơn':''}`;
    root.querySelector('#catalog-page').textContent=`${selected.page} / ${selected.pages}`;
    root.querySelector('[data-menu-page="-1"]').disabled=selected.page===1;
    root.querySelector('[data-menu-page="1"]').disabled=selected.page===selected.pages;
    root.querySelector('#catalog-heading').textContent=categories.find(c=>String(c.id)===state.category)?.name||'Tất cả món';
    root.querySelectorAll('[data-menu-category]').forEach(button=>{const active=button.dataset.menuCategory===state.category;button.classList.toggle('is-selected',active);button.setAttribute('aria-pressed',String(active));});
  };
  root.querySelector('#catalog-search').oninput=event=>{state.search=event.target.value;state.page=1;apply();};
  root.querySelector('#catalog-filter').onchange=event=>{state.status=event.target.value;state.page=1;apply();};
  root.addEventListener('click',event=>{
    const category=event.target.closest('[data-menu-category]'),page=event.target.closest('[data-menu-page]');
    if(category){state.category=category.dataset.menuCategory;state.page=1;apply();}
    if(page){state.page+=Number(page.dataset.menuPage);apply();root.querySelector('#catalog-heading').scrollIntoView({block:'nearest'});}
  });apply();
}
