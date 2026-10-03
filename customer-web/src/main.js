import './style.css';
import '../../src/font.css';

const api = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080').replace(/\/$/, '');
const token = location.pathname.match(/^\/t\/([a-f0-9]{64})$/)?.[1];
const app = document.querySelector('#app');
const money = value => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const orderHistoryKey=token?`dusko-order-history:${token}`:'';
const state = { data: null, cart: new Map(), notes: new Map(), orders: token?JSON.parse(localStorage.getItem(orderHistoryKey)||'[]'):[], busy: false, message: '' };
async function request(path, options = {}) {
  const response = await fetch(`${api}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) { const error=Error(payload.error || 'Không kết nối được máy chủ');error.status=response.status;throw error; }
  return payload.data;
}
function render() {
  if (!state.data) return;
  const { branch, table, sessionOpen, products } = state.data;
  const entries = [...state.cart.entries()].filter(([, quantity]) => quantity > 0);
  const total = entries.reduce((sum, [id, quantity]) => sum + products.find(p => p.id === id).sellingPrice * quantity, 0);
  app.innerHTML = `<header><div class="brand">DUSKO <span>RESTAURANT</span></div><p>Gọi món tại bàn</p></header>
    <main><section class="hero"><div><small>CHI NHÁNH</small><h1>${escape(branch.name)}</h1></div><strong>${escape(table.name)}</strong></section>
    <p class="notice ${sessionOpen ? '' : 'closed'}">${sessionOpen ? 'Bàn đang phục vụ · Bạn có thể gọi thêm món' : 'Bàn chưa mở phiên phục vụ. Vui lòng gọi nhân viên để được hỗ trợ.'}</p>
    <div id="service-actions">${serviceActions()}</div>
    <p id="customer-message" class="message" role="status" ${state.message?'':'hidden'}>${escape(state.message)}</p>
    ${state.orders.length ? `<section class="receipt"><h2>Các lượt gọi món của bạn</h2>${state.orders.map(order=>`<article class="tracked-order"><p>Lượt gọi lúc <b>${new Date(order.createdAt).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})}</b></p><p class="tracked-status" data-order-status="${escape(order.id)}">Đang tải trạng thái…</p></article>`).join('')}</section>` : ''}
    <div class="customer-layout"><section class="customer-menu"><div class="toolbar"><h2>Thực đơn</h2><div class="menu-filters"><input id="search" type="search" placeholder="Tìm món ăn" aria-label="Tìm món ăn"><select id="category" aria-label="Lọc nhóm món"><option value="ALL">Tất cả nhóm món</option>${[...new Set(products.map(p=>p.category.name))].map(name=>`<option value="${escape(name)}">${escape(name)}</option>`).join('')}</select></div></div>
    <div id="menu" class="menu">${products.map(p => `<article class="dish ${p.canOrder?'':'unavailable'}" data-product="${p.id}" data-name="${escape(p.name.toLowerCase())}" data-category="${escape(p.category.name)}"><div class="photo">${p.imageUrl ? `<img src="${escape(p.imageUrl.startsWith('http') ? p.imageUrl : api + p.imageUrl)}" alt="${escape(p.name)}" loading="lazy">` : '<span>Chưa có ảnh</span>'}</div><div class="dish-body"><small>${escape(p.category.name)}</small><h3>${escape(p.name)}</h3><b>${money(p.sellingPrice)}</b>${p.canOrder?`<div class="stepper"><button data-minus="${p.id}" aria-label="Giảm ${escape(p.name)}">−</button><span data-quantity="${p.id}">${state.cart.get(p.id) || 0}</span><button data-plus="${p.id}" aria-label="Thêm ${escape(p.name)}">+</button></div>`:`<p class="unavailable-note">${escape(p.availabilityReason||'Tạm chưa thể đặt')}. Vui lòng hỏi nhân viên.</p>`}</div></article>`).join('')}</div>
    </section><section class="cart" id="customer-cart">${cartHtml()}</section></div></main>`;
  bindQuantityControls();
  app.querySelectorAll('[data-note]').forEach(input => input.oninput = () => state.notes.set(Number(input.dataset.note), input.value));
  const filterMenu=()=>{const query=app.querySelector('#search').value.trim().toLowerCase(),category=app.querySelector('#category').value;app.querySelectorAll('.dish').forEach(dish=>dish.hidden=!dish.dataset.name.includes(query)||(category!=='ALL'&&dish.dataset.category!==category));};
  app.querySelector('#search').oninput = filterMenu;
  app.querySelector('#category').onchange = filterMenu;
  app.querySelector('#submit').onclick = submit;
  if (state.orders.length) updateStatus();
}

let serviceBusy=false;
function serviceActions(){if(!state.data?.sessionOpen)return '';return `<div class="service-actions">${[['ASSISTANCE','Gọi nhân viên'],['BILL','Yêu cầu thanh toán']].map(([kind,label])=>{const pending=state.data.serviceRequests?.some(r=>r.kind===kind);return `<button type="button" data-service="${kind}" ${pending||serviceBusy?'disabled':''}>${pending?`${label} · đã gửi`:label}</button>`;}).join('')}</div><small class="service-hint">Nhân viên sẽ đến bàn hỗ trợ. Yêu cầu thanh toán chưa phải là xác nhận đã trả tiền.</small>`;}
app.addEventListener('click',async event=>{const button=event.target.closest('[data-service]');if(!button||button.disabled||serviceBusy)return;serviceBusy=true;app.querySelector('#service-actions').innerHTML=serviceActions();try{const call=await request(`/api/public/tables/${token}/service-requests`,{method:'POST',body:JSON.stringify({kind:button.dataset.service})});state.data.serviceRequests=[...(state.data.serviceRequests||[]).filter(r=>r.kind!==call.kind),call];const message=app.querySelector('#customer-message');message.textContent='Đã gửi yêu cầu đến nhân viên của bàn.';message.hidden=false;}catch(error){const message=app.querySelector('#customer-message');message.textContent=error.message;message.hidden=false;}finally{serviceBusy=false;app.querySelector('#service-actions').innerHTML=serviceActions();}});

function cartHtml() {
  const {products,sessionOpen}=state.data;
  const entries=[...state.cart.entries()].filter(([,q])=>q>0);
  const total=entries.reduce((n,[id,q])=>n+products.find(p=>p.id===id).sellingPrice*q,0);
  return `<h2>Giỏ hàng <span>${entries.reduce((sum, [, quantity]) => sum + quantity, 0)} món</span></h2>${entries.length ? entries.map(([id, quantity]) => { const p = products.find(item => item.id === id); return `<div class="cart-item"><p>${escape(p.name)} × ${quantity}<b>${money(p.sellingPrice * quantity)}</b></p>${p.canOrder?'':`<small>${escape(p.availabilityReason||'Món không còn sẵn sàng')}</small>`}<button type="button" data-remove="${id}" class="cart-remove">Bỏ món này</button><input data-note="${id}" maxlength="500" value="${escape(state.notes.get(id) || '')}" placeholder="Ghi chú: ít cay, không hành…"></div>`; }).join('') : '<p>Chọn món từ thực đơn phía trên.</p>'}<div class="total">Tạm tính <b>${money(total)}</b></div><button id="submit" class="primary" ${!sessionOpen || !entries.length || state.busy || entries.some(([id,q])=>{const p=products.find(p=>p.id===id);return !p?.canOrder||q>(p.maxOrderQuantity??1000)}) ? 'disabled' : ''}>${state.busy ? 'Đang gửi…' : 'Gửi yêu cầu cho nhân viên'}</button><small>Thanh toán tại quầy hoặc qua nhân viên. Giá được kiểm tra lại khi gửi.</small>`;
}
function updateCart(id) {
  const counter=app.querySelector(`[data-quantity="${id}"]`);if(counter)counter.textContent=state.cart.get(id)||0;
  const holder=app.querySelector('#customer-cart');if(!holder)return;holder.innerHTML=cartHtml();
  holder.querySelectorAll('[data-note]').forEach(input=>input.oninput=()=>state.notes.set(Number(input.dataset.note),input.value));
  holder.querySelector('#submit').onclick=submit;
}

async function submit() {
  if (state.busy || !state.data.sessionOpen) return;
  const items = [...state.cart.entries()].filter(([, quantity]) => quantity > 0).map(([id, quantity]) => ({ productId: id, quantity, price: state.data.products.find(p => p.id === id).sellingPrice, ...(state.notes.get(id)?.trim() ? { note: state.notes.get(id).trim() } : {}) }));
  if (!items.length || !confirm(`Gửi ${items.reduce((n, item) => n + item.quantity, 0)} món cho ${state.data.table.name}?`)) return;
  state.busy = true; state.message = ''; render();
  const pendingKey = `dusko-pending-${token}`;
  let pending = JSON.parse(localStorage.getItem(pendingKey) || 'null');
  if (!pending || pending.sessionId !== state.data.sessionId || JSON.stringify(pending.items) !== JSON.stringify(items)) { pending = { id: crypto.randomUUID(), sessionId:state.data.sessionId, items }; localStorage.setItem(pendingKey, JSON.stringify(pending)); }
  try { const result = await request(`/api/public/tables/${token}/orders`, { method: 'POST', body: JSON.stringify(pending) }); state.orders=[...state.orders.filter(order=>order.id!==result.order.id),result.order];localStorage.setItem(orderHistoryKey,JSON.stringify(state.orders));state.cart.clear(); state.notes.clear(); localStorage.removeItem(pendingKey); state.message = result.awaitingStaffConfirmation ? 'Đã gửi yêu cầu. Nhân viên sẽ tới bàn xác nhận trước khi chuyển món xuống bếp.' : 'Lượt gọi món đã được hệ thống ghi nhận.'; }
  catch (error) { state.message = `${error.message}. Nếu mất mạng, hãy thử lại; yêu cầu đang giữ cùng mã để tránh tạo trùng.`; }
  finally { state.busy = false; render(); }
}
async function updateStatus() {
  if(!state.orders.length)return;
  const results=await Promise.all(state.orders.map(async order=>{try{return await request(`/api/public/tables/${token}/orders/${order.id}`);}catch(error){return error.status===404?null:order;}}));
  state.orders=results.filter(Boolean);localStorage.setItem(orderHistoryKey,JSON.stringify(state.orders));
  for(const order of state.orders) {
    const element=document.querySelector(`[data-order-status="${CSS.escape(order.id)}"]`);if(!element)continue;
    if(order.status==='AWAITING_CONFIRMATION') {element.textContent='Chờ nhân viên tới bàn xác nhận. Món chưa chuyển vào bếp.';continue;}
    if(order.status==='CANCELLED') {element.textContent=`Yêu cầu đã được từ chối: ${order.note||'Vui lòng hỏi nhân viên.'}`;continue;}
    const label=item=>item.servedAt?'Đã mang ra bàn':item.kdsStatus==='DONE'?'Sẵn sàng phục vụ':item.kdsStatus==='COOKING'?'Đang chế biến':'Đang chờ chế biến';
    element.textContent=`${order.status==='PAID'?'Đã thanh toán':'Đã nhận yêu cầu'} · ${order.items.map(item=>`${item.product.name} × ${item.quantity}: ${label(item)}`).join('; ')}`;
  }
}
function bindQuantityControls() {
  app.querySelectorAll('[data-plus]').forEach(button => button.onclick = () => { const id = Number(button.dataset.plus); state.cart.set(id, Math.min(1000, state.data.products.find(p=>p.id===id)?.maxOrderQuantity??1000, (state.cart.get(id) || 0) + 1)); updateCart(id); });
  app.querySelectorAll('[data-minus]').forEach(button => button.onclick = () => { const id = Number(button.dataset.minus); state.cart.set(id, Math.max(0, (state.cart.get(id) || 0) - 1)); updateCart(id); });
}
async function refreshTable() {
  try {
    const data=await request(`/api/public/tables/${token}`);
    const changed=state.data?.sessionId!==data.sessionId;
    if(changed&&!state.busy) {state.cart.clear();state.notes.clear();state.orders=[];localStorage.removeItem(orderHistoryKey);state.message=data.sessionOpen?'Bàn đã mở lượt phục vụ mới. Bạn có thể chọn món.':'Bàn đã kết thúc phục vụ. Vui lòng nhờ nhân viên nếu cần hỗ trợ.';}
    if(!state.busy) {
      const previous=state.data;
      const removed=previous.products.filter(p=>state.cart.has(p.id)&&!data.products.some(n=>n.id===p.id));
      data.products.push(...removed.map(p=>({...p,canOrder:false,maxOrderQuantity:0,availabilityReason:'Đã ngừng bán'})));
      const cartChanged=data.products.some(p=>state.cart.has(p.id)&&previous.products.some(old=>old.id===p.id&&(old.sellingPrice!==p.sellingPrice||old.canOrder!==p.canOrder)));
      state.data=data;const actions=app.querySelector('#service-actions');if(actions)actions.innerHTML=serviceActions();
      if(cartChanged){state.message='Một số món trong giỏ vừa thay đổi giá hoặc tình trạng còn hàng. Vui lòng kiểm tra trước khi gửi.';const notice=app.querySelector('#customer-message');if(notice){notice.textContent=state.message;notice.hidden=false;}}

      if(changed)render();else {
        for(const p of data.products) {
          const old=previous?.products.find(x=>x.id===p.id);const dish=app.querySelector(`.dish[data-product="${p.id}"]`);if(!dish)continue;
          dish.classList.toggle('unavailable',!p.canOrder);
          if(old?.canOrder!==p.canOrder||old?.availabilityReason!==p.availabilityReason) {
            dish.querySelector('.stepper,.unavailable-note')?.remove();
            const controls=document.createElement('div');controls.innerHTML=p.canOrder?`<div class="stepper"><button data-minus="${p.id}" aria-label="Giảm ${escape(p.name)}">−</button><span data-quantity="${p.id}">${state.cart.get(p.id)||0}</span><button data-plus="${p.id}" aria-label="Thêm ${escape(p.name)}">+</button></div>`:`<p class="unavailable-note">${escape(p.availabilityReason)}. Vui lòng hỏi nhân viên.</p>`;
            dish.querySelector('.dish-body').append(controls.firstElementChild);
          }
          dish.querySelector('.dish-body>b').textContent=money(p.sellingPrice);
        }
        bindQuantityControls();
        const cart=app.querySelector('#customer-cart');
        if(cart){const entries=[...state.cart].filter(([,q])=>q>0);cart.querySelector('.total b').textContent=money(entries.reduce((sum,[id,q])=>sum+data.products.find(p=>p.id===id).sellingPrice*q,0));const submitButton=cart.querySelector('#submit');submitButton.disabled=!data.sessionOpen||!entries.length||entries.some(([id,q])=>{const p=data.products.find(p=>p.id===id);return !p?.canOrder||q>(p.maxOrderQuantity??1000)});cart.querySelectorAll('[data-remove]').forEach(button=>{const id=Number(button.dataset.remove),p=data.products.find(p=>p.id===id);button.closest('.cart-item').querySelector('b').textContent=money(p.sellingPrice*(state.cart.get(id)||0));});}

      }
    }
    await updateStatus();
  } catch { /* Keep the menu usable during a temporary connection failure. */ }
}
async function load() { if (!token) { app.innerHTML = '<main><h1>Mã QR không hợp lệ</h1><p>Vui lòng nhờ nhân viên kiểm tra mã tại bàn.</p></main>'; return; } try { state.data = await request(`/api/public/tables/${token}`); await updateStatus();render(); setInterval(refreshTable, 15000); } catch (error) { app.innerHTML = `<main><h1>Không mở được thực đơn</h1><p>${escape(error.message)}</p><p>Vui lòng gọi nhân viên.</p></main>`; } }
app.addEventListener('click',event=>{const button=event.target.closest('[data-remove]');if(!button)return;const id=Number(button.dataset.remove);state.cart.delete(id);state.notes.delete(id);updateCart(id);});
load();
