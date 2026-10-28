import '../../src/tokens.css';
import { cartLineMap, cartItemsById, cartItemCount, cartBlockingItems, cartCheckoutable, comboSelectionsFromCart, cartOrderSnapshot, nextQuantity } from '../../src/cart-view.js';
import { watchChanges } from '../../src/live-updates.js';
import { createCustomerHelp } from './customer-help.js';
import { createRecognition } from './customer-recognition.js';
import { createToast } from '../../src/toast.js';
import './style.css';
import './customer-cart.css';
import '../../src/font.css';
import '../../src/pos-theme.css';
import './customer-cart-overlay.css';
import { createCustomerCartOverlay } from './customer-cart-overlay.js';
import {createCustomerMenu} from './customer-menu.js';
import {customerBasketPricing} from './customer-basket-pricing.js';
import {customerCartLines,customerCartGroups} from './customer-cart-lines.js';
import {customerOrderHistory} from './customer-order-history.js';
import './customer-menu.css';
import {customerServiceActions} from './customer-service-actions.js';
import {createCustomerViews} from './customer-views.js';
import { readStoredJson, preparePendingOrder, tryStoreJson } from '../../src/browser-storage.js';

const api = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const token = location.pathname.match(/^\/t\/([a-f0-9]{64})$/)?.[1];
const app = document.querySelector('#app');
const toast = createToast();
const money = value => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const orderHistoryKey = token ? `dusko-order-history:${token}` : '';
const pendingKey = token ? `dusko-pending-${token}` : '';
const browserStorage = { getItem: key => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value) };

// The basket lives on the server so every guest at the same table shares it.
const state = {
  data: null,          // table + menu snapshot
  cart: null,          // shared basket
  orders: [],          // every order of the current table session
  busy: false,
  message: '',
  presence: 0,
  cartPending: 0,
  lastServiceRequestAt: 0,
  cartIntent: null,
};

