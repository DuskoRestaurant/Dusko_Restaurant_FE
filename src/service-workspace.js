import {openReceipt} from './receipt.js';
import { showVnpayPayment } from './vnpay-payment.js';
import { watchChanges } from './live-updates.js';
import { sharedToast } from './toast.js';
import './service-workspace.css';
import { showQrPreview } from './qr-preview.js';
import { confirmDialog } from './confirm-dialog.js';
import { serviceMenuPage } from './service-menu.js';
import { filterServiceTables, serviceTableFilters } from './service-tables.js';

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
  const state = {tables:[], products:[], table:null, session:null, tab:'confirm', paymentMethod:'CASH', promotionCode:'', promotions:[], promotionError:'', filter:role==='CASHIER'?'PAY':'ALL', search:'', menuSearch:'', menuPage:1, category:'ALL', cart:new Map(), notes:new Map(), busy:false, message:'', bad:false, draft:null,serviceRequests:[]};
  let disposed = false;
  let closeVnpay, customerDialog;
  let lastUpdated=null,syncError=false;
  let selection = 0;
  let polling = false;
  let liveConnected = false;
  let panelSnapshot = '';
  let menuSnapshot = '';
  let productsAt=initialData?.products?Date.now():0, productsPending;
  if(initialData){state.tables=initialData.tables||[];state.products=initialData.products||[];}
  function loadProducts(force=false){
    if(productsPending)return productsPending;
    if(!force&&productsAt&&Date.now()-productsAt<12000)return Promise.resolve(state.products);
    productsPending=request('/api/catalog/products').then(products=>{productsAt=Date.now();return products;}).finally(()=>productsPending=null);
    return productsPending;
  }

  const cashierView=role==='CASHIER';
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
    const tables = filterServiceTables(state.tables,{search:state.search,filter:state.filter,prioritizePayment:cashierView});
    return tables.map(table => `<button type="button" class="sw-table ${table.serviceRequestCount||table.unconfirmedOrderCount||table.readyQuantity?'sw-attention':''}" data-state="${table.status}" data-priority="${table.serviceRequestCount?'call':table.unconfirmedOrderCount?'confirm':table.readyQuantity?'ready':'idle'}" data-sw="table" data-id="${table.id}"><span class="sw-table-state">${table.status==='EMPTY'?'Trống':table.status==='RESERVED'?'Đã đặt trước':'Đang phục vụ'}</span><strong>${e(table.tableName)}</strong><small>${table.seatingCapacity} chỗ</small><div>${table.billRequested?'<b class="sw-table-call">Khách yêu cầu thanh toán</b>':table.checkoutReady?'<b class="sw-table-ready">Sẵn sàng thanh toán</b>':''}${table.serviceRequestCount?`<b class="sw-table-call">${table.serviceRequestCount} yêu cầu hỗ trợ</b>`:''}${table.unconfirmedOrderCount?`<b class="sw-table-confirm">${table.unconfirmedOrderCount} cần xác nhận</b>`:''}${table.readyQuantity?`<b class="sw-table-ready">${table.readyQuantity} món sẵn sàng</b>`:''}${!table.serviceRequestCount&&!table.unconfirmedOrderCount&&!table.readyQuantity?(table.pendingOrderCount?'<span>Đang phục vụ món</span>':'<span>Chọn để xem bàn</span>'):''}</div></button>`).join('') || empty('Không có bàn phù hợp');
  }
  function render() {
    if(disposed) return;
    panelSnapshot = '';
    root.innerHTML = `<p class="sw-sync" data-sw-sync role="status"></p><p class="sw-message ${state.bad?'sw-error':''}" data-sw-message role="status" ${state.message?'':'hidden'}>${e(state.message)}</p>${state.table?tableView():listView()}`;
    updateCart();
    updateSync();
    setBusy(state.busy);
  }
  function listView() {
    return `<div class="sw-heading sw-list-heading"><div><h2>Danh sách bàn</h2><p>Bàn cần xử lý được xếp trước. Chọn trạng thái để lọc nhanh.</p></div><div class="sw-heading-actions">${button('Làm mới','refresh')}</div></div><div class="sw-overview" role="group" aria-label="Lọc trạng thái bàn">${listOverview()}</div><div class="sw-filters sw-table-filters"><input data-sw-input="table-search" type="search" placeholder="Tìm tên bàn…" aria-label="Tìm bàn" value="${e(state.search)}"></div><div class="sw-tables">${tableCards()}</div><details class="sw-guide"><summary>Hướng dẫn phục vụ</summary><p>Mở bàn → xác nhận yêu cầu QR hoặc gọi món giúp khách → mang món đã hoàn thành ra bàn → thanh toán.</p></details>`;
  }
  const mayCloseEmpty = () => Boolean(state.session) && !(state.session.orders||[]).some(order=>['AWAITING_CONFIRMATION','PENDING'].includes(order.status));
  function tableView() {
    const table = state.table;
    return `<div class="sw-heading sw-table-heading"><div>${button('← Danh sách bàn','back')}<h2>${e(table.tableName)}</h2><p>${state.session?'Đang phục vụ · các lần gọi món dùng chung một hóa đơn':table.status==='RESERVED'?'Bàn đang được đặt trước. Quản lý cần cập nhật tình trạng bàn.':'Bàn chưa mở phục vụ'}</p></div><div class="sw-actions">${button('Xem QR','view-qr')}<span data-sw-empty-close>${mayCloseEmpty()?button('Đóng bàn chưa gọi món','close'):''}</span>${button('Làm mới','refresh')}</div></div>${state.session?`<div data-sw-customer>${customerSummary()}</div><div data-sw-calls>${serviceCalls()}</div><div class="sw-table-summary" data-sw-summary>${summary()}</div><div class="sw-tabs" role="tablist" aria-label="Công việc tại bàn">${tabs()}</div><div class="sw-content" data-sw-panel id="sw-panel" role="tabpanel" tabindex="0" aria-labelledby="sw-tab-${state.tab}">${panel()}</div>`:`<div class="sw-empty"><h3>${table.pendingOrderCount?'Bàn còn đơn cũ chưa thanh toán':'Khách đã đến bàn?'}</h3><p>${table.pendingOrderCount?'Thu ngân cần xử lý đơn cũ trong mục Mang đi và đơn cũ trước khi mở bàn.':'Mở bàn để khách sử dụng QR cố định hoặc để nhân viên gọi món.'}</p>${button('Mở bàn phục vụ','open',table.status==='RESERVED'||table.pendingOrderCount?'data-locked="true"':'',true)}</div>`}`;
  }
  function updateSync(){const label=root.querySelector('[data-sw-sync]');if(label)label.textContent=`${syncError?'Chưa cập nhật được dữ liệu':liveConnected?'Đang kết nối trực tiếp':'Đang dùng cập nhật dự phòng'}${lastUpdated?` · Lần cuối ${lastUpdated.toLocaleTimeString('vi-VN')}`:''}`;}
  function customerSummary(){
    const customer=state.session?.verifiedCustomer;
    return `<div class="sw-customer"><div><strong>${customer?`Khách: ${e(customer.fullName)}`:'Khách vãng lai'}</strong><p>${customer?e(customer.phone):'Gắn khách hàng sau khi đối chiếu số điện thoại để nhận ưu đãi.'}</p></div>${customer?button('Bỏ gắn khách','clear-customer'):button('Gắn khách hàng','verify-customer')}</div>`;
  }
  function verifyCustomer(){
    const {id:tableId,tableName}=state.table,sessionId=state.session?.id;
    if(!sessionId)return;
    customerDialog?.close();
    const dialog=document.createElement('dialog');customerDialog=dialog;dialog.className='sw-customer-dialog';dialog.setAttribute('aria-label',`Gắn khách hàng · ${tableName}`);
    dialog.innerHTML=`<form><h2>Gắn khách hàng · ${e(tableName)}</h2><p>Khách chỉ được gắn với lượt phục vụ hiện tại.</p><label>Số điện thoại<input name="phone" type="tel" inputmode="tel" autocomplete="tel" required maxlength="20" placeholder="09xx xxx xxx"></label><label class="sw-customer-check"><input type="checkbox" required> Đã đối chiếu số điện thoại trực tiếp với khách tại bàn</label><p role="status" data-error></p><div><button type="submit">Xác nhận gắn khách</button><button type="button" data-close>Đóng</button></div></form>`;
    dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{dialog.remove();if(customerDialog===dialog)customerDialog=null;},{once:true});
    dialog.querySelector('form').onsubmit=async event=>{
      event.preventDefault();const submit=dialog.querySelector('[type=submit]');if(submit.disabled)return;submit.disabled=true;
      const error=dialog.querySelector('[data-error]');error.textContent='Đang xác nhận…';
      try{await post(`/api/staff/tables/${tableId}/customer/verify-by-phone`,{sessionId,phone:dialog.querySelector('[name=phone]').value.trim()});if(disposed)return;dialog.close();if(state.table?.id===tableId){await refresh();showMessage('Đã gắn khách hàng vào phiên bàn.');}}
      catch(err){error.textContent=err.message;}finally{submit.disabled=false;}
    };
    document.body.append(dialog);dialog.showModal();
  }
  function serviceCalls(){return (state.serviceRequests||[]).map(call=>`<div class="sw-service-call"><div><strong>${call.kind==='BILL'?'Khách yêu cầu thanh toán':'Khách cần nhân viên hỗ trợ'}</strong><small>Gửi lúc ${time(call.createdAt)}</small></div>${button('Đã hỗ trợ','resolve-call',`data-id="${call.id}"`)}</div>`).join('');}
  function summary() { return `<span><b>${waitingOrders().length}</b> chờ xác nhận</span><span><b>${quantities(readyItems())}</b> món sẵn sàng</span><span><b>${money(total())}</b> tiền món</span>`; }
  function tabs() { return [['confirm','Chờ xác nhận',waitingOrders().length],['ready','Món sẵn sàng',quantities(readyItems())],['menu','Gọi thêm',null],['bill','Hóa đơn',null]].map(([id,label,count])=>`<button type="button" role="tab" id="sw-tab-${id}" aria-controls="sw-panel" aria-selected="${state.tab===id}" tabindex="${state.tab===id?'0':'-1'}" class="${state.tab===id?'sw-active':''}" data-sw="tab" data-tab="${id}">${label}${count?` <span>${count}</span>`:''}</button>`).join(''); }
  function draftView() { return state.draft?`<aside class="sw-draft"><strong>Có lượt gọi món chưa gửi thành công</strong><p>${state.draft.items.map(item=>`${e(state.products.find(p=>p.id===item.productId)?.name||'Món')} × ${item.quantity}`).join(' · ')}. Máy chủ có thể chưa nhận; thử lại dùng cùng mã để tránh tạo trùng.</p>${state.draft.sessionId===state.session.id?button('Thử gửi lại','retry'): '<p>Bản nháp thuộc phiên bàn trước, không được gửi cho khách mới.</p>'}${button('Xóa bản nháp','discard')}</aside>`:''; }
  function menuResults() {
    const result = serviceMenuPage(state.products, {search:state.menuSearch, category:state.category, page:state.menuPage});
    state.menuPage = result.page;
    return result;
  }
  function menuProducts(result) {
    return result.items.map(p=>`<button type="button" class="sw-product ${state.cart.has(p.id)?'sw-product-selected':''}" data-sw="add" data-product="${p.id}" aria-label="Thêm ${e(p.name)}" title="${e(p.name)}" ${p.canOrder===false||state.draft?'data-locked="true"':''}><span class="sw-photo">${productImageUrl(p)?`<img src="${e(productImageUrl(p))}" alt="" loading="lazy">`:'<span>Chưa có ảnh</span>'}</span><span class="sw-product-info"><strong>${e(p.name)}</strong><span data-sw-price>${money(p.sellingPrice)}</span><small data-sw-stock="${p.id}">${p.canOrder===false?e(p.availabilityReason||'Tạm chưa thể đặt'):p.requiresPreparation?'Bếp chế biến':'Phục vụ trực tiếp'}</small></span><span class="sw-add-mark" aria-hidden="true">+</span><span class="sw-menu-quantity" data-sw-menu-quantity aria-hidden="true" ${state.cart.has(p.id)?'':'hidden'}>${state.cart.get(p.id)||0}</span></button>`).join('') || empty('Không có món phù hợp', 'Thử tên khác hoặc chọn tất cả nhóm.');
  }
  function menuPagination(result) {
    return `<p class="sw-menu-count" role="status">${result.start}–${result.end} / ${result.total} món · Trang ${result.page}/${result.pages}</p><div class="sw-actions">${button('← Trước','menu-prev',result.page===1?'data-locked="true"':'')}${button('Sau →','menu-next',result.page===result.pages?'data-locked="true"':'')}</div>`;
  }
  function updateMenuResults(resetScroll = true) {
    const holder = root.querySelector('[data-sw-products]');
    if (!holder) return;
    const result = menuResults();
    const snapshot = JSON.stringify([result,state.draft]);
    if (!resetScroll && snapshot === menuSnapshot) return;
    menuSnapshot = snapshot;
    const scrollTop = resetScroll ? 0 : holder.scrollTop;
    holder.innerHTML = menuProducts(result);
    holder.scrollTop = scrollTop;
    root.querySelector('[data-sw-pagination]').innerHTML = menuPagination(result);
    setBusy(state.busy);
  }
  function updateCartAccess() {
    const count = root.querySelector('[data-sw-cart-count]');
    if (!count) return;
    count.textContent = `Giỏ món · ${[...state.cart.values()].reduce((sum,q)=>sum+q,0)} món`;
    root.querySelector('[data-sw-cart-total]').textContent = money([...state.cart].reduce((sum,[id,q])=>sum+(state.products.find(p=>p.id===id)?.sellingPrice||0)*q,0));
  }
  function updateProductSelection() {
    root.querySelectorAll('.sw-product[data-product]').forEach(card=>{
      const quantity=state.cart.get(Number(card.dataset.product))||0;
      card.classList.toggle('sw-product-selected',quantity>0);
      const badge=card.querySelector('[data-sw-menu-quantity]');
      badge.textContent=String(quantity);badge.hidden=!quantity;
    });
  }
  function panel() {
    if(state.tab==='confirm') return `<h3>Kiểm tra yêu cầu với khách tại bàn</h3><p class="sw-help sw-operational-help">Đọc lại món và ghi chú với khách trước khi nhận. Món cần chế biến sẽ được chuyển vào bếp.</p>${waitingOrders().map(order=>`<article class="sw-order"><div class="sw-order-head"><strong>Khách gửi lúc ${time(order.createdAt)}</strong><small>Lượt ${e(shortCode(order))}</small></div><ul>${order.items.map(item=>`<li><div class="sw-line-item">${foodPhoto(item.product)}<div><b>${e(item.product.name)} × ${item.quantity}</b>${item.note?`<p class="sw-note">${e(item.note)}</p>`:''}</div></div><span>${money(item.price*item.quantity)}</span></li>`).join('')}</ul><div class="sw-actions sw-confirm-actions">${button('Nhận yêu cầu','confirm',`data-id="${e(order.id)}"`,true)}${button('Từ chối','show-reject',`data-id="${e(order.id)}"`)}</div><div class="sw-reject" data-reject="${e(order.id)}" hidden><label>Lý do từ chối<input maxlength="500" placeholder="Ví dụ: khách gửi nhầm món" data-reason="${e(order.id)}"></label>${button('Xác nhận từ chối','reject',`data-id="${e(order.id)}"`)}</div></article>`).join('')||empty('Không có yêu cầu chờ xác nhận','Nhân viên gọi món trực tiếp ở mục Gọi thêm. Yêu cầu mới từ QR sẽ xuất hiện ở đây.')}`;
    if(state.tab==='ready') {
      const ready = readyItems();
      const cooking = activeOrders().flatMap(o=>o.items).filter(i=>i.kdsStatus!=='DONE');
      return `<h3>Mang món đến ${e(state.table.tableName)}</h3><p class="sw-help sw-operational-help">Kiểm tra đúng món và số lượng. Chỉ đánh dấu sau khi món đã tới bàn.</p>${ready.map(item=>`<article class="sw-ready"><div class="sw-line-item">${foodPhoto(item.product)}<div><div class="sw-ready-name"><strong>${e(item.product.name)}</strong><b class="sw-quantity" aria-label="Số lượng ${item.quantity}">× ${item.quantity}</b></div><small>${item.product.requiresPreparation?'Bếp đã làm xong':'Phục vụ trực tiếp'} · lượt ${e(shortCode(item.order))}</small>${item.note?`<p class="sw-note">${e(item.note)}</p>`:''}</div></div>${button('Đã mang ra','serve',`data-item="${item.id}"`,true)}</article>`).join('')||empty('Chưa có món cần mang ra')}${cooking.length?`<section class="sw-progress" aria-label="Trạng thái bếp"><h4><span aria-hidden="true">🍳</span> Bếp đang xử lý</h4>${cooking.map(item=>`<p><span class="sw-cooking-item"><b>${e(item.product.name)}</b><strong class="sw-quantity">× ${item.quantity}</strong></span><span class="sw-cooking-state"><span aria-hidden="true">${item.kdsStatus==='COOKING'?'🍳':'⏱'}</span> ${statusText(item)}</span></p>`).join('')}</section>`:''}`;
    }
    if(state.tab==='menu') {
      const result = menuResults();
      menuSnapshot = JSON.stringify([result,state.draft]);
      return `${draftView()}<h3 id="sw-menu" tabindex="-1">Chọn món cho bàn</h3><p class="sw-help">Tìm theo tên hoặc lọc nhóm món. Món đã chọn được giữ khi đổi trang.</p><div class="sw-filters"><input data-sw-input="menu-search" type="search" placeholder="Tìm món" aria-label="Tìm món" value="${e(state.menuSearch)}"><select data-sw-input="category" aria-label="Nhóm món"><option value="ALL">Tất cả nhóm</option>${[...new Set(state.products.filter(p=>p.isActive).map(p=>p.category?.name).filter(Boolean))].map(name=>`<option ${state.category===name?'selected':''}>${e(name)}</option>`).join('')}</select></div><div class="sw-menu-layout"><div class="sw-menu-results"><div class="sw-products" data-sw-products role="region" aria-label="Các món trong thực đơn" tabindex="0">${menuProducts(result)}</div><nav class="sw-menu-pagination" data-sw-pagination aria-label="Phân trang thực đơn">${menuPagination(result)}</nav></div><section class="sw-cart" id="sw-cart" tabindex="-1" data-sw-cart></section></div><a class="sw-cart-access" href="#sw-cart"><span data-sw-cart-count>Giỏ món · 0 món</span><strong data-sw-cart-total>0 ₫</strong><span>Xem giỏ →</span></a>`;
    }
    return billPanel();
  }
  function billPanel() {
    const orders = activeOrders();
    const waiting = waitingOrders().length;
    const remaining = unsettledItems();
    const cancelled = (state.session.orders||[]).filter(order=>order.status==='CANCELLED');
    const action = waiting || remaining.length
      ? `<div class="sw-checkout-block" id="sw-checkout-reason" role="note"><strong>Chưa thể thanh toán</strong><p>${waiting?`Cần xác nhận hoặc từ chối ${waiting} yêu cầu của khách trước.`:`Cần mang đủ ${quantities(remaining)} món còn lại ra bàn trước.`}</p>${waiting&&remaining.length?`<p>Sau đó kiểm tra ${quantities(remaining)} món chưa mang ra.</p>`:''}</div>${button(waiting?'Xử lý yêu cầu':'Xem món đang phục vụ','tab',`data-tab="${waiting?'confirm':'ready'}"`,true)}${mayPay?button('Thanh toán','checkout','data-locked="true" aria-describedby="sw-checkout-reason"'):''}`
        : orders.length
          ? mayPay
            ? `<div class="sw-payment"><label>Phương thức thanh toán<select data-sw-input="payment">${[["CASH","Tiền mặt"],["QR_BANKING","VNPay"],["POS_CARD","Thẻ"]].map(([value,label])=>`<option value="${value}" ${state.paymentMethod===value?"selected":""}>${label}</option>`).join('')}</select></label><p class="sw-help">Với tiền mặt hoặc thẻ, xác nhận sau khi đã nhận đủ tiền. VNPay đang dùng môi trường thử nghiệm.</p>${button('Thanh toán','checkout','',true)}</div>`
            : '<p class="sw-alert">Bàn đã phục vụ đủ món. Báo thu ngân để nhận tiền và đóng bàn.</p>'
          : button('Đóng bàn chưa gọi món','close');
    const orderCards = orders.map(order=>`<details class="sw-order sw-bill-order" data-sw-order="${e(order.id)}"><summary><strong>Lượt ${time(order.createdAt)}</strong> <span>${quantities(order.items)} món · ${money(order.finalAmount)}</span></summary><p class="sw-help">${order.source==='CUSTOMER_QR'?'Khách gửi QR':'Nhân viên gọi món'} · lượt ${e(shortCode(order))}</p><ul>${order.items.map(item=>`<li><div><b>${e(item.product.name)} × ${item.quantity}</b><small>${statusText(item)}</small>${item.note?`<p class="sw-note">${e(item.note)}</p>`:''}</div><span>${money(item.price*item.quantity)}</span></li>`).join('')}</ul>${order.discountAmount?`<p class="sw-help">Tổng ưu đãi: −${money(order.discountAmount)}</p>`:''}<p><strong>Thành tiền: ${money(order.finalAmount)}</strong></p></details>`).join('');
    return `<h3>Hóa đơn chung của bàn</h3><p class="sw-help">Tổng tiền chỉ gồm các lượt đã nhận. Mở từng lượt để xem món và đối chiếu.</p><div class="sw-bill-layout"><aside class="sw-checkout" aria-label="Thanh toán của bàn"><div class="sw-bill-total"><span>Tổng thanh toán</span><strong>${money(total())}</strong></div><p class="sw-help">${orders.length} lượt đã nhận · ${quantities(orders.flatMap(order=>order.items))} món</p>${mayPay&&orders.length?promotionPanel():''}${action}</aside><section class="sw-bill-orders" aria-label="Các lượt gọi món đã nhận" tabindex="0">${orderCards||empty('Chưa có món đã nhận')}${cancelled.length?`<details class="sw-history"><summary>Các yêu cầu đã từ chối (${cancelled.length})</summary>${cancelled.map(order=>`<p>Lượt ${time(order.createdAt)}: ${e(order.note||'Đã từ chối')}</p>`).join('')}</details>`:''}</section></div>`;
  }
  function updateCart() {
    const holder = root.querySelector('[data-sw-cart]'); if(!holder) return;
    const focused = holder.contains(document.activeElement) ? document.activeElement : null;
    const focusKey = focused ? {product:focused.dataset.product,action:focused.dataset.sw,input:focused.dataset.swInput} : null;
    const entries = [...state.cart].filter(([,q])=>q>0);
    const unavailable=entries.some(([id,q])=>{const p=state.products.find(p=>p.id===id);return !p?.canOrder||q>(p.maxOrderQuantity??1000);});
    const scrollTop = holder.querySelector('.sw-cart-lines')?.scrollTop || 0;
    holder.innerHTML = `<h3>Giỏ món của ${e(state.table.tableName)}</h3><a class="sw-menu-return" href="#sw-menu">← Tiếp tục chọn món</a><div class="sw-cart-lines" role="region" aria-label="Các món đã chọn" tabindex="0">${entries.map(([id,q])=>{const p=state.products.find(p=>p.id===id); return `<div class="sw-cart-item"><div><strong>${e(p.name)}</strong><span>${money(p.sellingPrice*q)}</span></div><div class="sw-stepper">${button('−','minus',`data-product="${id}" aria-label="Giảm ${e(p.name)}"`)}<b>${q}</b>${button('+','add',`data-product="${id}" aria-label="Tăng ${e(p.name)}"`)}</div><input data-sw-input="note" data-product="${id}" maxlength="500" aria-label="Ghi chú cho ${e(p.name)}" placeholder="Ghi chú: ít cay, không hành…" value="${e(state.notes.get(id)||'')}"></div>`;}).join('')||'<p>Chọn món ở thực đơn.</p>'}</div><div class="sw-cart-footer"><div class="sw-bill-total"><span>Tạm tính</span><strong>${money(entries.reduce((n,[id,q])=>n+state.products.find(p=>p.id===id).sellingPrice*q,0))}</strong></div><p data-sw-cart-warning ${unavailable?'':'hidden'}>Giỏ có món thiếu nguyên liệu hoặc vượt số suất còn lại. Giảm số lượng hoặc bỏ món trước khi gửi.</p>${button(`Gửi ${entries.reduce((n,[,q])=>n+q,0)} món`,'send',entries.length&&!state.draft&&!unavailable?'':'data-locked="true"',true)}</div>`;
    holder.querySelector('.sw-cart-lines').scrollTop = scrollTop;
    updateCartAccess();
    updateProductSelection();
    setBusy(state.busy);
    if (focusKey) {
      const next = [...holder.querySelectorAll('button,input')].find(el=>el.dataset.product===focusKey.product && el.dataset.sw===focusKey.action && el.dataset.swInput===focusKey.input);
      (next||holder).focus({preventScroll:true});
    }
  }
  async function loadEligible(result,id){
    result.promotions=[];result.promotionError='';
    if(!mayPay||!result.session)return;
    try{result.promotions=await request(`/api/staff/tables/${id}/promotions?branchId=${branchId}&sessionId=${encodeURIComponent(result.session.id)}`);}
    catch(error){result.promotionError=error.message;}
  }
  function acceptEligible(result){state.promotions=Array.isArray(result.promotions)?result.promotions:[];state.promotionError=result.promotionError||'';if(!state.promotions.some(p=>p.code===state.promotionCode))state.promotionCode='';}
  function promotionPanel(){
    const selected=state.session?.checkoutPromotion;
    const discount=activeOrders().reduce((sum,o)=>sum+(o.discountAmount||0),0);
    const gross=activeOrders().reduce((sum,o)=>sum+o.totalAmount,0);
    return `<section class="sw-promotion" aria-label="Mã khuyến mãi"><div class="sw-promotion-totals"><span>Tiền món</span><strong>${money(gross)}</strong><span>Tổng ưu đãi</span><strong>−${money(discount)}</strong></div><label for="sw-promotion-code">Khuyến mãi có thể áp dụng</label><div class="sw-promotion-entry"><select id="sw-promotion-code" data-sw-input="promotion" ${state.promotions.length?'':'disabled'}><option value="">Chọn ưu đãi</option>${state.promotions.map(p=>`<option value="${e(p.code)}" ${state.promotionCode===p.code?'selected':''}>${e(p.name)} · Giảm ${money(p.discountAmount)} (${e(p.code)})</option>`).join('')}</select>${button('Áp dụng','apply-promotion',state.promotions.length?'':'data-locked="true"')}</div>${state.promotionError?`<p class="sw-help" role="status">${e(state.promotionError)}</p>`:!state.promotions.length?'<p class="sw-help">Chưa có mã đủ điều kiện cho hóa đơn và khách hiện tại.</p>':'<p class="sw-help">Chỉ hiển thị mã đủ điều kiện. Tiền giảm đã tính theo hóa đơn hiện tại.</p>'}${selected?`<p class="sw-promotion-applied">Đã áp <strong>${e(selected.code)}</strong>: −${money(selected.amount)}</p>${button('Bỏ mã','remove-promotion')}<p class="sw-help">Nếu gọi thêm món, áp lại mã để tính trên hóa đơn mới.</p>`:'<p class="sw-help">Mã thành viên cần gắn khách trước khi áp dụng.</p>'}</section>`;
  }
  function patchTable() {
    if(!state.session || !root.querySelector('[data-sw-panel]')) { render(); return; }
    root.querySelector('[data-sw-summary]').innerHTML = summary();root.querySelector('[data-sw-customer]').innerHTML=customerSummary();root.querySelector('[data-sw-calls]').innerHTML=serviceCalls();
    const closeAction = root.querySelector('[data-sw-empty-close]');
    if(closeAction) closeAction.innerHTML = mayCloseEmpty() ? button('Đóng bàn chưa gọi món','close') : '';
    const tabList = root.querySelector('.sw-tabs');
    const tabFocused = tabList.contains(document.activeElement);
    tabList.innerHTML = tabs();
    if (tabFocused) tabList.querySelector('[aria-selected="true"]').focus({preventScroll:true});
    const snapshot = JSON.stringify([state.session.orders,state.tab,state.draft,state.promotions,state.promotionError,state.session.checkoutPromotion]);
    const holder = root.querySelector('[data-sw-panel]');
    holder.setAttribute('aria-labelledby',`sw-tab-${state.tab}`);
    if(state.tab!=='menu' && panelSnapshot!==snapshot && !(holder.contains(document.activeElement) && document.activeElement.matches('input,textarea,select'))) {
      const opened = new Set([...holder.querySelectorAll('.sw-bill-order[open]')].map(el=>el.dataset.swOrder));
      const billScroll = holder.querySelector('.sw-bill-orders')?.scrollTop || 0;
      holder.innerHTML = panel(); panelSnapshot = snapshot;
      holder.querySelectorAll('.sw-bill-order').forEach(el=>{el.open=opened.has(el.dataset.swOrder);});
      const billOrders=holder.querySelector('.sw-bill-orders');
      if(billOrders) billOrders.scrollTop=billScroll;
    }
    setBusy(state.busy);
  }
  async function refresh(force=false){
    try{await refreshData(force);lastUpdated=new Date();syncError=false;}
    catch(error){syncError=true;throw error;}
    finally{if(!disposed)updateSync();}
  }
  async function refreshData(force=false) {
    if(disposed) return;
    if(!state.table) {
      const [tables,products] = await Promise.all([request(`/api/catalog/branches/${branchId}/tables`),loadProducts(force)]);
      if(disposed||state.table) return;
      state.tables=tables;state.products=products;
      const cards=root.querySelector('.sw-tables');
      if(cards) {
        const filters=root.querySelector('.sw-overview');
        const filterFocused=filters.contains(document.activeElement);
        cards.innerHTML=tableCards();filters.innerHTML=listOverview();setBusy(state.busy);
        if(filterFocused) filters.querySelector(`[data-filter="${state.filter}"]`).focus({preventScroll:true});
      } else render();
      return;
    }
    const id=state.table.id, version=selection;
    const [result, products] = await Promise.all([request(`/api/staff/tables/${id}/session?branchId=${branchId}`),loadProducts(force)]);
    await loadEligible(result,id);
    if(disposed||version!==selection||state.table?.id!==id) return;
    acceptEligible(result);
    const removed=state.products.filter(p=>state.cart.has(p.id)&&!products.some(n=>n.id===p.id));products.push(...removed.map(p=>({...p,isActive:false,canOrder:false,availabilityReason:'Đã ngừng bán'})));
    const pricesChanged=products.some(p=>state.cart.has(p.id)&&state.products.some(old=>old.id===p.id&&old.sellingPrice!==p.sellingPrice));
    state.products=products;
    if(pricesChanged)showMessage('Giá món trong giỏ vừa thay đổi. Kiểm tra lại trước khi gửi.',true);
    const sessionChanged=state.session?.id!==result.session?.id;
    state.table={...state.table,...result.table}; state.session=result.session;state.serviceRequests=result.serviceRequests||[];
    if(sessionChanged) { state.paymentMethod='CASH';state.promotionCode=''; if(result.table.status==='EMPTY')state.table.pendingOrderCount=0; state.cart.clear();state.notes.clear();state.draft=readDraft(id);render(); } else {patchTable();
      updateMenuResults(false);
      updateCartAccess();
      root.querySelectorAll('[data-sw-stock]').forEach(el=>{const p=products.find(p=>p.id===Number(el.dataset.swStock));el.textContent=p?.canOrder?(p.requiresPreparation?'Bếp chế biến':'Phục vụ trực tiếp'):(p?.availabilityReason||'Đã ngừng bán');});
      root.querySelectorAll('[data-sw="add"]').forEach(el=>{const p=products.find(p=>p.id===Number(el.dataset.product));if(!p?.canOrder||state.draft)el.dataset.locked='true';else delete el.dataset.locked;const card=el.closest('.sw-product');if(card&&p)card.querySelector('[data-sw-price]').textContent=money(p.sellingPrice);});setBusy(state.busy);
      root.querySelectorAll('.sw-cart-item').forEach(row=>{const id=Number(row.querySelector('[data-product]').dataset.product),p=products.find(p=>p.id===id);if(p)row.querySelector('div>span').textContent=money(p.sellingPrice*(state.cart.get(id)||0));});const invalid=[...state.cart].some(([id,q])=>{const p=products.find(p=>p.id===id);return !p?.canOrder||q>(p.maxOrderQuantity??1000)});const send=root.querySelector('[data-sw=send]');if(send){if(invalid||state.draft||!state.cart.size)send.dataset.locked='true';else delete send.dataset.locked;}const warning=root.querySelector('[data-sw-cart-warning]');if(warning)warning.hidden=!invalid;setBusy(state.busy);const totalEl=root.querySelector('[data-sw-cart] .sw-bill-total strong');if(totalEl)totalEl.textContent=money([...state.cart].reduce((sum,[id,q])=>sum+products.find(p=>p.id===id).sellingPrice*q,0));
    }
  }
  function listOverview() { return serviceTableFilters(state.tables).filter(filter=>filter.id!=='PAY'||mayPay).map(filter=>`<button type="button" class="sw-filter" data-sw="table-filter" data-filter="${filter.id}" aria-pressed="${state.filter===filter.id}">${filter.label} <b>${filter.count}</b></button>`).join(''); }
  function readDraft(id) { try { return JSON.parse(localStorage.getItem(draftKey(id))||localStorage.getItem(`dusko-staff-draft:${userId}:${branchId}:${id}`)||'null'); } catch { return null; } }
  function clearDraft(id) { localStorage.removeItem(draftKey(id));localStorage.removeItem(`dusko-staff-draft:${userId}:${branchId}:${id}`); }
  async function selectTable(id) {
    closeVnpay?.();
    const version=++selection;
    const table=state.tables.find(t=>t.id===id); if(!table) return;
    const [result,products]=await Promise.all([request(`/api/staff/tables/${id}/session?branchId=${branchId}`),loadProducts()]);
    await loadEligible(result,id);
    if(disposed||version!==selection) return;
    acceptEligible(result);
    state.paymentMethod='CASH';state.promotionCode='';state.products=products;state.table={...table,...result.table};state.session=result.session;state.serviceRequests=result.serviceRequests||[];state.cart.clear();state.notes.clear();state.draft=readDraft(id);
    lastUpdated=new Date();syncError=false;state.tab=cashierView&&activeOrders().length?'bill':waitingOrders().length?'confirm':readyItems().length?'ready':activeOrders().length?'bill':'menu';render();
  }
  async function mutation(work, message) {
    if(state.busy) return;
    setBusy(true);showMessage('Đang xử lý…');
    try { const result=await work(); if(disposed) return; showMessage(result?.kitchenPending?'Đã nhận yêu cầu nhưng kết nối bếp đang gián đoạn. Báo bếp kiểm tra.':message,Boolean(result?.kitchenPending)); await refresh(true); }
    catch(error) {
      showMessage(error.message, true);
      toast.error('Chưa hoàn tất thao tác', error.message);
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
      if(action==='filter'){state.filter=target.dataset.filter;state.table=null;render();return;}
      if(action==='verify-customer'){verifyCustomer();return;}
      if(action==='clear-customer'){
        const tableId=state.table.id,sessionId=state.session?.id;
        if(!sessionId||!await confirmDialog({title:'Bỏ gắn khách khỏi bàn?',message:'Các lượt gọi món đã gửi được giữ nguyên. Lượt gọi tiếp theo sẽ dùng thông tin khách mới.',confirmLabel:'Bỏ gắn khách'}))return;
        return mutation(()=>post(`/api/staff/tables/${tableId}/customer/clear`,{sessionId}),'Đã bỏ gắn khách khỏi phiên bàn.');
      }
      if(action==='table') {setBusy(true);target.textContent='Đang mở bàn…';try{showMessage('');await selectTable(Number(target.dataset.id));}finally{setBusy(false);if(!state.table)render();}return;}
      if(action==='back') { closeVnpay?.();++selection;state.table=null;state.session=null;state.cart.clear();state.notes.clear();render();await refresh();return; }
      if(action==='tab') {state.tab=target.dataset.tab;render();root.querySelector('.sw-tabs [aria-selected="true"]')?.focus({preventScroll:true});return;}
      if(action==='table-filter') {
        state.filter=target.dataset.filter;
        root.querySelector('.sw-tables').innerHTML=tableCards();
        root.querySelector('.sw-overview').innerHTML=listOverview();
        setBusy(state.busy);
        root.querySelector(`.sw-filter[data-filter="${state.filter}"]`).focus({preventScroll:true});
        return;
      }
      if(action==='menu-prev'||action==='menu-next') {
        state.menuPage += action==='menu-next'?1:-1;
        updateMenuResults();
        const results=root.querySelector('[data-sw-products]');
        results.focus({preventScroll:true});
        results.scrollIntoView({block:'start'});
        return;
      }
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
      if(action==='apply-promotion'||action==='remove-promotion'){const code=action==='remove-promotion'?'':state.promotionCode.trim();if(action==='apply-promotion'&&!code)throw Error('Chọn ưu đãi trước khi áp dụng.');root.querySelector('[data-sw-input=promotion]')?.blur();return mutation(async()=>{await post(`/api/staff/tables/${state.table.id}/promotion`,{sessionId:state.session.id,code});state.promotionCode='';},code?'Đã áp mã và cập nhật tổng thanh toán.':'Đã bỏ mã khuyến mãi.');}
      if(action==='checkout') {if(!mayPay)throw Error('Chỉ thu ngân được thanh toán.');const paidSessionId=state.session.id;const method=state.paymentMethod;if(method==='QR_BANKING')return mutation(async()=>{const payment=await post(`/api/payments/vnpay/tables/${state.table.id}`);closeVnpay?.();closeVnpay=showVnpayPayment(payment,request,async()=>{if(!disposed)await refresh();await openReceipt(request,'session',paidSessionId);});},'Đang chờ khách thanh toán qua VNPay.');if(!await confirmDialog({title:'Xác nhận thanh toán',message:`Đã nhận đủ ${money(total())} ${method==='CASH'?'bằng tiền mặt':'qua máy POS'}?`,confirmLabel:'Đã nhận đủ tiền'}))return;return mutation(async()=>{await post(`/api/staff/tables/${state.table.id}/checkout`,{paymentMethod:method});state.table=null;state.session=null;render();await openReceipt(request,'session',paidSessionId);},'Thanh toán thành công. Bàn đã trở về trạng thái trống.');}
    } catch(error) {showMessage(error.message,true);}
  }
  function onInput(event) {
    const type=event.target.dataset.swInput;
    if(type==='promotion')state.promotionCode=event.target.value;
    if(type==='payment'&&['CASH','QR_BANKING','POS_CARD'].includes(event.target.value)) state.paymentMethod=event.target.value;
    if(type==='table-search') {state.search=event.target.value;root.querySelector('.sw-tables').innerHTML=tableCards();}
    if(type==='note') state.notes.set(Number(event.target.dataset.product),event.target.value);
    if(type==='menu-search'||type==='category') {if(type==='menu-search')state.menuSearch=event.target.value;else state.category=event.target.value;state.menuPage=1;updateMenuResults();}
  }
  function onTabKeydown(event) {
    if(event.key==='Enter'&&event.target.tagName==='INPUT'&&event.target.dataset.swInput==='promotion'){event.preventDefault();root.querySelector('[data-sw=apply-promotion]')?.click();return;}
    if(state.busy || !event.target.matches('[role="tab"]')) return;
    const ids=['confirm','ready','menu','bill'];
    let index=ids.indexOf(state.tab);
    if(event.key==='ArrowRight') index=(index+1)%ids.length;
    else if(event.key==='ArrowLeft') index=(index+ids.length-1)%ids.length;
    else if(event.key==='Home') index=0;
    else if(event.key==='End') index=ids.length-1;
    else return;
    event.preventDefault();
    state.tab=ids[index];render();
    root.querySelector('.sw-tabs [aria-selected="true"]').focus({preventScroll:true});
  }
  root.addEventListener('click',onClick);root.addEventListener('input',onInput);root.addEventListener('change',onInput);root.addEventListener('keydown',onTabKeydown);
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
    if (message.action === 'customer.verified' || message.action === 'order.confirmed' || message.action === 'order.rejected' || message.action === 'order.served' || message.action === 'service.resolved') {
      polling = true;
      try { await refresh(); } catch { /* keep the last view until the next poll */ } finally { polling = false; }
    }
  }
  (initialData?Promise.resolve([state.tables,state.products]):Promise.all([request(`/api/catalog/branches/${branchId}/tables`),loadProducts()])).then(([tables,products])=>{if(disposed)return;state.tables=tables;state.products=products;lastUpdated=new Date();render();}).catch(error=>{if(disposed)return;root.innerHTML='<p data-sw-message role="status" class="sw-message sw-error"></p>'+button('Thử lại','refresh');showMessage(error.message,true);});
  const stopLive=watchChanges(request,async()=>{if(disposed)return;if(state.busy||polling)throw Error('retry');polling=true;try{productsAt=0;await refresh();}finally{polling=false;}}, '/api/live', {onEvent:handleLiveEvent,onStatus:live=>{liveConnected=live;if(!disposed)updateSync();}});
  // The socket pushes every change, so the list is only polled while the
  // connection is down.
  const interval=setInterval(async()=>{if(disposed||liveConnected||state.busy||polling||document.hidden)return;polling=true;try{await refresh();}catch(error){showMessage(`Không cập nhật được: ${error.message}`,true);}finally{polling=false;}},12000);
  return {destroy(){disposed=true;customerDialog?.close();closeVnpay?.();stopLive();clearInterval(interval);root.removeEventListener('click',onClick);root.removeEventListener('input',onInput);root.removeEventListener('change',onInput);root.removeEventListener('keydown',onTabKeydown);}};
}
