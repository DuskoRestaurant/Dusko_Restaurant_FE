import './style.css';

const api = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080').replace(/\/$/, '');
const token = location.pathname.match(/^\/t\/([a-f0-9]{64})$/)?.[1];
const app = document.querySelector('#app');
const money = value => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const state = { data: null, cart: new Map(), notes: new Map(), order: null, busy: false, message: '' };
async function request(path, options = {}) {
  const response = await fetch(`${api}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(payload.error || 'Không kết nối được máy chủ');
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
    ${state.message ? `<p class="message" role="status">${escape(state.message)}</p>` : ''}
    ${state.order ? `<section class="receipt"><h2>Đã gửi tới hệ thống</h2><p>Mã lượt: <b>${escape(state.order.orderCode)}</b></p><p id="order-status">Đang tải trạng thái…</p></section>` : ''}
    <div class="toolbar"><h2>Thực đơn</h2><input id="search" type="search" placeholder="Tìm món ăn" aria-label="Tìm món ăn"></div>
    <div id="menu" class="menu">${products.map(p => `<article class="dish" data-name="${escape(p.name.toLowerCase())}"><div class="photo">${p.imageUrl ? `<img src="${escape(p.imageUrl.startsWith('http') ? p.imageUrl : api + p.imageUrl)}" alt="${escape(p.name)}" loading="lazy">` : '<span>Chưa có ảnh</span>'}</div><div class="dish-body"><small>${escape(p.category.name)}</small><h3>${escape(p.name)}</h3><b>${money(p.sellingPrice)}</b><div class="stepper"><button data-minus="${p.id}" aria-label="Giảm ${escape(p.name)}">−</button><span>${state.cart.get(p.id) || 0}</span><button data-plus="${p.id}" aria-label="Thêm ${escape(p.name)}">+</button></div></div></article>`).join('')}</div>
    <section class="cart"><h2>Giỏ hàng <span>${entries.reduce((sum, [, quantity]) => sum + quantity, 0)} món</span></h2>${entries.length ? entries.map(([id, quantity]) => { const p = products.find(item => item.id === id); return `<div class="cart-item"><p>${escape(p.name)} × ${quantity}<b>${money(p.sellingPrice * quantity)}</b></p><input data-note="${id}" maxlength="500" value="${escape(state.notes.get(id) || '')}" placeholder="Ghi chú: ít cay, không hành…"></div>`; }).join('') : '<p>Chọn món từ thực đơn phía trên.</p>'}<div class="total">Tạm tính <b>${money(total)}</b></div><button id="submit" class="primary" ${!sessionOpen || !entries.length || state.busy ? 'disabled' : ''}>${state.busy ? 'Đang gửi…' : 'Xác nhận gọi món'}</button><small>Thanh toán tại quầy hoặc qua nhân viên. Giá được kiểm tra lại khi gửi.</small></section></main>`;
  app.querySelectorAll('[data-plus]').forEach(button => button.onclick = () => { const id = Number(button.dataset.plus); state.cart.set(id, Math.min(1000, (state.cart.get(id) || 0) + 1)); render(); });
  app.querySelectorAll('[data-minus]').forEach(button => button.onclick = () => { const id = Number(button.dataset.minus); state.cart.set(id, Math.max(0, (state.cart.get(id) || 0) - 1)); render(); });
  app.querySelectorAll('[data-note]').forEach(input => input.oninput = () => state.notes.set(Number(input.dataset.note), input.value));
  app.querySelector('#search').oninput = event => { const query = event.target.value.trim().toLowerCase(); app.querySelectorAll('.dish').forEach(dish => dish.hidden = !dish.dataset.name.includes(query)); };
  app.querySelector('#submit').onclick = submit;
  if (state.order) updateStatus();
}
async function submit() {
  if (state.busy || !state.data.sessionOpen) return;
  const items = [...state.cart.entries()].filter(([, quantity]) => quantity > 0).map(([id, quantity]) => ({ productId: id, quantity, price: state.data.products.find(p => p.id === id).sellingPrice, ...(state.notes.get(id)?.trim() ? { note: state.notes.get(id).trim() } : {}) }));
  if (!items.length || !confirm(`Gửi ${items.reduce((n, item) => n + item.quantity, 0)} món cho ${state.data.table.name}?`)) return;
  state.busy = true; state.message = ''; render();
  const pendingKey = `dusko-pending-${token}`;
  let pending = JSON.parse(localStorage.getItem(pendingKey) || 'null');
  if (!pending || JSON.stringify(pending.items) !== JSON.stringify(items)) { pending = { id: crypto.randomUUID(), items }; localStorage.setItem(pendingKey, JSON.stringify(pending)); }
  try { const result = await request(`/api/public/tables/${token}/orders`, { method: 'POST', body: JSON.stringify(pending) }); state.order = result.order; state.cart.clear(); state.notes.clear(); localStorage.removeItem(pendingKey); state.message = result.kitchenPending ? 'Đơn đã lưu nhưng đang chờ chuyển tới bếp. Vui lòng báo nhân viên.' : 'Lượt gọi món đã được hệ thống ghi nhận.'; }
  catch (error) { state.message = `${error.message}. Nếu mất mạng, hãy thử lại; yêu cầu đang giữ cùng mã để tránh tạo trùng.`; }
  finally { state.busy = false; render(); }
}
async function updateStatus() { try { const order = await request(`/api/public/tables/${token}/orders/${state.order.id}`); const element = document.querySelector('#order-status'); if (element) element.textContent = `Trạng thái: ${order.status} · ${order.items.map(item => `${item.product.name}: ${item.kdsStatus}`).join(', ')}`; } catch {} }
async function load() { if (!token) { app.innerHTML = '<main><h1>Mã QR không hợp lệ</h1><p>Vui lòng nhờ nhân viên kiểm tra mã tại bàn.</p></main>'; return; } try { state.data = await request(`/api/public/tables/${token}`); render(); setInterval(updateStatus, 15000); } catch (error) { app.innerHTML = `<main><h1>Không mở được thực đơn</h1><p>${escape(error.message)}</p><p>Vui lòng gọi nhân viên.</p></main>`; } }
load();
