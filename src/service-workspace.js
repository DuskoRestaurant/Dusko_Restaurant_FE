import {openReceipt} from './receipt.js';
import { showVnpayPayment } from './vnpay-payment.js';
import { watchChanges } from './live-updates.js';
import { sharedToast } from './toast.js';
import './service-workspace.css';
import { showQrPreview } from './qr-preview.js';
import { confirmDialog } from './confirm-dialog.js';

const e = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'})[c]);
const money = value => new Intl.NumberFormat('vi-VN', {style:'currency', currency:'VND'}).format(value || 0);
const time = value => new Date(value).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'});
const shortCode = order => String(order.orderCode || order.id).replace(/^HD-/, '').slice(0, 8).toUpperCase();
const statusText = item => item.servedAt ? 'Đã mang ra bàn' : item.kdsStatus === 'DONE' ? 'Sẵn sàng mang ra' : item.kdsStatus === 'COOKING' ? 'Đang chế biến' : 'Đang chờ chế biến';

/** Shared table workflow for the cashier desktop and the staff phone app. */
export function createServiceWorkspace({root, request, branchId, role, userId, imageBase = '', initialData}) {
  root.classList.add('service-workspace');
  // Shares the console toast stack so the workspace and the shell announce
  // through one live region instead of two.
  const toast = sharedToast();
  const state = {tables:[], products:[], table:null, session:null, tab:'confirm', filter:'ALL', search:'', menuSearch:'', category:'ALL', cart:new Map(), notes:new Map(), busy:false, message:'', bad:false, draft:null,serviceRequests:[]};
  let disposed = false;
  let closeVnpay;
  let selection = 0;
  let polling = false;
  let liveConnected = false;
  let panelSnapshot = '';
  let productsAt=initialData?.products?Date.now():0, productsPending;
  if(initialData){state.tables=initialData.tables||[];state.products=initialData.products||[];}
  function loadProducts(force=false){
    if(productsPending)return productsPending;
    if(!force&&productsAt&&Date.now()-productsAt<12000)return Promise.resolve(state.products);
    productsPending=request('/api/catalog/products').then(products=>{productsAt=Date.now();return products;}).finally(()=>productsPending=null);
    return productsPending;
  }

  const mayPay = ['ADMIN','MANAGER','CASHIER'].includes(role);
  const post = (path, body = {}) => request(path, {method:'POST', body:{branchId, ...body}});
  const draftKey = id => `dusko-service-draft:${userId}:${branchId}:${id}`;
  const activeOrders = () => (state.session?.orders || []).filter(order => order.status === 'PENDING');
  const waitingOrders = () => (state.session?.orders || []).filter(order => order.status === 'AWAITING_CONFIRMATION');
  const readyItems = () => activeOrders().flatMap(order => order.items.map(item => ({...item, order}))).filter(item => item.kdsStatus === 'DONE' && !item.servedAt);
  const unsettledItems = () => activeOrders().flatMap(order => order.items).filter(item => !item.servedAt || item.kdsStatus !== 'DONE');
  const total = () => activeOrders().reduce((sum, order) => sum + order.finalAmount, 0);
  const quantities = items => items.reduce((sum, item) => sum + item.quantity, 0);
  const button = (label, action, extra = '', primary = false) => `<button type="button" class="sw-button ${primary?'sw-primary':''}" data-sw="${action}" ${extra}>${label}</button>`;
  const productImageUrl = product => { const source=product?.imageUrl||'';if(source.startsWith('/dishes/'))return source;if(source.startsWith('/api/uploads/'))return `${imageBase}${source}`;if(/^https?:\/\//i.test(source))return source;return ''; };
  const foodPhoto = product => { const url=productImageUrl(product);return `<span class="sw-line-photo">${url?`<img src="${e(url)}" alt="${e(product?.name||'Món ăn')}" loading="lazy">`:'<span aria-hidden="true">🍽</span>'}</span>`; };
  const empty = (text, detail = '') => `<div class="sw-empty"><strong>${text}</strong>${detail?`<p>${detail}</p>`:''}</div>`;
  function showMessage(message, bad = false) { state.message = message; state.bad = bad; const el = root.querySelector('[data-sw-message]'); if(el) { el.textContent = message; el.classList.toggle('sw-error', bad); el.hidden = !message; } }
  function setBusy(busy) { state.busy = busy; root.setAttribute('aria-busy',String(busy)); root.querySelectorAll('button[data-sw]').forEach(el => el.disabled = busy || el.dataset.locked === 'true'); }
  function tableCards() {
    const tables = state.tables.filter(table => table.tableName.toLowerCase().includes(state.search.toLowerCase()) && (state.filter==='ALL' || state.filter==='CALL' && table.serviceRequestCount || state.filter==='CONFIRM' && table.unconfirmedOrderCount || state.filter==='READY' && table.readyQuantity || state.filter==='EMPTY' && table.status==='EMPTY'));
    tables.sort((a,b) => Number(Boolean(b.serviceRequestCount))*20 + Number(Boolean(b.unconfirmedOrderCount))*10 + Number(Boolean(b.readyQuantity))*5 - Number(Boolean(a.serviceRequestCount))*20 - Number(Boolean(a.unconfirmedOrderCount))*10 - Number(Boolean(a.readyQuantity))*5 || a.tableName.localeCompare(b.tableName,'vi',{numeric:true}));
    return tables.map(table => `<button type="button" class="sw-table ${table.serviceRequestCount||table.unconfirmedOrderCount||table.readyQuantity?'sw-attention':''}" data-state="${table.status}" data-sw="table" data-id="${table.id}"><span class="sw-table-state">${table.status==='EMPTY'?'Trống':table.status==='RESERVED'?'Đã đặt trước':'Đang phục vụ'}</span><strong>${e(table.tableName)}</strong><small>${table.seatingCapacity} chỗ</small><div>${table.serviceRequestCount?`<b class="sw-table-call">${table.serviceRequestCount} yêu cầu hỗ trợ</b>`:''}${table.unconfirmedOrderCount?`<b class="sw-table-confirm">${table.unconfirmedOrderCount} yêu cầu cần xác nhận</b>`:table.readyQuantity?`<b class="sw-table-ready">${table.readyQuantity} món cần mang ra</b>`:table.pendingOrderCount?'<span>Đang phục vụ món</span>':'<span>Chọn để xem bàn</span>'}</div></button>`).join('') || empty('Không có bàn phù hợp');
  }
  function render() {
    if(disposed) return;
    panelSnapshot = '';
    root.innerHTML = `<p class="sw-message ${state.bad?'sw-error':''}" data-sw-message role="status" ${state.message?'':'hidden'}>${e(state.message)}</p>${state.table?tableView():listView()}`;
    updateCart();
    setBusy(state.busy);
  }
  function listView() {
    return `<section class="sw-service-hero"><div class="sw-hero-copy"><span class="sw-hero-kicker">DUSKO · PHỤC VỤ</span><h2>Không gian phục vụ</h2><p>Theo dõi bàn, xác nhận món khách gọi và mang món ra đúng lúc.</p></div><img src="/dishes/lau-thai.webp" alt="Lẩu Thái trong thực đơn" loading="lazy"></section><div class="sw-heading"><div><h2>Danh sách bàn</h2><p>Chọn bàn để nhận yêu cầu, gọi món hoặc thanh toán.</p></div>${button('Làm mới','refresh')}</div><div class="sw-overview">${listOverview()}</div><div class="sw-filters"><input data-sw-input="table-search" type="search" placeholder="Tìm tên bàn" aria-label="Tìm bàn" value="${e(state.search)}"><select data-sw-input="table-filter" aria-label="Lọc bàn"><option value="ALL">Tất cả bàn</option><option value="CALL" ${state.filter==='CALL'?'selected':''}>Khách cần hỗ trợ</option><option value="CONFIRM" ${state.filter==='CONFIRM'?'selected':''}>Chờ xác nhận</option><option value="READY" ${state.filter==='READY'?'selected':''}>Có món sẵn sàng</option><option value="EMPTY" ${state.filter==='EMPTY'?'selected':''}>Bàn trống</option></select></div><div class="sw-tables">${tableCards()}</div><p class="sw-guide"><strong>Quy trình:</strong> Mở bàn → xác nhận yêu cầu QR hoặc gọi món giúp khách → mang món đã hoàn thành ra bàn.</p>`;
  }
  const mayCloseEmpty = () => Boolean(state.session) && !(state.session.orders||[]).some(order=>['AWAITING_CONFIRMATION','PENDING'].includes(order.status));
  function tableView() {
    const table = state.table;
    return `<div class="sw-heading"><div>${button('← Danh sách bàn','back')}<h2>${e(table.tableName)}</h2><p>${state.session?'Đang phục vụ · các lần gọi món dùng chung một hóa đơn':table.status==='RESERVED'?'Bàn đang được đặt trước. Quản lý cần cập nhật tình trạng bàn.':'Bàn chưa mở phục vụ'}</p></div><div class="sw-actions">${button('Xem QR','view-qr')}<span data-sw-empty-close>${mayCloseEmpty()?button('Đóng bàn chưa gọi món','close'):''}</span>${button('Làm mới','refresh')}</div></div>${state.session?`<div data-sw-calls>${serviceCalls()}</div><div class="sw-table-summary" data-sw-summary>${summary()}</div><div class="sw-tabs" role="tablist" aria-label="Công việc tại bàn">${tabs()}</div><div class="sw-content" data-sw-panel>${panel()}</div>`:`<div class="sw-empty"><h3>${table.pendingOrderCount?'Bàn còn đơn cũ chưa thanh toán':'Khách đã đến bàn?'}</h3><p>${table.pendingOrderCount?'Thu ngân cần xử lý đơn cũ trong mục Mang đi và đơn cũ trước khi mở bàn.':'Mở bàn để khách sử dụng QR cố định hoặc để nhân viên gọi món.'}</p>${button('Mở bàn phục vụ','open',table.status==='RESERVED'||table.pendingOrderCount?'data-locked="true"':'',true)}</div>`}`;
  }
  function serviceCalls(){return (state.serviceRequests||[]).map(call=>`<div class="sw-service-call"><div><strong>${call.kind==='BILL'?'Khách yêu cầu thanh toán':'Khách cần nhân viên hỗ trợ'}</strong><small>Gửi lúc ${time(call.createdAt)}</small></div>${button('Đã hỗ trợ','resolve-call',`data-id="${call.id}"`)}</div>`).join('');}
  function summary() { return `<span><b>${waitingOrders().length}</b> chờ xác nhận</span><span><b>${quantities(readyItems())}</b> món sẵn sàng</span><span><b>${money(total())}</b> đã nhận</span>`; }
  function tabs() { return [['confirm','Chờ xác nhận',waitingOrders().length],['ready','Món sẵn sàng',quantities(readyItems())],['menu','Gọi thêm',null],['bill','Hóa đơn',null]].map(([id,label,count])=>`<button type="button" role="tab" aria-selected="${state.tab===id}" class="${state.tab===id?'sw-active':''}" data-sw="tab" data-tab="${id}">${label}${count?` <span>${count}</span>`:''}</button>`).join(''); }
  function draftView() { return state.draft?`<aside class="sw-draft"><strong>Có lượt gọi món chưa gửi thành công</strong><p>${state.draft.items.map(item=>`${e(state.products.find(p=>p.id===item.productId)?.name||'Món')} × ${item.quantity}`).join(' · ')}. Máy chủ có thể chưa nhận; thử lại dùng cùng mã để tránh tạo trùng.</p>${state.draft.sessionId===state.session.id?button('Thử gửi lại','retry'): '<p>Bản nháp thuộc phiên bàn trước, không được gửi cho khách mới.</p>'}${button('Xóa bản nháp','discard')}</aside>`:''; }
  function panel() {
    if(state.tab==='confirm') return `<h3>Kiểm tra yêu cầu với khách tại bàn</h3><p class="sw-help">Xác nhận sau khi đọc lại món và ghi chú. Món cần chế biến tự chuyển vào bếp; món phục vụ trực tiếp chuyển sang mục Món sẵn sàng.</p>${waitingOrders().map(order=>`<article class="sw-order"><div class="sw-order-head"><strong>Khách gửi lúc ${time(order.createdAt)}</strong><small>Lượt ${e(shortCode(order))}</small></div><ul>${order.items.map(item=>`<li><div class="sw-line-item">${foodPhoto(item.product)}<div><b>${e(item.product.name)} × ${item.quantity}</b>${item.note?`<p class="sw-note">${e(item.note)}</p>`:''}</div></div><span>${money(item.price*item.quantity)}</span></li>`).join('')}</ul><div class="sw-actions">${button('Đã kiểm tra · Nhận yêu cầu','confirm',`data-id="${e(order.id)}"`,true)}${button('Từ chối','show-reject',`data-id="${e(order.id)}"`)}</div><div class="sw-reject" data-reject="${e(order.id)}" hidden><label>Lý do từ chối<input maxlength="500" placeholder="Ví dụ: khách gửi nhầm món" data-reason="${e(order.id)}"></label>${button('Xác nhận từ chối','reject',`data-id="${e(order.id)}"`)}</div></article>`).join('')||empty('Không có yêu cầu chờ xác nhận','Nhân viên gọi món trực tiếp ở mục Gọi thêm. Yêu cầu mới từ QR sẽ xuất hiện ở đây.')}`;
    if(state.tab==='ready') { const ready = readyItems(); const cooking = activeOrders().flatMap(o=>o.items).filter(i=>i.kdsStatus!=='DONE'); return `<h3>Mang món đến ${e(state.table.tableName)}</h3><p class="sw-help">Chỉ đánh dấu sau khi món đã tới bàn. Nước và món làm sẵn xuất hiện ở đây ngay sau khi nhận yêu cầu.</p>${ready.map(item=>`<article class="sw-ready"><div class="sw-line-item">${foodPhoto(item.product)}<div><strong>${e(item.product.name)} × ${item.quantity}</strong><small>${item.product.requiresPreparation?'Bếp đã làm xong':'Phục vụ trực tiếp'} · lượt ${e(shortCode(item.order))}</small>${item.note?`<p class="sw-note">${e(item.note)}</p>`:''}</div></div>${button('Đã mang ra','serve',`data-item="${item.id}"`,true)}</article>`).join('')||empty('Chưa có món cần mang ra')}${cooking.length?`<div class="sw-progress"><h4>Bếp đang xử lý</h4>${cooking.map(item=>`<p><b>${e(item.product.name)} × ${item.quantity}</b><span>${statusText(item)}</span></p>`).join('')}</div>`:''}`; }
    if(state.tab==='menu') return `${draftView()}<h3>Chọn món cho bàn</h3><a class="pos-cart-jump" href="#sw-cart">Xem giỏ món ↓</a><p class="sw-help">Kiểm tra giỏ món rồi gửi. Yêu cầu do nhân viên nhập được nhận ngay, không cần xác nhận lần nữa.</p><div class="sw-filters"><input data-sw-input="menu-search" type="search" placeholder="Tìm món" aria-label="Tìm món" value="${e(state.menuSearch)}"><select data-sw-input="category" aria-label="Nhóm món"><option value="ALL">Tất cả nhóm</option>${[...new Set(state.products.map(p=>p.category?.name).filter(Boolean))].map(name=>`<option ${state.category===name?'selected':''}>${e(name)}</option>`).join('')}</select></div><div class="sw-menu-layout"><div class="sw-products">${state.products.filter(p=>p.isActive).map(p=>`<article class="sw-product" data-name="${e(p.name.toLowerCase())}" data-category="${e(p.category?.name||'')}" ${p.name.toLowerCase().includes(state.menuSearch.toLowerCase())&&(state.category==='ALL'||state.category===p.category?.name)?'':'hidden'}><div class="sw-photo">${productImageUrl(p)?`<img src="${e(productImageUrl(p))}" alt="${e(p.name)}" loading="lazy">`:'<span>Chưa có ảnh</span>'}</div><div><strong>${e(p.name)}</strong><span>${money(p.sellingPrice)}</span><small data-sw-stock="${p.id}">${p.canOrder===false?e(p.availabilityReason||'Tạm chưa thể đặt'):p.requiresPreparation?'Bếp chế biến':'Phục vụ trực tiếp'}</small></div>${button('+','add',`data-product="${p.id}" aria-label="Thêm ${e(p.name)}" ${p.canOrder===false||state.draft?'data-locked="true"':''}`)}</article>`).join('')}</div><section class="sw-cart" id="sw-cart" data-sw-cart></section></div>`;
    const orders = activeOrders(); const waiting = waitingOrders().length; const remaining = unsettledItems();
    return `<h3>Hóa đơn chung của bàn</h3><p class="sw-help">Tổng tiền chỉ gồm các lượt đã nhận. Lượt chờ xác nhận hoặc bị từ chối chưa được tính tiền.</p>${orders.map(order=>`<article class="sw-order"><div class="sw-order-head"><strong>Lượt ${time(order.createdAt)}</strong><small>${order.source==='CUSTOMER_QR'?'Khách gửi QR':'Nhân viên gọi món'}</small></div><ul>${order.items.map(item=>`<li><div><b>${e(item.product.name)} × ${item.quantity}</b><small>${statusText(item)}</small></div><span>${money(item.price*item.quantity)}</span></li>`).join('')}</ul>${order.discountAmount?`<p class="sw-help">Ưu đãi combo: −${money(order.discountAmount)}</p><p><strong>Thành tiền: ${money(order.finalAmount)}</strong></p>`:''}</article>`).join('')||empty('Chưa có món đã nhận')}<div class="sw-bill-total"><span>Tổng thanh toán</span><strong>${money(total())}</strong></div>${waiting?`<p class="sw-alert">Còn ${waiting} yêu cầu cần xác nhận hoặc từ chối.</p>${button('Xử lý yêu cầu','tab','data-tab="confirm"')}`:remaining.length?`<p class="sw-alert">Còn ${quantities(remaining)} món chưa mang ra bàn.</p>${button('Xem món đang phục vụ','tab','data-tab="ready"')}`:orders.length?(mayPay?`<div class="sw-payment"><label>Phương thức thanh toán<select data-sw-input="payment"><option value="CASH">Tiền mặt</option><option value="QR_BANKING">VNPay</option><option value="POS_CARD">Thẻ</option></select></label><p class="sw-help">Chọn VNPay để khách quét mã thanh toán. Với tiền mặt hoặc thẻ, xác nhận sau khi đã nhận đủ tiền.</p>${button('Thanh toán','checkout','',true)}</div>`:'<p class="sw-alert">Bàn đã phục vụ đủ món. Báo thu ngân để nhận tiền và đóng bàn.</p>'):`${button('Đóng bàn chưa gọi món','close','',false)}`} ${(state.session.orders||[]).filter(o=>o.status==='CANCELLED').length?`<details class="sw-history"><summary>Các yêu cầu đã từ chối</summary>${state.session.orders.filter(o=>o.status==='CANCELLED').map(o=>`<p>Lượt ${time(o.createdAt)}: ${e(o.note||'Đã từ chối')}</p>`).join('')}</details>`:''}`;
  }
  function updateCart() {
    const holder = root.querySelector('[data-sw-cart]'); if(!holder) return;
    const entries = [...state.cart].filter(([,q])=>q>0);
    const unavailable=entries.some(([id,q])=>{const p=state.products.find(p=>p.id===id);return !p?.canOrder||q>(p.maxOrderQuantity??1000);});
    holder.innerHTML = `<h3>Giỏ món của ${e(state.table.tableName)}</h3>${entries.map(([id,q])=>{const p=state.products.find(p=>p.id===id); return `<div class="sw-cart-item"><div><strong>${e(p.name)}</strong><span>${money(p.sellingPrice*q)}</span></div><div class="sw-stepper">${button('−','minus',`data-product="${id}" aria-label="Giảm ${e(p.name)}"`)}<b>${q}</b>${button('+','add',`data-product="${id}" aria-label="Tăng ${e(p.name)}"`)}</div><input data-sw-input="note" data-product="${id}" maxlength="500" placeholder="Ghi chú: ít cay, không hành…" value="${e(state.notes.get(id)||'')}"></div>`;}).join('')||'<p>Chọn món ở thực đơn.</p>'}<div class="sw-bill-total"><span>Tạm tính</span><strong>${money(entries.reduce((n,[id,q])=>n+state.products.find(p=>p.id===id).sellingPrice*q,0))}</strong></div><p data-sw-cart-warning ${unavailable?'':'hidden'}>Giỏ có món thiếu nguyên liệu hoặc vượt số suất còn lại. Giảm số lượng hoặc bỏ món trước khi gửi.</p>${button(`Gửi ${entries.reduce((n,[,q])=>n+q,0)} món`,'send',entries.length&&!state.draft&&!unavailable?'':'data-locked="true"',true)}`;
    setBusy(state.busy);
  }
  function patchTable() {
    if(!state.session || !root.querySelector('[data-sw-panel]')) { render(); return; }
    root.querySelector('[data-sw-summary]').innerHTML = summary();root.querySelector('[data-sw-calls]').innerHTML=serviceCalls();
    const closeAction = root.querySelector('[data-sw-empty-close]');
    if(closeAction) closeAction.innerHTML = mayCloseEmpty() ? button('Đóng bàn chưa gọi món','close') : '';
    root.querySelector('.sw-tabs').innerHTML = tabs();
    const snapshot = JSON.stringify([state.session.orders, state.tab, state.draft]);
    const holder = root.querySelector('[data-sw-panel]');
    if(state.tab!=='menu' && panelSnapshot!==snapshot && !(holder.contains(document.activeElement) && document.activeElement.matches('input,textarea,select'))) { holder.innerHTML = panel(); panelSnapshot = snapshot; }
    setBusy(state.busy);
  }
  async function refresh(force=false) {
    if(disposed) return;
    if(!state.table) { const [tables,products] = await Promise.all([request(`/api/catalog/branches/${branchId}/tables`),loadProducts(force)]); if(disposed||state.table) return; state.tables=tables;state.products=products; const cards=root.querySelector('.sw-tables'); if(cards) { cards.innerHTML=tableCards(); root.querySelector('.sw-overview').innerHTML=listOverview(); setBusy(state.busy); } else render(); return; }
    const id=state.table.id, version=selection;
    const [result, products] = await Promise.all([request(`/api/staff/tables/${id}/session?branchId=${branchId}`),loadProducts(force)]);
    if(disposed||version!==selection||state.table?.id!==id) return;
    const removed=state.products.filter(p=>state.cart.has(p.id)&&!products.some(n=>n.id===p.id));products.push(...removed.map(p=>({...p,isActive:false,canOrder:false,availabilityReason:'Đã ngừng bán'})));
    const pricesChanged=products.some(p=>state.cart.has(p.id)&&state.products.some(old=>old.id===p.id&&old.sellingPrice!==p.sellingPrice));
    state.products=products;
    if(pricesChanged)showMessage('Giá món trong giỏ vừa thay đổi. Kiểm tra lại trước khi gửi.',true);
    const sessionChanged=state.session?.id!==result.session?.id;
    state.table={...state.table,...result.table}; state.session=result.session;state.serviceRequests=result.serviceRequests||[];
    if(sessionChanged) { if(result.table.status==='EMPTY')state.table.pendingOrderCount=0; state.cart.clear();state.notes.clear();state.draft=readDraft(id);render(); } else {patchTable();
      root.querySelectorAll('[data-sw-stock]').forEach(el=>{const p=products.find(p=>p.id===Number(el.dataset.swStock));el.textContent=p?.canOrder?(p.requiresPreparation?'Bếp chế biến':'Phục vụ trực tiếp'):(p?.availabilityReason||'Đã ngừng bán');});
      root.querySelectorAll('[data-sw="add"]').forEach(el=>{const p=products.find(p=>p.id===Number(el.dataset.product));if(!p?.canOrder||state.draft)el.dataset.locked='true';else delete el.dataset.locked;const card=el.closest('.sw-product');if(card&&p)card.querySelector('div:nth-child(2)>span').textContent=money(p.sellingPrice);});setBusy(state.busy);
      root.querySelectorAll('.sw-cart-item').forEach(row=>{const id=Number(row.querySelector('[data-product]').dataset.product),p=products.find(p=>p.id===id);if(p)row.querySelector('div>span').textContent=money(p.sellingPrice*(state.cart.get(id)||0));});const invalid=[...state.cart].some(([id,q])=>{const p=products.find(p=>p.id===id);return !p?.canOrder||q>(p.maxOrderQuantity??1000)});const send=root.querySelector('[data-sw=send]');if(send){if(invalid||state.draft||!state.cart.size)send.dataset.locked='true';else delete send.dataset.locked;}const warning=root.querySelector('[data-sw-cart-warning]');if(warning)warning.hidden=!invalid;setBusy(state.busy);const totalEl=root.querySelector('[data-sw-cart] .sw-bill-total strong');if(totalEl)totalEl.textContent=money([...state.cart].reduce((sum,[id,q])=>sum+products.find(p=>p.id===id).sellingPrice*q,0));
    }
  }
  function listOverview() { return `<span class="sw-stat-serving"><b>${state.tables.filter(t=>t.status==='SERVING').length}</b><small>Bàn đang phục vụ</small></span><span class="sw-stat-confirm"><b>${state.tables.reduce((n,t)=>n+t.unconfirmedOrderCount,0)}</b><small>Yêu cầu chờ xác nhận</small></span><span class="sw-stat-ready"><b>${state.tables.reduce((n,t)=>n+(t.readyQuantity||0),0)}</b><small>Món cần mang ra</small></span>`; }
  function readDraft(id) { try { return JSON.parse(localStorage.getItem(draftKey(id))||localStorage.getItem(`dusko-staff-draft:${userId}:${branchId}:${id}`)||'null'); } catch { return null; } }
  function clearDraft(id) { localStorage.removeItem(draftKey(id));localStorage.removeItem(`dusko-staff-draft:${userId}:${branchId}:${id}`); }
  async function selectTable(id) {
    closeVnpay?.();
    const version=++selection;
    const table=state.tables.find(t=>t.id===id); if(!table) return;
    const [result,products]=await Promise.all([request(`/api/staff/tables/${id}/session?branchId=${branchId}`),loadProducts()]);
    if(disposed||version!==selection) return;
    state.products=products;state.table={...table,...result.table};state.session=result.session;state.serviceRequests=result.serviceRequests||[];state.cart.clear();state.notes.clear();state.draft=readDraft(id);
    state.tab=waitingOrders().length?'confirm':readyItems().length?'ready':activeOrders().length?'bill':'menu';render();
  }
  async function mutation(work, message) {
    if(state.busy) return;
    setBusy(true);showMessage('Đang xử lý…');
    try { const result=await work(); if(disposed) return; showMessage(result?.kitchenPending?'Đã nhận yêu cầu nhưng kết nối bếp đang gián đoạn. Báo bếp kiểm tra.':message,Boolean(result?.kitchenPending)); await refresh(true); }
    catch(error) {
      showMessage(error.message, true);
      try {
        await refresh();
        if(error.status===409&&state.table) {
          if(/yêu cầu.*chưa được nhân viên xác nhận/i.test(error.message)) state.tab='confirm';
          else if(/món chưa được mang ra bàn/i.test(error.message)) state.tab='ready';
          render();showMessage(error.message,true);
        }
      } catch { /* Keep the last known view and the original action error. */ }
    }
    finally { if(!disposed) setBusy(false); }
  }
  async function submitDraft(draft) {
    if(draft.sessionId!==state.session?.id) throw Error('Bản nháp thuộc phiên bàn trước. Xóa bản nháp và kiểm tra lại với khách.');
    const result=await post(`/api/staff/tables/${state.table.id}/orders`,draft);
    clearDraft(state.table.id);state.draft=null;state.cart.clear();state.notes.clear();state.tab='ready';render();
    return result;
  }
  async function onClick(event) {
    const target=event.target.closest('[data-sw]'); if(!target||!root.contains(target)||state.busy) return;
    const action=target.dataset.sw;
    try {
      if(action==='table') {setBusy(true);target.textContent='Đang mở bàn…';try{showMessage('');await selectTable(Number(target.dataset.id));}finally{setBusy(false);if(!state.table)render();}return;}
      if(action==='back') { closeVnpay?.();++selection;state.table=null;state.session=null;state.cart.clear();state.notes.clear();render();await refresh();return; }
      if(action==='tab') {state.tab=target.dataset.tab;render();return;}
      if(action==='resolve-call')return mutation(()=>post(`/api/staff/tables/${state.table.id}/service-requests/${target.dataset.id}/resolve`),'Đã ghi nhận hỗ trợ khách.');
      if(action==='refresh') {setBusy(true);target.textContent='Đang cập nhật…';try{await refresh(true);showMessage('Đã cập nhật.');}finally{target.textContent='Làm mới';setBusy(false);}return;}
      if(action==='view-qr') {setBusy(true);try{showQrPreview(await request(`/api/catalog/branches/${branchId}/tables/${state.table.id}/qr`));}finally{setBusy(false);}return;}
      if(action==='open') return mutation(async()=>{await post(`/api/staff/tables/${state.table.id}/open`);state.tab='menu';},'Đã mở bàn. Khách có thể quét QR để gọi món.');
      if(action==='show-reject') {root.querySelector(`[data-reject="${CSS.escape(target.dataset.id)}"]`).hidden=false;return;}
      if(action==='confirm') return mutation(async()=>{return post(`/api/staff/orders/${target.dataset.id}/confirm`);},'Đã nhận yêu cầu. Món được chuyển đúng khu vực phục vụ.');
      if(action==='reject') {const reason=root.querySelector(`[data-reason="${CSS.escape(target.dataset.id)}"]`).value.trim();if(!reason)throw Error('Nhập lý do để khách biết vì sao yêu cầu bị từ chối.');return mutation(()=>post(`/api/staff/orders/${target.dataset.id}/reject`,{reason}),'Đã từ chối yêu cầu và thông báo lý do cho khách.');}
      if(action==='serve') return mutation(()=>post(`/api/staff/tables/${state.table.id}/serve`,{itemIds:[Number(target.dataset.item)]}),'Đã ghi nhận món được mang ra bàn.');
      if(action==='add'||action==='minus') {const id=Number(target.dataset.product);const product=state.products.find(p=>p.id===id);if(state.draft||!product||action==='add'&&(!product.isActive||product.canOrder===false))return;const q=Math.max(0,Math.min(action==='add'?Math.min(1000,product.maxOrderQuantity??1000):1000,(state.cart.get(id)||0)+(action==='add'?1:-1)));if(q)state.cart.set(id,q);else {state.cart.delete(id);state.notes.delete(id);}updateCart();return;}
      if(action==='send') {const items=[...state.cart].filter(([,q])=>q>0).map(([id,quantity])=>({productId:id,quantity,price:state.products.find(p=>p.id===id).sellingPrice,...(state.notes.get(id)?.trim()?{note:state.notes.get(id).trim()}:{} )}));if(!items.length||state.draft)return;const draft={id:crypto.randomUUID(),sessionId:state.session.id,items};localStorage.setItem(draftKey(state.table.id),JSON.stringify(draft));state.draft=draft;return mutation(async()=>{try{return await submitDraft(draft);}catch(error){if(error.status>=400&&error.status<500){clearDraft(state.table.id);state.draft=null;}render();throw error;}},'Đã nhận món. Bếp nhận món cần chế biến tự động.');}
      if(action==='retry') return mutation(()=>submitDraft(state.draft),'Đã nhận lượt gọi món, không tạo trùng.');
      if(action==='discard') {clearDraft(state.table.id);state.draft=null;render();return;}
      if(action==='close') { if(!mayCloseEmpty())throw Error('Bàn còn yêu cầu hoặc món đang phục vụ. Vui lòng xử lý trước khi đóng.'); if(state.draft)throw Error('Còn lượt gọi món chưa rõ đã gửi thành công. Kiểm tra hoặc xóa bản nháp trước khi đóng bàn.'); if(!await confirmDialog({title:'Đóng bàn chưa gọi món?',message:`${state.table.tableName} sẽ trở về trạng thái trống. Món đang chọn trong giỏ sẽ được bỏ.`,confirmLabel:'Đóng bàn'}))return; return mutation(async()=>{await post(`/api/staff/tables/${state.table.id}/close-empty`);clearDraft(state.table.id);state.cart.clear();state.notes.clear();state.table=null;state.session=null;render();},'Đã đóng bàn, không phát sinh thanh toán.'); }
      if(action==='checkout') {const paidSessionId=state.session.id;const method=root.querySelector('[data-sw-input="payment"]').value;if(method==='QR_BANKING')return mutation(async()=>{const payment=await post(`/api/payments/vnpay/tables/${state.table.id}`);closeVnpay?.();closeVnpay=showVnpayPayment(payment,request,async()=>{if(!disposed)await refresh();await openReceipt(request,'session',paidSessionId);});},'Đang chờ khách thanh toán qua VNPay.');if(!await confirmDialog({title:'Xác nhận thanh toán',message:`Đã nhận đủ ${money(total())} ${method==='CASH'?'bằng tiền mặt':'qua máy POS'}?`,confirmLabel:'Đã nhận đủ tiền'}))return;return mutation(async()=>{await post(`/api/staff/tables/${state.table.id}/checkout`,{paymentMethod:method});state.table=null;state.session=null;render();await openReceipt(request,'session',paidSessionId);},'Thanh toán thành công. Bàn đã trở về trạng thái trống.');}
    } catch(error) {showMessage(error.message,true);}
  }
  function onInput(event) {
    const type=event.target.dataset.swInput;
    if(type==='table-search') {state.search=event.target.value;root.querySelector('.sw-tables').innerHTML=tableCards();}
    if(type==='table-filter') {state.filter=event.target.value;root.querySelector('.sw-tables').innerHTML=tableCards();}
    if(type==='note') state.notes.set(Number(event.target.dataset.product),event.target.value);
    if(type==='menu-search'||type==='category') {if(type==='menu-search')state.menuSearch=event.target.value;else state.category=event.target.value;root.querySelectorAll('.sw-product').forEach(el=>el.hidden=!el.dataset.name.includes(state.menuSearch.toLowerCase())||(state.category!=='ALL'&&el.dataset.category!==state.category));}
  }
  root.addEventListener('click',onClick);root.addEventListener('input',onInput);root.addEventListener('change',onInput);
  root.innerHTML='<p class="sw-empty">Đang tải bàn phục vụ…</p>';
  /**
   * React to a scoped real-time event.
   *
   * A guest pressing "call staff" or sending an order reaches the waiter as a
   * toast right away, instead of waiting for the next poll.
   */
  async function handleLiveEvent(message) {
    if (disposed) return;
    if (state.busy || polling) return;
    const tableName = message.tableName || state.tables.find(t => t.id === message.tableId)?.tableName || 'Bàn';
    if (message.action === 'service.request') {
      toast.warning(message.kind === 'BILL' ? `${tableName}: khách yêu cầu thanh toán` : `${tableName}: khách cần nhân viên hỗ trợ`, 'Vào bàn để xử lý yêu cầu.');
      polling = true;
      try { await refresh(); } catch { /* keep the last view until the next poll */ } finally { polling = false; }
      return;
    }
    if (message.action === 'order.created') {
      toast.info(`${tableName}: khách vừa gửi yêu cầu gọi món`, 'Kiểm tra và xác nhận để chuyển món xuống bếp.');
      polling = true;
      try { await refresh(); } catch { /* keep the last view until the next poll */ } finally { polling = false; }
      return;
    }
    if (message.action === 'table.session.opened') {
      toast.info(`${tableName}: vừa mở bàn phục vụ`, 'Khách có thể quét QR để gọi món.');
      polling = true;
      try { await refresh(); } catch { /* keep the last view until the next poll */ } finally { polling = false; }
      return;
    }
    if (message.action === 'table.session.closed') {
      toast.info(`${tableName}: vừa đóng bàn`, 'Phiên phục vụ đã kết thúc.');
      polling = true;
      try { await refresh(); } catch { /* keep the last view until the next poll */ } finally { polling = false; }
      return;
    }
    if (message.action === 'inventory.changed') {
      productsAt = 0;
      polling = true;
      try { await refresh(); } catch { /* keep the last view until the next poll */ } finally { polling = false; }
      return;
    }
    if (message.action === 'order.confirmed' || message.action === 'order.rejected' || message.action === 'order.served' || message.action === 'service.resolved') {
      polling = true;
      try { await refresh(); } catch { /* keep the last view until the next poll */ } finally { polling = false; }
    }
  }
  (initialData?Promise.resolve([state.tables,state.products]):Promise.all([request(`/api/catalog/branches/${branchId}/tables`),loadProducts()])).then(([tables,products])=>{if(disposed)return;state.tables=tables;state.products=products;render();}).catch(error=>{if(disposed)return;root.innerHTML='<p data-sw-message role="status" class="sw-message sw-error"></p>'+button('Thử lại','refresh');showMessage(error.message,true);});
  const stopLive=watchChanges(request,async()=>{if(disposed)return;if(state.busy||polling)throw Error('retry');polling=true;try{productsAt=0;await refresh();}finally{polling=false;}}, '/api/live', {onEvent:handleLiveEvent,onStatus:live=>{liveConnected=live;}});
  // The socket pushes every change, so the list is only polled while the
  // connection is down.
  const interval=setInterval(async()=>{if(disposed||liveConnected||state.busy||polling||document.hidden)return;polling=true;try{await refresh();}catch(error){showMessage(`Không cập nhật được: ${error.message}`,true);}finally{polling=false;}},12000);
  return {destroy(){disposed=true;closeVnpay?.();stopLive();clearInterval(interval);root.removeEventListener('click',onClick);root.removeEventListener('input',onInput);root.removeEventListener('change',onInput);}};
}
