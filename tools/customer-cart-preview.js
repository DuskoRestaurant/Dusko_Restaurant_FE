// Isolated visual fixture; no fetch, order submission, or restaurant data.
import '../src/tokens.css';
import tokens from '../src/tokens.css?raw';
import '../customer-web/src/style.css';
import '../customer-web/src/customer-cart.css';
import '../customer-web/src/customer-help.css';
import '../src/font.css';
import '../src/pos-theme.css';
import '../customer-web/src/customer-cart-overlay.css';
import {createCustomerCartOverlay} from '../customer-web/src/customer-cart-overlay.js';
if (new URLSearchParams(location.search).get('theme') === 'light') {
  const theme = document.createElement('style');
  theme.textContent = tokens.match(/:root\s*\{[^}]*\}/)[0];
  document.head.append(theme);
}
import '../customer-web/src/customer-menu.css';
import {createCustomerMenu} from '../customer-web/src/customer-menu.js';
import {customerBasketPricing} from '../customer-web/src/customer-basket-pricing.js';
import {customerCartLines} from '../customer-web/src/customer-cart-lines.js';
import {createCustomerViews} from '../customer-web/src/customer-views.js';
import {customerServiceActions} from '../customer-web/src/customer-service-actions.js';
import {createToast} from '../src/toast.js';
import {customerOrderHistory} from '../customer-web/src/customer-order-history.js';
import {cartCheckoutable} from '../src/cart-view.js';
const app = document.querySelector('#app');
const money = n => new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND'}).format(n);
const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const base = [
  ['Khai vị','Gỏi cuốn',49000,'goi-cuon'],
  ['Món chính','Cơm chiên hải sản',89000,'com-chien'],
  ['Rau & canh','Rau muống xào tỏi',49000,'rau-muong-xao'],
  ['Lẩu','Lẩu Thái hải sản',289000,'lau-thai'],
  ['Ăn nhẹ','Khoai tây chiên',39000,'khoai-tay-chien'],
  ['Tráng miệng','Dưa hấu',29000,'dua-hau'],
  ['Đồ uống','Bia Tiger',25000,'bia-tiger'],
];
const products=base.flatMap(([category,name,sellingPrice,image],group)=>Array.from({length:13},(_,i)=>({id:group*100+i+1,name:i===0?name:`${name} ${i+1}`,sellingPrice,imageUrl:`/dishes/${image}.webp`,category:{name:category},canOrder:i!==12,availabilityReason:'Tạm hết',maxOrderQuantity:30,tags:group===0&&i<2||group===1&&i===0?['BEST_SELLER']:group===2?['VEGETARIAN']:group===3?['SPICY']:[],description:''})));
const quantities=new Map(new URLSearchParams(location.search).has('stress')?products.slice(0,10).map(p=>[p.id,1]):new URLSearchParams(location.search).has('review')?[[1,2],[601,1]]:[]), notes=new Map();
const basket=()=>({items:[...quantities].map(([id,quantity])=>({...products.find(p=>p.id===id),productId:id,quantity,note:notes.get(id)||''})),combos:[]});
app.innerHTML='<header class="customer-app-header"><div class="brand"><img class="dusko-logo" src="/dusko-logo-v1.png" alt="Dusko Restaurant"><span>DUSKO RESTAURANT</span></div><p>Bàn 02</p></header><main><section class="hero"><h1>Chi nhánh Quận 1</h1></section><p class="notice">BẢN XEM THỬ · 91 món giả lập · Không gửi đơn</p><div class="customer-layout"><section class="customer-menu" id="customer-menu"></section><section class="cart" id="customer-cart"></section></div></main><aside class="restaurant-help"><button class="help-toggle" type="button" aria-label="Hỏi nhà hàng" title="Hỏi nhà hàng"><svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M20 11.5a8 8 0 0 1-8 8H5l-3 2v-7a8 8 0 1 1 18-3Z" stroke-linejoin="round"/><path d="M7 10h8M7 14h5" stroke-linecap="round"/></svg></button></aside>';
const fixtureOrders=[{id:'preview',createdAt:'2026-10-29T12:30:00Z',status:'PENDING',source:'CUSTOMER_QR',finalAmount:212000,items:[{product:{name:'Gỏi cuốn'},quantity:2,servedAt:'2026-10-29T12:35:00Z'},{product:{name:'Cơm chiên hải sản'},quantity:1,kdsStatus:'COOKING'},{product:{name:'Bia Tiger'},quantity:1,kdsStatus:'DONE'}]}];
const main=app.querySelector('main'),menuView=document.createElement('div');menuView.id='customer-menu-view';menuView.append(...main.childNodes);main.append(menuView);
menuView.querySelector('.customer-layout').insertAdjacentHTML('beforebegin',`<div class="guest-table-tools"><div id="service-actions">${customerServiceActions({sessionOpen:true})}</div><button type="button" data-open-history class="guest-history-button">▤ Lịch sử gọi món</button></div>`);
main.insertAdjacentHTML('beforeend',`<section id="customer-history-view" hidden><div class="guest-history-header"><button type="button" data-close-history>← Thực đơn</button><h1 tabindex="-1">Lịch sử gọi món</h1><p>Các lượt gọi trong phiên phục vụ hiện tại</p></div>${customerOrderHistory(fixtureOrders)}</section>`);
const previewToast=createToast();const fixtureRequests=[];
app.addEventListener('click',event=>{const button=event.target.closest('[data-service]');if(!button||button.disabled)return;fixtureRequests.push({kind:button.dataset.service});app.querySelector('#service-actions').innerHTML=customerServiceActions({sessionOpen:true,requests:fixtureRequests});previewToast.success('Đã gửi yêu cầu','Bản xem thử không gọi nhân viên thật.');});
const cart=app.querySelector('#customer-cart');
let menu, overlay;
let clearIntent=false;
function renderCart() {
  const entries=basket().items;
  cart.innerHTML=`<div class="guest-cart-heading"><h2 id="customer-cart-title">Giỏ món <span>${entries.reduce((s,i)=>s+i.quantity,0)} món</span></h2>${entries.length?'<button type="button" data-clear-cart class="guest-cart-clear">Xóa tất cả</button>':''}</div><div class="guest-cart-scroll">${entries.length?customerCartLines(entries,{productById:id=>products.find(p=>p.id===id)}):'<p>Giỏ chưa có món.</p>'}</div><div class="guest-cart-footer">${clearIntent?'<div class="guest-cart-confirm"><strong>Xóa tất cả món của bàn?</strong><div><button type="button" data-cancel-clear>Giữ lại</button><button type="button" data-confirm-clear>Xóa tất cả</button></div></div>':''}<div class="total">Tạm tính <b>${money(customerBasketPricing(basket()).total)}</b></div><button class="primary" data-demo-submit ${!clearIntent&&cartCheckoutable(entries,{sessionOpen:true,busy:false})?'': 'disabled'}>Gửi yêu cầu cho nhân viên</button><small>Bản xem thử chỉ mô phỏng, không gửi đơn thật.</small><p data-demo-status role="status"></p></div>`;
}
function changeQuantity(id,delta,source,note) {
  if(note)notes.set(id,note);
  const quantity=Math.max(0,(quantities.get(id)||0)+delta);
  if(quantity) quantities.set(id,quantity);else quantities.delete(id);
  renderCart();menu?.update();overlay?.update();
  if(delta>0) overlay?.added(products.find(p=>p.id===id).name,source);
}
renderCart();
menu=createCustomerMenu({root:app.querySelector('#customer-menu'),products,quantityOf:id=>quantities.get(id)||0,changeQuantity,sessionOpen:true,getLine:id=>basket().items.find(item=>item.productId===id)});
overlay=createCustomerCartOverlay({root:app,summary:()=>({count:[...quantities.values()].reduce((s,q)=>s+q,0),total:money(customerBasketPricing(basket()).total),busy:false})});
cart.addEventListener('click',event=>{
  if(event.target.closest('[data-demo-submit]')){cart.querySelector('[data-demo-status]').textContent='Đã mô phỏng gửi yêu cầu. Không có đơn thật được tạo.';return;}
  const remove=event.target.closest('[data-remove]');
  const minus=event.target.closest('[data-cart-minus]'),plus=event.target.closest('[data-cart-plus]');
  if(remove) changeQuantity(Number(remove.dataset.remove),-(quantities.get(Number(remove.dataset.remove))||0));
  if(minus||plus) changeQuantity(Number((minus||plus).dataset[minus?'cartMinus':'cartPlus']),minus?-1:1);
  if(event.target.closest('[data-clear-cart]')){clearIntent=true;renderCart();}
  if(event.target.closest('[data-cancel-clear]')){clearIntent=false;renderCart();}
  if(event.target.closest('[data-confirm-clear]')){clearIntent=false;quantities.clear();renderCart();menu.update();overlay.update();}
});
createCustomerViews({root:app,beforeNavigate:()=>{overlay.close();menu.closeDetails();}});
cart.addEventListener('input',event=>{if(event.target.hasAttribute('data-note')) notes.set(Number(event.target.dataset.note),event.target.value);});

import '../src/ui-foundation.css';