async function request(path, options = {}) {
  const response = await fetch(`${api}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) { const error = Error(payload.error || 'Không kết nối được máy chủ'); error.status = response.status; error.code = payload.code; throw error; }
  return payload.data;
}

const cartLines = () => cartLineMap(state.cart?.items);
const cartItems = () => cartItemsById(state.cart?.items);
const comboSelections = () => comboSelectionsFromCart(state.cart);
const productById = id => state.data?.products.find(product => product.id === id);
const quantityOf = id => cartLines().get(id) || 0;
let cartOverlay;
let customerMenu;
let customerViews;

function render() {
  if (!state.data) return;
  if(customerMenu?.isDialogOpen()){renderCart();return;}
  const navigationView=customerViews?.getView();
  customerViews?.destroy();
  const cartWasOpen = cartOverlay?.isOpen();
  const menuView = customerMenu?.getView();
  cartOverlay?.destroy();
  customerMenu?.destroy();
  const { branch, table, sessionOpen, products } = state.data;
  app.innerHTML = `<header class="customer-app-header"><div class="brand"><img class="dusko-logo" src="/dusko-logo-v1.png" alt="Dusko Restaurant"><span>DUSKO RESTAURANT</span></div><p>${escape(table.name)}</p></header>
    <main><div id="customer-menu-view"><section class="hero"><div><small>CHI NHÁNH</small><h1>${escape(branch.name)}</h1></div></section>
    <p class="customer-sync" data-customer-sync role="status"></p>${sessionOpen?'': '<p class="notice closed">Bàn chưa mở phục vụ. Vui lòng gọi nhân viên.</p>'}
    ${presenceBar()}
    <div class="guest-table-tools"><div id="service-actions">${serviceActions()}</div><button type="button" data-open-history class="guest-history-button">▤ <span>Lịch sử gọi món</span></button></div>
    <p id="customer-message" class="message" role="status" ${state.message ? '' : 'hidden'}>${escape(state.message)}</p>
    <div class="customer-layout"><section class="customer-menu" id="customer-menu"></section><section class="cart" id="customer-cart">${cartHtml()}</section></div><div id="customer-recognition"></div></div><section id="customer-history-view" hidden><div class="guest-history-header"><button type="button" data-close-history>← Thực đơn</button><h1 tabindex="-1">Lịch sử gọi món</h1><p>Các lượt gọi trong phiên phục vụ hiện tại</p></div><div id="customer-order-history">${orderListHtml()}</div></section></main>`;
  recognition?.render();
  updateConnectionLabel();
  customerMenu=createCustomerMenu({root:app.querySelector('#customer-menu'),products,quantityOf,changeQuantity,sessionOpen,api,view:menuView,getLine:id=>cartItems().get(id),combos:customerHelp?.getCombos()||[],addCombo,getComboQuantity:key=>comboSelections().find(c=>c.key===key)?.quantity||0});
  bindCartControls();
  cartOverlay = createCustomerCartOverlay({root:app, startOpen:cartWasOpen, summary:() => ({
    count:cartItemCount(state.cart?.items || []),
    total:money(customerBasketPricing(state.cart).total),
    busy:state.busy || state.cartPending > 0,
  })});
  customerViews=createCustomerViews({root:app,snapshot:navigationView,beforeNavigate:()=>{cartOverlay?.close();customerMenu?.closeDetails();}});
  const submit = app.querySelector('#submit');
  if (submit) submit.onclick = checkout;
}

/** Shows how many guests currently share this table basket. */
function presenceBar() {
  if (!state.presence || state.presence < 2) return '';
  return `<p class="presence-bar" title="Các khách tại bàn cùng chọn món trong một giỏ, thay đổi được đồng bộ.">Giỏ dùng chung · ${state.presence} khách</p>`;
}

function orderListHtml() { return customerOrderHistory(state.orders); }

let serviceBusy = null;
function serviceActions() {
  return customerServiceActions({sessionOpen:state.data?.sessionOpen,requests:state.data?.serviceRequests,busyKind:serviceBusy});
}

app.addEventListener('click', async event => {
  const button = event.target.closest('[data-service]');
  if (!button || button.disabled || serviceBusy) return;
  serviceBusy = button.dataset.service;
  app.querySelector('#service-actions').innerHTML = serviceActions();
  try {
    const call = await request(`/api/public/tables/${token}/service-requests`, { method: 'POST', body: JSON.stringify({ kind: button.dataset.service }) });
    state.lastServiceRequestAt = Date.now();
    state.data.serviceRequests = [...(state.data.serviceRequests || []).filter(r => r.kind !== call.kind), call];
    toast.success('Đã gửi yêu cầu', button.dataset.service === 'BILL' ? 'Nhân viên sẽ đến bàn hỗ trợ thanh toán.' : 'Nhân viên đã được thông báo và sẽ đến bàn.');
  } catch (error) {
    toast.error('Không gửi được yêu cầu', error.message);
  } finally {
    serviceBusy = null;
    const holder = app.querySelector('#service-actions');
    if (holder) holder.innerHTML = serviceActions();
  }
});

function cartHtml() {
  const { sessionOpen } = state.data;
  const entries = state.cart?.items || [];
  const pricing = customerBasketPricing(state.cart);
  const total = pricing.total;
  const blocking = cartBlockingItems(entries);
  const busy = state.busy || state.cartPending > 0;
  const canSend = !state.cartIntent && cartCheckoutable(entries, { sessionOpen, busy });
  return `<div class="guest-cart-heading"><h2 id="customer-cart-title">Giỏ món <span>${cartItemCount(entries)} món${state.presence > 1 ? ' · dùng chung' : ''}</span></h2>${entries.length ? `<button type="button" data-clear-cart class="guest-cart-clear" ${busy?'disabled':''}>Xóa tất cả</button>` : ''}</div><div class="guest-cart-scroll">${entries.length ? customerCartLines(entries,{productById,busy,combos:pricing.valid,api}) : '<p>Chọn món từ thực đơn phía trên.</p>'}</div><div class="guest-cart-footer">${state.cartIntent==='clear'?'<div class="guest-cart-confirm" role="group" aria-labelledby="guest-clear-title"><strong id="guest-clear-title">Xóa tất cả món của bàn?</strong><p>Mọi khách tại bàn đều thấy thay đổi này.</p><div><button type="button" data-cancel-clear>Giữ lại</button><button type="button" data-confirm-clear>Xóa tất cả</button></div></div>':''}<div class="total">Tạm tính <b>${money(total)}</b></div><button id="submit" class="primary" ${canSend ? '' : 'disabled'}>${state.busy ? 'Đang gửi…' : busy ? 'Đang cập nhật…' : 'Gửi yêu cầu cho nhân viên'}</button>${blocking.length ? '<small class="cart-warning">Giỏ có món thiếu nguyên liệu hoặc vượt số suất còn lại. Hãy điều chỉnh trước khi gửi.</small>' : ''}<small>Thanh toán tại quầy hoặc qua nhân viên. Giá được kiểm tra lại khi gửi.</small></div>`;
}

/** Replace only the cart panel so the menu keeps its scroll and search state. */
function renderCart() {
  const holder = app.querySelector('#customer-cart');
  if (!holder) return;
  const active = document.activeElement;
  const focusAttribute = holder.contains(active) && ['data-cart-plus', 'data-cart-minus', 'data-remove', 'data-clear-cart', 'id'].find(name => active.hasAttribute(name));
  const focusValue = focusAttribute ? active.getAttribute(focusAttribute) : null;
  const cartScroll=holder.querySelector('.guest-cart-scroll')?.scrollTop||0;
  holder.innerHTML = cartHtml();
  holder.querySelector('.guest-cart-scroll').scrollTop=cartScroll;
  cartOverlay?.update();
  customerMenu?.update();
  bindCartControls();
  if (focusAttribute) {
    const replacement = [...holder.querySelectorAll(`[${focusAttribute}]`)].find(element => element.getAttribute(focusAttribute) === focusValue);
    if (replacement && !replacement.disabled) replacement.focus({preventScroll:true});
    else if (cartOverlay?.isOpen()) app.querySelector('.customer-cart-dialog-bar button').focus({preventScroll:true});
  }
  app.querySelectorAll('[data-quantity]').forEach(counter => counter.textContent = quantityOf(Number(counter.dataset.quantity)));
  // The combo grid depends on the basket and on what is still in stock.
  customerHelp?.renderCombos();
}

function bindCartControls() {
  app.querySelectorAll('[data-cart-plus]').forEach(button => button.onclick = () => changeQuantity(Number(button.dataset.cartPlus), 1));
  app.querySelectorAll('[data-cart-minus]').forEach(button => button.onclick = () => changeQuantity(Number(button.dataset.cartMinus), -1));
  app.querySelectorAll('[data-remove]').forEach(button => button.onclick = () => removeLine(Number(button.dataset.remove)));
  app.querySelectorAll('[data-note]').forEach(input => {
    input.onchange = () => saveNote(Number(input.dataset.note), input.value.trim());
    input.onblur = () => saveNote(Number(input.dataset.note), input.value.trim());
  });
  app.querySelectorAll('[data-combo-minus],[data-combo-plus],[data-combo-remove]').forEach(button=>button.onclick=()=>{
    const key=button.dataset.comboMinus||button.dataset.comboPlus||button.dataset.comboRemove;
    const combo=comboSelections().find(c=>c.key===key);
    changeCombo(key,button.hasAttribute('data-combo-remove')?-1000:button.hasAttribute('data-combo-minus')?-1:1,combo?.price);
  });
  const clear = app.querySelector('[data-clear-cart]');
  if (clear) clear.onclick = () => {state.cartIntent='clear';renderCart();app.querySelector('[data-cancel-clear]')?.focus({preventScroll:true});};
  const cancelClear=app.querySelector('[data-cancel-clear]'),confirmClear=app.querySelector('[data-confirm-clear]');
  if(cancelClear)cancelClear.onclick=()=>{state.cartIntent=null;renderCart();app.querySelector('[data-clear-cart]')?.focus({preventScroll:true});};
  if(confirmClear)confirmClear.onclick=clearCart;
  const submit = app.querySelector('#submit');
  if (submit) submit.onclick = checkout;
}

/**
 * Change a line in the shared basket.
 *
 * The server applies the change as a delta so two guests pressing "+" at the
 * same time never overwrite each other.
 */
let quantityQueue = Promise.resolve();
function changeQuantity(productId, delta, source, note) {
  if (state.busy) return false;
  if (source) { source.disabled=true;source.setAttribute('aria-busy','true'); }
  state.cartPending++;
  renderCart();
  quantityQueue = quantityQueue.then(async () => { try {
    state.cart = await request(`/api/public/tables/${token}/cart/items`, { method: 'POST', body: JSON.stringify({ productId, quantity: delta, ...(note===undefined?{}:{note}) }) });
    if (delta>0) cartOverlay?.added(productById(productId)?.name || 'món',source);
    return true;
  } catch (error) {
    toast.error('Không cập nhật được giỏ món', error.message);
    await refreshCart();
    return false;
  } finally {
    state.cartPending--;
    renderCart();
    if (source?.isConnected) { source.disabled=false;source.removeAttribute('aria-busy'); }
  }});
  return quantityQueue;
}

async function saveNote(productId, note) {
  const item = cartItems().get(productId);
  if (!item || (item.note || '') === note) return;
  state.cartPending++;
  try {
    state.cart = await request(`/api/public/tables/${token}/cart/items/${productId}`, { method: 'PATCH', body: JSON.stringify({ quantity: item.quantity, note }) });
  } catch (error) {
    toast.error('Không lưu được ghi chú', error.message);
  } finally {
    state.cartPending--;
    renderCart();
  }
}

async function removeLine(productId) {
  const loose=customerCartGroups(state.cart?.items||[],customerBasketPricing(state.cart).valid).items.find(item=>item.productId===productId);
  if(!loose)return;
  if((cartItems().get(productId)?.quantity||0)>loose.quantity)return changeQuantity(productId,-loose.quantity);
  state.cartPending++;
  renderCart();
  try {
    state.cart = await request(`/api/public/tables/${token}/cart/items/${productId}`, { method: 'DELETE' });
    toast.info('Đã bỏ món khỏi giỏ');
  } catch (error) {
    toast.error('Không bỏ được món', error.message);
  } finally {
    state.cartPending--;
    renderCart();
  }
}

async function clearCart() {
  if(state.busy||state.cartPending>0)return;
  state.cartIntent=null;
  state.cartPending++;
  renderCart();
  try {
    state.cart = await request(`/api/public/tables/${token}/cart`, { method: 'DELETE' });
    toast.info('Đã xóa giỏ món của bàn');
  } catch (error) {
    toast.error('Không xóa được giỏ món', error.message);
  } finally {
    state.cartPending--;
    renderCart();
  }
}

/** One request changes bundle metadata and component quantities in one transaction. */
function changeCombo(key,delta,price){
  if(state.busy)return Promise.resolve(false);
  if(delta>0&&!String(key).split('-').map(Number).every(id=>{const p=productById(id);return p?.canOrder&&quantityOf(id)+delta<=Math.min(1000,p.maxOrderQuantity??1000);})){toast.warning('Chưa thể thêm combo','Một số món đã hết hoặc vượt số suất còn lại.');return Promise.resolve(false);}
  state.cartPending++;renderCart();
  quantityQueue=quantityQueue.then(async()=>{try{
    state.cart=await request(`/api/public/tables/${token}/cart/combos/change`,{method:'POST',body:JSON.stringify({key,delta,price})});
    if(delta>0)cartOverlay?.added('combo');
    return true;
  }catch(error){toast.error('Không cập nhật được combo',error.message);await refreshCart();return false;}
  finally{state.cartPending--;renderCart();}});
  return quantityQueue;
}
function addCombo(combo){return combo?changeCombo(combo.id,1,combo.price):false;}
function removeCombo(key){return changeCombo(key,-1000);}

async function checkout() {
  if (state.busy || state.cartPending>0 || state.cartIntent || !state.data?.sessionOpen) return;
  if(!cartCheckoutable(state.cart?.items||[],{sessionOpen:state.data.sessionOpen,busy:false}))return;
  const entries = state.cart?.items || [];
  if (!entries.length) return;
  const combos = comboSelections();

  state.busy = true;
  state.message = '';
  render();
  let requestStarted = false;
  try {
    const snapshot = cartOrderSnapshot(entries);
    const pending = preparePendingOrder(browserStorage, pendingKey, state.data.sessionId, snapshot, undefined, combos.map(({ key, quantity, price }) => ({ key, quantity, price })));
    requestStarted = true;
    const result = await request(`/api/public/tables/${token}/cart/checkout`, { method: 'POST', body: JSON.stringify({ id: pending.id, combos: pending.combos || [] }) });
    try { localStorage.removeItem(pendingKey); } catch { }
    if (result.isDuplicate) {
      toast.info('Lượt gọi món đã được ghi nhận', 'Yêu cầu này đã gửi trước đó, không tạo trùng.');
    } else {
      toast.success('Đã gửi yêu cầu', 'Nhân viên sẽ tới bàn xác nhận trước khi chuyển món xuống bếp.');
    }
    await Promise.all([refreshCart(), refreshOrders()]);
  } catch (error) {
    toast.error(requestStarted ? 'Chưa gửi được yêu cầu' : 'Không gửi được yêu cầu', requestStarted ? `${error.message}. Nếu mất mạng, hãy thử lại; yêu cầu đang giữ cùng mã để tránh tạo trùng.` : error.message);
  } finally {
    state.busy = false;
    render();
  }
}

async function refreshCart() {
  if (!token) return;
  try {
    state.cart = await request(`/api/public/tables/${token}/cart`);
    renderCart();
  } catch (error) {
    if (error.status === 409) {
      // The session ended, so the basket is gone as well.
      state.cart = { items: [], combos: [], itemCount: 0, subtotal: 0 };
      renderCart();
    }
  }
}

async function refreshOrders() {
  if (!token) return;
  try {
    state.orders = await request(`/api/public/tables/${token}/orders`);
    const holder = app.querySelector('#customer-order-history');
    if (holder) holder.innerHTML = orderListHtml();
  } catch (error) { /* Keep the last known order list during a temporary outage. */ }
}

let tableRefreshing = false;
let liveConnected = false;
async function refreshTable(strict = false) {
  if (state.busy || tableRefreshing) { if (strict) throw Error('busy'); return; }
  tableRefreshing = true;
  try {
    const data = await request(`/api/public/tables/${token}`);
    if (state.busy) { if (strict) throw Error('busy'); return; }
    const changed = state.data?.sessionId !== data.sessionId;
    if (changed) {
      state.cart = null;
      state.orders = [];
      try { localStorage.removeItem(orderHistoryKey); } catch { }
      state.message = data.sessionOpen ? 'Bàn đã mở lượt phục vụ mới. Bạn có thể chọn món.' : 'Bàn đã kết thúc phục vụ. Vui lòng nhờ nhân viên nếu cần hỗ trợ.';
      if (data.sessionOpen) toast.info('Bàn đã mở lượt phục vụ mới', 'Giỏ món đã được làm mới.');
    }
    const previous = state.data;
    state.presence = data.presence ?? state.presence;
    const removed = previous ? previous.products.filter(p => cartLines().has(p.id) && !data.products.some(n => n.id === p.id)) : [];
    data.products.push(...removed.map(p => ({ ...p, canOrder: false, maxOrderQuantity: 0, availabilityReason: 'Đã ngừng bán' })));
    state.data = data;
    const actions = app.querySelector('#service-actions');
    if (actions) actions.innerHTML = serviceActions();
    const cartChanged = previous && data.products.some(p => {
      const old = previous.products.find(x => x.id === p.id);
      const line = cartLines().get(p.id);
      return line && old && (old.sellingPrice !== p.sellingPrice || old.canOrder !== p.canOrder);
    });
    if (cartChanged) {
      state.message = 'Một số món trong giỏ vừa thay đổi giá hoặc tình trạng còn hàng. Vui lòng kiểm tra trước khi gửi.';
      const notice = app.querySelector('#customer-message');
      if (notice) { notice.textContent = state.message; notice.hidden = false; }
      toast.warning('Giỏ món vừa thay đổi', 'Một số món đã đổi giá hoặc hết hàng. Kiểm tra lại trước khi gửi.');
    }
    render();
  } catch (error) { if (strict) throw error; /* Keep the menu usable during a temporary connection failure. */ }
  finally { tableRefreshing = false; }
}

const recognition = token ? createRecognition({ token, request, getSessionId:()=>state.data?.sessionId, onVerified: () => {} }) : null;
const customerHelp = token ? createCustomerHelp({
  token,
  request,
  getState: () => state,
  api,
  addCombo,
  cartLines,
  comboSelections,
  onCombosChanged:combos=>customerMenu?.setCombos(combos),
}) : null;

function updateConnectionLabel(){const label=document.querySelector('[data-customer-sync]');if(label)label.textContent=liveConnected?'Đã kết nối':'Đang kết nối lại…';}
async function load() {
  if (!token) {
    app.innerHTML = '<main class="guest-entry"><div class="guest-entry-brand"><img class="dusko-logo" src="/dusko-logo-v1.png" alt="Dusko Restaurant"> DUSKO</div><section><span class="guest-entry-icon" aria-hidden="true">▦</span><h1>Quét mã QR tại bàn</h1><p>Mở camera điện thoại và quét mã QR được đặt trên bàn để xem thực đơn, chọn món và gửi yêu cầu.</p><ol><li>Nhân viên mở bàn khi bạn đến.</li><li>Quét QR và chọn món yêu thích.</li><li>Nhân viên xác nhận rồi chuyển món tới bếp.</li></ol><p class="guest-entry-help">Không quét được mã? Nhân viên có thể gọi món giúp bạn.</p></section></main>';
    return;
  }
  try {
    const [data, cart, orders] = await Promise.all([
      request(`/api/public/tables/${token}`),
      request(`/api/public/tables/${token}/cart`).catch(() => null),
      request(`/api/public/tables/${token}/orders`).catch(() => []),
    ]);
    state.data = data;
    state.cart = cart;
    state.orders = orders;
    state.presence = data.presence || 0;
    render();
    recognition?.pollVerified();
    customerHelp?.loadCombos();
    watchChanges(request, async () => { if (state.busy) throw Error('busy'); await refreshTable(true); await refreshCart(); await refreshOrders(); },
      `/api/public/tables/${token}/live`,
      {
        onEvent: handleLiveEvent,
        // The socket pushes every change, so the menu is only polled while the
        // connection is down. A table of guests would otherwise hammer the API.
        onStatus: live => { liveConnected = live; updateConnectionLabel(); if (live) { refreshTable(); refreshCart(); refreshOrders(); } },
      });
    setInterval(() => { if (!liveConnected) { refreshTable(); refreshCart(); refreshOrders(); } }, 15000);
  } catch (error) {
    app.innerHTML = `<main><h1>Không mở được thực đơn</h1><p>${escape(error.message)}</p><p>Vui lòng gọi nhân viên.</p></main>`;
  }
}

/**
 * React to a scoped real-time event.
 *
 * The socket only says what changed, so each interface refreshes exactly the
 * part of the screen it owns.
 */
async function handleLiveEvent(message) {
  switch (message.action) {
    case 'customer.verified': await recognition?.pollVerified(); break;
    case 'cart.updated':
      await refreshCart();
      break;
    case 'order.created':
    case 'order.confirmed':
    case 'order.rejected':
    case 'order.served':
      await Promise.all([refreshOrders(), refreshCart()]);
      if (message.action === 'order.confirmed') toast.success('Nhân viên đã xác nhận', 'Món của bạn đang được chuẩn bị.');
      if (message.action === 'order.rejected') toast.warning('Yêu cầu bị từ chối', message.reason || 'Vui lòng hỏi nhân viên.');
      break;
    case 'service.request':
      // The guest who pressed the button already got a confirmation, so only
      // the other guests of the table are told about it.
      if (Date.now() - state.lastServiceRequestAt > 5000) toast.info('Bàn đang gọi nhân viên', 'Yêu cầu hỗ trợ vừa được gửi từ bàn của bạn.');
      break;
    case 'service.resolved':
      toast.success('Nhân viên đã hỗ trợ', 'Yêu cầu của bàn đã được xử lý.');
      await refreshTable();
      break;
    case 'table.session.opened':
      await refreshTable();
      toast.info('Bàn đã mở phục vụ', 'Bạn có thể chọn món ngay.');
      break;
    case 'table.session.closed':
      await refreshTable();
      toast.warning('Bàn đã kết thúc phục vụ', 'Vui lòng nhờ nhân viên nếu cần hỗ trợ.');
      break;
    case 'inventory.changed':
      await refreshTable();
      break;
    case 'presence.changed':
      state.presence = message.presence ?? state.presence;
      render();
      break;
    default:
      break;
  }
}

app.addEventListener('click', event => {
  const button = event.target.closest('[data-remove-combo]');
  if (!button) return;
  removeCombo(button.dataset.removeCombo);
});

load();

import '../../src/ui-foundation.css';
