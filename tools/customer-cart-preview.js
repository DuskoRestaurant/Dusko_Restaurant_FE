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
];
const products=base.flatMap(([category,name,sellingPrice,image],group)=>Array.from({length:13},(_,i)=>({id:group*100+i+1,name:i===0?name:`${name} ${i+1}`,sellingPrice,imageUrl:`/dishes/${image}.webp`,category:{name:category},canOrder:i!==12,availabilityReason:'Tạm hết',maxOrderQuantity:30,tags:group===0&&i<2||group===1&&i===0?['BEST_SELLER']:group===2?['VEGETARIAN']:group===3?['SPICY']:[],description:'Món được chuẩn bị khi bạn gọi. Có thể gửi ghi chú để nhân viên xác nhận.'})));
const quantities=new Map(), notes=new Map();
const basket=()=>({items:[...quantities].map(([id,quantity])=>({...products.find(p=>p.id===id),productId:id,quantity,note:notes.get(id)||''})),combos:[]});
app.innerHTML='<header><div class="brand">DUSKO</div><p>Bàn 02</p></header><main><section class="hero"><h1>Chi nhánh Quận 1</h1></section><p class="notice">BẢN XEM THỬ · 78 món giả lập · Không gửi đơn</p><div class="customer-layout"><section class="customer-menu" id="customer-menu"></section><section class="cart" id="customer-cart"></section></div></main><aside class="restaurant-help"><button class="help-toggle" type="button" aria-label="Hỏi nhà hàng" title="Hỏi nhà hàng"><svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M20 11.5a8 8 0 0 1-8 8H5l-3 2v-7a8 8 0 1 1 18-3Z" stroke-linejoin="round"/><path d="M7 10h8M7 14h5" stroke-linecap="round"/></svg></button></aside>';
const cart=app.querySelector('#customer-cart');
let menu, overlay;
function renderCart() {
  const entries=basket().items;
  cart.innerHTML=`<h2>Giỏ món <span>${entries.reduce((s,i)=>s+i.quantity,0)} món</span></h2>${entries.map(item=>`<div class="cart-item"><p>${escape(item.name)} × ${item.quantity}<b>${money(item.sellingPrice*item.quantity)}</b></p><div class="cart-stepper"><button type="button" data-cart-delta="-1" data-id="${item.id}" aria-label="Giảm ${escape(item.name)}">−</button><span>${item.quantity}</span><button type="button" data-cart-delta="1" data-id="${item.id}" aria-label="Tăng ${escape(item.name)}">+</button></div><input data-note="${item.id}" aria-label="Ghi chú ${escape(item.name)}" value="${escape(notes.get(item.id)||'')}" placeholder="Ghi chú: ít cay, không hành…"></div>`).join('') || '<p>Giỏ chưa có món. Chọn món bạn thích trong thực đơn nhé.</p>'}<div class="total">Tạm tính <b>${money(customerBasketPricing(basket()).total)}</b></div><button class="primary" data-demo-submit ${cartCheckoutable(entries,{sessionOpen:true,busy:false})?'': 'disabled'}>Gửi yêu cầu cho nhân viên</button><small>Bản xem thử chỉ mô phỏng, không gửi đơn thật.</small><p data-demo-status role="status"></p>`;
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
  const button=event.target.closest('[data-cart-delta]');
  if(button) changeQuantity(Number(button.dataset.id),Number(button.dataset.cartDelta),button);
});
cart.addEventListener('input',event=>{if(event.target.hasAttribute('data-note')) notes.set(Number(event.target.dataset.note),event.target.value);});
