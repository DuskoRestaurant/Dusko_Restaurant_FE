import './tokens.css';
import {authenticatorLogin,reconfigureAuthenticator} from './mfa-login.js';
import {forecastSummary,showAiActionResult,ingredientPlanMarkup,reviewDayMarkup} from './ai-workflow.js';
import {openReceipt} from './receipt.js';
import { showVnpayPayment } from './vnpay-payment.js';
import { mountAccounts, passwordDialog } from './accounts.js';
import './accounts.css';
import { mountComboApproval } from './combo-approval.js';
import { createCustomerAdmin } from './customer-admin.js';
import { watchChanges } from './live-updates.js';
import { sharedToast } from './toast.js';
import { mountFpPipeline } from './fp-pipeline.js';
import { mountLogin, staffUrl } from './app-entry.js';
import './style.css';
import './offline.css';
import './management.css';
import './theme.css';
import { request, uploadProductImage, ApiError, money, number, dateTime, tomorrow, escapeHtml as e } from './api.js';
import { readQueue, saveQueue, pendingFor, applySyncResults } from './offline.js';
import { locationsHtml, catalogHtml, numberField, recipeEntries } from './management.js';
import { productPhoto } from './product-photo.js';
import { API_BASE } from './api.js';
import { createServiceWorkspace } from './service-workspace.js';
import { confirmDialog } from './confirm-dialog.js';
import { showQrPreview } from './qr-preview.js';
import './readability.css';
import './font.css';
import './forecast.css';
import { kitchenControls, kitchenPanel, kitchenAgeText } from './kitchen-view.js';
import { navIcon } from './ui-icons.js';
import { createReadCache } from './read-cache.js';

const app = document.querySelector('#app');
let serviceWorkspace;
function readSessionUser() { try { return JSON.parse(sessionStorage.getItem('dusko_user') || 'null'); } catch { sessionStorage.removeItem('dusko_user'); return null; } }
document.addEventListener('error', event => {
  const image = event.target;
  if (image instanceof HTMLImageElement && image.classList.contains('product-photo')) {
    const placeholder = document.createElement('div');
    placeholder.className = `${image.className} no-photo`;
    placeholder.textContent = 'Ảnh không tải được';
    image.replaceWith(placeholder);
  }
}, true);
const state = { page: ['pipeline','combos','users'].includes(new URLSearchParams(location.search).get('page')) ? new URLSearchParams(location.search).get('page') : 'overview', pageLoadSeq: 0, branch: Number(localStorage.getItem('dusko_branch') || 1), token: sessionStorage.getItem('dusko_token') || '', user: readSessionUser(), branches: [], data: {}, cart: [], tableId: '', date: tomorrow(), status: '', loading: false, kitchenStatus:'ALL', kitchenStation:'ALL', kitchenLastUpdated:null };
const nav = [ ['overview','Tổng quan','◫'], ['orders','Phục vụ & thu ngân','▤'], ['kitchen','Màn hình bếp','◈'], ['inventory','Kho hiện tại','▦'], ['forecast','Dự báo AI','✧'], ['combos','Duyệt combo','◇'], ['pipeline','Luồng FP-Growth','◇'], ['analytics','Phân tích món','◉'], ['locations','Chi nhánh & bàn','▥'], ['catalog','Thực đơn','◧'], ['users','Tài khoản','◉'], ['customers','Khách hàng','◎'], ['tiers','Hạng thành viên','◆'], ['promotions','Khuyến mãi','%'] ];
const pages = { ADMIN: nav.map(x=>x[0]), MANAGER: ['overview','orders','kitchen','inventory','forecast','pipeline','analytics','locations','catalog','customers'], CASHIER: ['orders'], WAITER: ['orders'], CHEF: ['kitchen','catalog'] };
const allowedPages = () => pages[state.user?.role] || [];
const defaultPage = () => allowedPages()[0] || 'overview';
const statusLabel = { AWAITING_CONFIRMATION:'Chờ nhân viên xác nhận', PENDING:'Chờ thanh toán', PAID:'Đã thanh toán', CANCELLED:'Đã hủy', SCHEDULED:'Chờ nấu', COOKING:'Đang nấu', COMPLETED:'Hoàn thành' };
const badge = s => `<span class="badge ${String(s).toLowerCase()}">${statusLabel[s] || e(s)}</span>`;
const originBadge = order => order.dataOrigin==='SYNTHETIC'?'<span class="data-origin">Dữ liệu mô phỏng đồ án</span>':'';
const empty = (title, detail) => `<div class="empty"><span>◇</span><strong>${title}</strong><p>${detail}</p></div>`;
const row = (cells) => `<tr>${cells.map(c => `<td>${c}</td>`).join('')}</tr>`;
const table = (headers, rows) => `<div class="table-scroll"><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
const field = (label, html) => `<label class="field"><span>${label}</span>${html}</label>`;
const btn = (label, action, kind='primary', extra='') => `<button class="btn ${kind}" data-action="${action}" ${extra}>${label}</button>`;
const access = roles => !roles || !!state.user && roles.includes(state.user.role);

function showDataNotice(text = 'Có dữ liệu mới. Cập nhật để xem thay đổi.') {
  if (!state.token || !document.querySelector('#page')) return;
  let notice = document.querySelector('#data-refresh-notice');
  if (!notice) {
    notice = document.createElement('div'); notice.id = 'data-refresh-notice'; notice.className = 'data-refresh-notice';
    document.querySelector('#page').before(notice);
  }
  notice.innerHTML = `<span>${e(text)}</span><button class="btn secondary" data-action="reload">Cập nhật dữ liệu</button>`;
}
const reads = createReadCache({
  onRefresh: () => showDataNotice(),
  onError: error => { if (error.status === 401) signOut(); else if (error.status === 403) { invalidateReads(); loadPage(); } else showDataNotice('Chưa cập nhật được dữ liệu. Nhấn cập nhật để thử lại.'); },
});
const pipelineViews = new Map();
const startupReads = new Map();
let stopLive, closeVnpayPayment, startSeq = 0;
function invalidateReads() { startupReads.clear(); reads.clear(); }
async function api(path, options = {}) {
  const token = state.token, method = (options.method || 'GET').toUpperCase();
  const execute = () => request(path, { ...options, token });
  if (method !== 'GET') {
    invalidateReads();
    try { return await execute(); } finally { invalidateReads(); }
  }
  const key = `${token}:${path}`;
  if (!options.signal && options.cache !== 'no-store' && startupReads.has(key)) {
    const value = startupReads.get(key); startupReads.delete(key);
    if (!path.startsWith('/api/users')) reads.prime(key, value);
    return value;
  }
  // Session/live endpoints and account administration always check the server.
  if (!/^\/api\/(workspace\?|catalog\/|analytics\/|inventory\/|orders\?|kds\/batches\?|fp-pipeline\?|combos\/approval\?)/.test(path) || options.signal || options.cache === 'no-store') return execute();
  const volatile = /workspace\?module=(?:overview|orders|inventory|locations)&|\/orders\?|\/kds\/|\/inventory\/|\/combos\/|\/tables(?:\?|$)/.test(path);
  return reads.read(`${token}:${path}`, execute, volatile ? { ttl: 3000, maxAge: 15000 } : undefined);
}
const toasts = sharedToast();
/**
 * Open a modal as a native <dialog>.
 *
 * The console's three form modals used to be a positioned <div> with
 * role="dialog" aria-modal="true", which promised inertness the markup never
 * delivered: Tab walked straight out into the page behind, focus was not
 * restored on close, and Escape was hand-rolled (and missing entirely on the
 * recipe dialog). showModal() provides the focus trap, Escape handling and focus
 * restoration natively, matching the seven dialogs that already use it.
 */
function openModal(html, { className = '', label } = {}) {
  document.querySelector('.modal-wrap')?.close();
  const dialog = document.createElement('dialog');
  dialog.className = `modal-wrap${className ? ` ${className}` : ''}`;
  if (label) dialog.setAttribute('aria-label', label);
  dialog.innerHTML = html;
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
  document.body.append(dialog);
  dialog.showModal();
  return dialog;
}
function closeModal(dialog) { if (dialog?.open) dialog.close(); }
// Clicking the dimmed area dismisses, matching the previous overlay behaviour.
document.addEventListener('click', event => {
  const dialog = event.target?.closest?.('dialog.modal-wrap');
  if (dialog && event.target === dialog) dialog.close();
});
// Action feedback routes through the shared toast so it is announced by a live
// region like every other notice. It previously built a bare `.toast` div with
// no role, which screen readers silently ignored.
function toast(message, bad=false) { bad ? toasts.error(message) : toasts.success(message); }
// Real-time notices for the console. Scoped events say exactly what changed,
// so the console can point the manager at the right screen.
function notifyLiveEvent(message) {
  const name = message.tableName ? String(message.tableName) : '';
  if (message.action === 'service.request') {
    toasts.warning(name ? `${name}: khách cần nhân viên hỗ trợ` : 'Khách cần nhân viên hỗ trợ', message.kind === 'BILL' ? 'Khách yêu cầu thanh toán tại bàn.' : 'Nhân viên hãy đến bàn hỗ trợ ngay.');
    return;
  }
  if (message.action === 'order.created' && ['orders', 'kitchen'].includes(state.page)) {
    toasts.info('Có yêu cầu gọi món mới', name ? `Khách tại ${name} vừa gửi yêu cầu.` : 'Khách vừa gửi yêu cầu gọi món.');
  }
}
let busyControls=[];
function busy(value) {
  state.loading=value;
  if(value){
    const active=document.activeElement;
    busyControls=[...document.querySelectorAll('button[data-action]')].map(button=>({button,disabled:button.disabled,label:button.innerHTML,active:button===active}));
    busyControls.forEach(({button,active})=>{button.disabled=true;if(active){button.textContent='Đang xử lý…';button.setAttribute('aria-busy','true');}});
  }else{busyControls.forEach(({button,disabled,label,active})=>{button.disabled=disabled;if(active){button.innerHTML=label;button.removeAttribute('aria-busy');}});busyControls=[];}
}
async function perform(work, success) { try { busy(true); const result=await work(); if(success) toast(success); return result; } catch(err) { toast(err.message, true); return null; } finally { busy(false); } }

function shell() {
  if(!state.token||!state.user){showEntry();return;}
  serviceWorkspace?.destroy(); serviceWorkspace=null;
  if(!allowedPages().includes(state.page)) state.page=defaultPage();
  const branchControl=state.user?.role==='ADMIN' ? `<select id="branch" aria-label="Chi nhánh">${state.branches.map(b=>`<option value="${b.id}" ${b.id===state.branch?'selected':''}>${e(b.name)}</option>`).join('')}</select>` : `<span>${e(state.user?.branchName || state.branches.find(b=>b.id===state.branch)?.name || 'Chi nhánh')}</span>`;
  app.innerHTML = `<div class="layout ${state.user?'':'auth-layout'}"><aside class="sidebar"><div class="brand"><span class="brand-mark">D</span><div><strong>DUSKO</strong><small>RESTAURANT OS</small></div></div><div class="workspace-label">ĐIỀU HÀNH NHÀ HÀNG</div><nav>${nav.filter(([key])=>allowedPages().includes(key)).map(([key,label,icon])=>`<button class="nav-item ${state.page===key?'active':''}" data-page="${key}"><span class="nav-icon">${navIcon(key)}</span>${label}</button>`).join('')}</nav><a class="staff-entry-link" href="${e(staffUrl)}">App nhân viên ↗</a><div class="sidebar-foot"><div class="online-dot"></div><div><strong>Dusko Restaurant</strong><small>Quản lý & phục vụ</small></div></div></aside><main class="main"><header class="topbar"><div class="breadcrumb">Hệ thống <span>/</span> ${state.user?nav.find(n=>n[0]===state.page)[1]:'Đăng nhập'}</div><div class="top-actions"><label class="branch-picker">Chi nhánh ${branchControl}</label><span class="date-pill">${new Intl.DateTimeFormat('vi-VN',{dateStyle:'medium'}).format(new Date())}</span><span class="avatar">${e((state.user?.fullName || 'K').slice(0,1).toUpperCase())}</span></div></header><div class="content"><div id="page"></div></div></main></div>`;
  document.querySelector('#branch')?.addEventListener('change', ev=>{ state.branch=Number(ev.target.value); state.cart=[]; state.tableId=''; localStorage.setItem('dusko_branch',state.branch); loadPage(); });
  document.querySelectorAll('[data-page]').forEach(el=>el.addEventListener('click',()=>{state.page=el.dataset.page; shell(); loadPage();}));
  loginPanel();
}
function title(kicker, heading, text, tools='') { return `<div class="page-head"><div><span class="eyebrow">${kicker}</span><h1>${heading}</h1><p>${text}</p></div><div class="head-tools">${tools}</div></div>`; }
function render(html) { document.querySelector('#page').innerHTML=html; }
async function loadPage() {
  const loadSeq=++state.pageLoadSeq;
  serviceWorkspace?.destroy(); serviceWorkspace=null;
  if(!state.token || !state.user) { showEntry(); return; }
  if(!allowedPages().includes(state.page)) { state.page=defaultPage(); shell(); }
  const requestedPage=state.page, requestedBranch=state.branch, requestedToken=state.token;
  const stillCurrent=()=>loadSeq===state.pageLoadSeq&&requestedPage===state.page&&requestedBranch===state.branch&&requestedToken===state.token;
  document.querySelector('#data-refresh-notice')?.remove();
  render('<div class="loading">Đang tải dữ liệu…</div>');
  try {
    if(['overview','orders','inventory','locations','catalog'].includes(requestedPage)) {
      const path=`/api/workspace?module=${requestedPage}&branchId=${requestedBranch}${requestedPage==='inventory'?`&targetDate=${state.date}`:''}`;
      const data=await workspaceRead(path,requestedPage,requestedBranch);
      if(!stillCurrent())return;
      state.data=data;
      if(requestedPage==='locations')state.branches=data.branches;
      ({overview,orders:ordersPage,inventory,locations,catalog})[requestedPage]();
    }
    if(requestedPage==='kitchen') { const batches=await api(`/api/kds/batches?branchId=${requestedBranch}`); if(!stillCurrent())return; state.data.batches=batches; kitchen(); }

    if(requestedPage==='forecast') { const products=await api('/api/catalog/products'); if(!stillCurrent())return; state.data.forecastProducts=products; state.data.forecast=undefined; state.forecastResultDate=null; state.aiAnalysis={}; forecast(); }
    if(requestedPage==='users'){render('<div id=accounts-root></div>');await mountAccounts(document.querySelector('#accounts-root'),api,state.branches,{userId:state.user.id,signedOut:()=>{signOut();toast('Tài khoản đã thay đổi. Vui lòng đăng nhập lại.');}});}
    if(['customers','tiers','promotions'].includes(requestedPage)){const adminPages=createCustomerAdmin({api:async p=>api(p),branchId:requestedBranch,e,title,table,btn,empty,access});render(await adminPages[requestedPage]());}
    if(requestedPage==='combos'){render('<div id="combo-approval"></div>');await mountComboApproval(document.querySelector('#combo-approval'),api,requestedBranch);}
    if(requestedPage==='pipeline') { const key=`${requestedToken}:${requestedBranch}`; if(!pipelineViews.has(key))pipelineViews.set(key,{}); render('<div id="fp-root"></div>'); await mountFpPipeline(document.querySelector('#fp-root'),api,requestedBranch,pipelineViews.get(key),{ canApproveCombos:access(['ADMIN']), goToCombos:()=>{state.page='combos';shell();loadPage();} }); }
    if(requestedPage==='analytics') { const products=await api('/api/analytics/recipe-cost'); if(!stillCurrent())return; state.data.products=products; analytics(); }


  } catch(err) { if(!stillCurrent())return; if(err.status===401) { signOut(); toast('Phiên đăng nhập đã hết hạn.',true); return; } render(title('KẾT NỐI','Không tải được dữ liệu','Kiểm tra kết nối backend và thử lại.',btn('Thử lại','reload'))+`<div class="error-panel">${e(err.message)}</div>`); }
}
async function workspaceRead(path,page,branch) {
  try { return await api(path); } catch(error) { if(error.status!==404)throw error; }
  const legacy={
    overview:{dashboard:`/api/analytics/dashboard?branchId=${branch}`,orders:`/api/orders?branchId=${branch}`,batches:`/api/kds/batches?branchId=${branch}`},
    orders:{orders:`/api/orders?branchId=${branch}`,products:'/api/catalog/products',tables:`/api/catalog/branches/${branch}/tables`},
    inventory:{ingredients:'/api/inventory/ingredients',plan:`/api/inventory/plan?targetDate=${state.date}&branchId=${branch}`,history:'/api/inventory/history'},
    locations:{branches:'/api/catalog/branches',tables:`/api/catalog/branches/${branch}/tables`,qr:`/api/catalog/branches/${branch}/table-qr`},
    catalog:{categories:'/api/catalog/categories',products:access(['ADMIN'])?'/api/catalog/products/manage':'/api/catalog/products'},
  };
  return Object.fromEntries(await Promise.all(Object.entries(legacy[page]).map(async([key,url])=>[key,await api(url)])));
}
function overview() {
  const {dashboard:d,orders,batches}=state.data;
  render(title('TRUNG TÂM ĐIỀU HÀNH','Tổng quan vận hành','Theo dõi các chỉ số quan trọng trong ngày.',btn('Làm mới','reload','secondary'))+
  `<div class="metric-grid"><div class="metric"><span>DOANH THU HÔM NAY</span><strong>${money(d.todayRevenue)}</strong><small>Từ ${number(d.totalOrdersCount)} đơn đã thanh toán</small><i>↗</i></div><div class="metric"><span>ĐƠN CHỜ THANH TOÁN</span><strong>${orders.filter(o=>o.status==='PENDING').length}</strong><small>Cần xử lý tại quầy</small><i>▤</i></div><div class="metric"><span>MẺ BẾP ĐANG HOẠT ĐỘNG</span><strong>${batches.length}</strong><small>Chờ nấu và đang nấu</small><i>◈</i></div><div class="metric warn"><span>NGUYÊN LIỆU SẮP HẾT</span><strong>${d.lowStockCount}</strong><small>Cần kiểm tra tồn kho</small><i>!</i></div></div>`+
  `<div class="two-col"><section class="panel"><div class="panel-head"><div><h2>Đơn hàng gần đây</h2><p>Hoạt động tại chi nhánh ${state.branch}</p></div>${btn('Xem tất cả →','goto-orders','text')}</div>${orders.length?table(['Mã đơn','Thời gian','Giá trị','Trạng thái'],orders.slice(0,5).map(o=>row([`<span class="order-ref" title="${e(o.orderCode)}">${e(String(o.orderCode).length>18?String(o.orderCode).slice(0,12)+"…":o.orderCode)}</span>`,dateTime(o.createdAt),money(o.finalAmount),badge(o.status)]))):empty('Chưa có đơn hàng','Đơn mới sẽ xuất hiện tại đây.')}</section><section class="panel"><div class="panel-head"><div><h2>Cần chú ý</h2><p>Tồn kho và bất thường vận hành</p></div></div>${d.lowStockItems?.length?d.lowStockItems.slice(0,5).map(i=>`<div class="notice"><span class="notice-icon">!</span><div><strong>${e(i.name)}</strong><small>Còn ${number(i.availableStock??i.currentStock)} ${e(i.unit)} khả dụng · mức tối thiểu ${number(i.minStock)}</small></div></div>`).join(''):empty('Kho đang ổn định','Không có nguyên liệu dưới ngưỡng tối thiểu.')}${d.anomaliesTodayCount?`<div class="notice"><span class="notice-icon">!</span><div><strong>${d.anomaliesTodayCount} cảnh báo bất thường hôm nay</strong><small>Kiểm tra trong mục Dự báo AI</small></div></div>`:''}</section></div>`);
}
function ordersPage() {
  serviceWorkspace?.destroy();
  legacyOrdersPage();
  const page=document.querySelector('#page'), legacy=page.querySelector('.order-layout');
  page.querySelector('.page-head')?.remove();
  const heading=document.createElement('div');
  heading.innerHTML=title('PHỤC VỤ','Phục vụ & thu ngân','Mỗi bàn có một hóa đơn chung. Nhân viên và thu ngân làm việc trên cùng một luồng.');
  page.prepend(heading);
  const workspace=document.createElement('div'); workspace.id='service-workspace'; heading.after(workspace);
  const details=document.createElement('details'); details.className='legacy-order-tools';
  details.innerHTML='<summary>Mang đi và đơn cũ</summary><p>Tạo đơn mang đi hoặc đối soát các đơn trước khi áp dụng phiên bàn.</p>';
  legacy.replaceWith(details);details.append(legacy);
  serviceWorkspace=createServiceWorkspace({root:workspace,request:(path,options)=>api(path,{...options,cache:'no-store'}),branchId:state.branch,role:state.user.role,userId:state.user.id,imageBase:API_BASE,initialData:{tables:state.data.tables,products:state.data.products}});
}
function legacyOrdersPage() {
 const {products,tables}=state.data; const orders=state.data.orders.filter(o=>!o.diningSessionId); const total=state.cart.reduce((s,x)=>s+x.price*x.quantity,0);
 const pending=pendingFor(readQueue(localStorage),state.user.id,state.branch);
 render(title('BÁN HÀNG','Đơn hàng','Tạo đơn, theo dõi và hoàn tất thanh toán tại quầy.',btn('Làm mới','reload','secondary'))+
 `<div class="two-col order-layout"><section class="panel"><div class="panel-head"><div><h2>Tạo đơn mang đi</h2><p>Món chưa có định lượng nguyên liệu sẽ bị tạm khóa.</p></div></div><div class="form-grid">${field('Loại đơn','<select id="table-id"><option value="">Mang đi</option></select>')}${field('Ghi chú món','<input id="item-note" placeholder="Ít cay, không hành…">')}</div>${field('Chọn món',`<select id="product-select"><option value="">Chọn món ăn</option>${products.filter(p=>p.isActive).map(p=>`<option value="${p.id}" ${p.canOrder===false?'disabled':''}>${e(p.name)} · ${money(p.sellingPrice)}${p.canOrder===false?' · '+e(p.availabilityReason):''}</option>`).join('')}</select>`)}<div class="product-picker">${products.filter(p=>p.isActive).map(p=>`<button type="button" class="product-choice" data-action="select-product" data-id="${p.id}" ${p.canOrder===false?'disabled':''}>${productPhoto(p)}<span><strong>${e(p.name)}</strong><small>${money(p.sellingPrice)}${p.canOrder===false?' · '+e(p.availabilityReason):''}</small></span></button>`).join('')}</div><div class="inline-controls">${field('Số lượng','<input id="qty" type="number" min="1" value="1">')}${btn('Thêm vào đơn','add-item','secondary')}</div><div class="cart">${state.cart.length?state.cart.map((item,i)=>`<div class="cart-item"><div><strong>${e(item.name)}</strong><small>${item.quantity} × ${money(item.price)}${item.note?` · ${e(item.note)}`:''}</small></div><span>${money(item.price*item.quantity)}</span><button data-action="remove-item" data-index="${i}" aria-label="Xóa món">×</button></div>`).join(''):empty('Chưa chọn món','Thêm món để tạo đơn hàng.')}</div><div class="cart-total"><span>Tổng thanh toán</span><strong>${money(total)}</strong></div>${btn('Tạo đơn hàng','create-order','primary',state.cart.length?'':'disabled')}</section><section class="panel"><div class="panel-head"><div><h2>Danh sách đơn</h2><p>${orders.length} đơn gần đây</p></div><select id="order-filter"><option value="">Tất cả</option><option value="PENDING">Chờ thanh toán</option><option value="PAID">Đã thanh toán</option></select></div>${pending.length?`<div class="offline-panel"><strong>${pending.length} đơn chờ đồng bộ</strong><p>Đơn đã lưu trên máy này. Kiểm tra trạng thái bàn và giá trước khi đồng bộ.</p>${btn('Đồng bộ đơn','sync-orders','secondary')}${pending.map(o=>`<div class="offline-item"><code>${e(o.id.slice(0,8))}</code> · ${o.items.length} món${o.error?` · <span>${e(o.error)}</span>`:''} ${btn('Xóa','remove-pending','text',`data-id="${e(o.id)}"`)}</div>`).join('')}</div>`:''}<div id="orders-list">${orderCards(orders)}</div></section></div>`);
 document.querySelector('#order-filter').addEventListener('change',ev=>document.querySelector('#orders-list').innerHTML=orderCards(orders.filter(o=>!ev.target.value||o.status===ev.target.value)));
}
function orderCards(orders) { return orders.length?orders.map(o=>`<div class="order-card"><div class="order-top"><div><strong>${`<span class="order-ref" title="${e(o.orderCode)}">${e(String(o.orderCode).length>18?String(o.orderCode).slice(0,12)+"…":o.orderCode)}</span> ${originBadge(o)}`}</strong><small>${dateTime(o.createdAt)} ${o.table?.tableName?'· '+e(o.table.tableName):''}</small></div>${badge(o.status)}</div><div class="order-items">${o.items.map(i=>`${i.quantity} × ${e(i.product?.name || `Món #${i.productId}`)}`).join(' · ')}</div><div class="order-bottom"><strong>${money(o.finalAmount)}</strong>${o.status==='PENDING'&&access(['ADMIN','MANAGER','CASHIER'])?`<div class="pay-controls"><select id="pay-${o.id}"><option value="CASH">Tiền mặt</option><option value="QR_BANKING">VNPay</option><option value="POS_CARD">Thẻ POS</option></select>${btn('Thanh toán','pay','small',`data-id="${e(o.id)}"`)}</div>`:o.status==='PAID'&&access(['ADMIN','MANAGER','CASHIER'])?btn('Xem hóa đơn','receipt','small',`data-id="${e(o.id)}" ${o.diningSessionId?`data-session="${e(o.diningSessionId)}"`:""}`):''}</div></div>`).join(''):empty('Chưa có đơn hàng','Tạo đơn ở biểu mẫu bên trái.'); }
function kitchen() {
  render(title('','Màn hình bếp','Chọn món, bắt đầu nấu và báo làm xong.',btn('Toàn màn hình','kitchen-fullscreen','secondary')+btn('Làm mới','reload','secondary'))+kitchenControls(state.kitchenStatus,state.kitchenStation));
  updateKitchenLive();
}
function updateKitchenLive() {
  const root=document.querySelector('#kds-live');if(!root)return;
  root.innerHTML=kitchenPanel({batches:state.data.batches||[],status:state.kitchenStatus,station:state.kitchenStation,updated:state.kitchenLastUpdated});
}
function inventory() {
  const number=value=>new Intl.NumberFormat('vi-VN',{maximumFractionDigits:3}).format(Number(value)||0);
  const items=state.data.ingredients, plan=state.data.plan;
  const history=(state.data.history||[]).map(log=>{let d={};try{d=JSON.parse(log.details||'{}')}catch{};const i=items.find(i=>i.id===log.entityId);const operation={ADJUST_STOCK:'Cập nhật sau khi đếm',RECEIVE_STOCK:'Nhập hàng',SALE_STOCK:'Trừ khi thanh toán'}[log.action]||log.action;const change=log.action==='ADJUST_STOCK'?`${number(d.before)} → ${number(d.after)} ${e(i?.unit||'')}`:log.action==='RECEIVE_STOCK'?`+${number(d.quantity)} ${e(i?.unit||'')}`:`−${number(Math.abs((d.after||0)-(d.before||0)))} ${e(i?.unit||'')}`;return row([dateTime(log.createdAt),e(i?.name||`Nguyên liệu #${log.entityId}`),e(operation),change,e(d.reason||d.reference||'—')]);});
  const rows=items.map(i=>{const low=Number(i.shortage)>0||Number(i.availableStock)<=Number(i.minStock);return `<tr data-inventory-row data-name="${e(i.name.toLocaleLowerCase('vi'))}" data-low="${low}"><td><strong>${e(i.name)}</strong><small class="cell-sub">${e(i.unit)} · Mức nhắc bổ sung ${number(i.minStock)} ${e(i.unit)}</small></td><td><strong>${number(i.currentStock)} ${e(i.unit)}</strong><small class="cell-sub">Số hàng trong kho trước khi trừ đơn chờ</small></td><td>${low?'<strong>Cần kiểm tra</strong>':'Đủ theo mức đặt'}<small class="cell-sub">Cảnh báo tính cả hàng giữ cho đơn</small></td><td><details><summary>${i.recipes?.length||0} món</summary>${(i.recipes||[]).map(r=>`<div class="inventory-recipe-link"><button class="btn text" data-action="inventory-recipe" data-id="${r.product.id}">${e(r.product.name)}</button><small>${number(r.quantity)} ${e(i.unit)}/suất</small></div>`).join('')}</details></td><td>${access(['ADMIN'])?`<div class="inventory-actions">${btn('Nhập hàng','receive-stock','small',`data-id="${i.id}"`)}${btn('Đếm kho','adjust-stock','small',`data-id="${i.id}"`)}${btn('Thông tin','edit-ingredient','text',`data-id="${i.id}"`)}</div>`:'Chỉ quản trị viên thay đổi kho'}</td></tr>`;});
  const reserved=items.filter(i=>Number(i.committedStock)>0||Number(i.shortage)>0).map(i=>row([`<strong>${e(i.name)}</strong>`,`<strong>${number(i.committedStock)} ${e(i.unit)}</strong>`,`Tồn kho: ${number(i.currentStock)} ${e(i.unit)}`,`<strong>${number(i.availableStock)} ${e(i.unit)}</strong>${i.shortage?`<small class="cell-sub">Thiếu ${number(i.shortage)} ${e(i.unit)}</small>`:''}`,i.shortage?'<span class="stock-status shortage">Thiếu hàng</span>':'<span class="stock-status">Đủ giữ đơn</span>']));
  const planHtml=plan?`<section class="panel space-top"><div class="panel-head"><div><h2>Dự trù cần mua</h2><p>Đây là số lượng gợi ý từ dự báo. Chỉ nhập kho khi hàng đã giao đến.</p></div></div><div class="inventory-toolbar">${field('Ngày dự báo',`<input id="plan-date" type="date" value="${state.date}">`)}${btn('Tính lượng cần mua','plan')} ${btn('Xem dự báo','goto-forecast','secondary')}</div>${plan.length?table(['Nguyên liệu','Nhu cầu dự kiến','Nên mua','Đã nhận',''],plan.map(p=>row([e(p.ingredient.name),`${number(p.grossDemand)} ${e(p.ingredient.unit)}`,`${number(p.suggestedOrderQty)} ${e(p.ingredient.unit)}`,`${number(p.receivedQuantity||0)} ${e(p.ingredient.unit)}`,!p.approvedByUser?btn('Duyệt đề xuất','approve','small',`data-id="${p.id}"`):access(['ADMIN'])&&p.suggestedOrderQty>(p.receivedQuantity||0)?btn('Nhập hàng đã giao','receive-stock','small',`data-id="${p.ingredientId}" data-plan="${p.id}"`):'Đã nhận đủ']))):empty('Chưa có đề xuất','Tính lượng cần mua để xem nguyên liệu nào sắp thiếu.')}</section>`:'';
  render(title('NGUYÊN LIỆU','Kho hiện tại','Kho dùng chung cho các chi nhánh. Số hàng trong kho và số đã giữ cho đơn được theo dõi riêng.',(access(['ADMIN'])?btn('Nhập Excel','open-inventory-import','secondary')+btn('Thêm nguyên liệu','new-ingredient'):'')+btn('Làm mới','reload','secondary'))+
    `<section class="inventory-guide"><div><span class="inventory-step">1</span><div><strong>Hàng mới vừa giao?</strong><p>Chọn <b>Nhập hàng</b> và ghi số lượng vừa nhận. Số này sẽ được cộng vào kho.</p></div></div><div><span class="inventory-step">2</span><div><strong>Đang đếm lại hàng trong kho?</strong><p>Chọn <b>Đếm kho</b> và ghi tổng số đang có. Số này sẽ thay số cũ trên hệ thống.</p></div></div></section>
    <section class="panel inventory-panel"><div class="panel-head"><div><h2>Hàng đang có trong kho</h2><p>${items.length} nguyên liệu · số ở đây chưa trừ phần đơn đang chờ thanh toán.</p></div></div><div class="inventory-toolbar"><label class="field"><span>Tìm nguyên liệu</span><input id="inventory-search" type="search" placeholder="Gõ tên nguyên liệu"></label><label class="field"><span>Hiển thị</span><select id="inventory-filter"><option value="all">Tất cả nguyên liệu</option><option value="low">Cần bổ sung</option></select></label></div>${items.length?`${table(['Nguyên liệu','Tồn trong kho','Mức tồn','Món dùng','Thao tác'],rows)}<p id="inventory-no-results" class="inventory-no-results" hidden>Không tìm thấy nguyên liệu phù hợp.</p>`:empty('Chưa có nguyên liệu','Thêm nguyên liệu rồi dùng Nhập hàng để ghi số lượng nhận được.')}</section>
    <section class="panel space-top"><div class="panel-head"><div><h2>Đã giữ cho đơn chưa thanh toán</h2><p>Đây là phần tồn đang dành cho các món trong đơn chờ. Hàng vẫn nằm trong kho ở bảng trên; thanh toán xong mới bị trừ.</p></div></div>${reserved.length?table(['Nguyên liệu','Đang giữ cho đơn','Tồn trước khi trừ','Còn sau khi giao','Tình trạng'],reserved):empty('Chưa có nguyên liệu giữ cho đơn','Khi có đơn chờ thanh toán, định lượng món sẽ hiện tại đây.')}</section>
    <details class="inventory-advanced"><summary>Tính lượng cần mua theo dự báo</summary><p>Dùng khi cần chuẩn bị hàng cho một ngày bán sắp tới. Phần này không thay đổi tồn kho.</p>${planHtml||`<div class="inventory-toolbar">${field('Ngày dự báo',`<input id="plan-date" type="date" value="${state.date}">`)}${btn('Tính lượng cần mua','plan')} ${btn('Xem dự báo','goto-forecast','secondary')}</div>`}</details>
    <details class="inventory-advanced"><summary>Lịch sử kho gần đây (${history.length} giao dịch)</summary><p>“Nhập hàng” cộng thêm số mới nhận. “Cập nhật sau khi đếm” thay số ghi sổ bằng tổng thực tế.</p>${history.length?table(['Thời gian','Nguyên liệu','Hoạt động','Thay đổi số lượng','Ghi chú'],history):empty('Chưa có giao dịch','Các lần nhập hàng, đếm kho và thanh toán sẽ hiện ở đây.')}</details>`);
  const search=document.querySelector('#inventory-search'),filter=document.querySelector('#inventory-filter'),noResults=document.querySelector('#inventory-no-results');
  const applyFilter=()=>{let visible=0;document.querySelectorAll('[data-inventory-row]').forEach(tr=>{const match=tr.dataset.name.includes(search.value.trim().toLocaleLowerCase('vi'))&&(filter.value!=='low'||tr.dataset.low==='true');tr.hidden=!match;if(match)visible++;});if(noResults)noResults.hidden=visible>0;};
  search?.addEventListener('input',applyFilter);filter?.addEventListener('change',applyFilter);
}
function openInventoryImport() {
  const ingredients=state.data.ingredients||[];
  document.querySelector('.modal-wrap')?.remove();
  const wrap=openModal(`<section class="modal wide inventory-excel-modal"><button class="modal-close" type="button" aria-label="Đóng">×</button><h2>Nhập dữ liệu kho từ Excel</h2><p>Thao tác này cập nhật tồn trong cùng Kho hiện tại. File được kiểm tra trước; nếu có dòng sai thì không ghi dòng nào.</p><ol class="inventory-import-steps"><li><strong>Tải mẫu Excel</strong><span>Mẫu có danh sách ${ingredients.length} nguyên liệu, mã và đơn vị hiện có.</span></li><li><strong>Chọn đúng thao tác</strong><span>Nhập hàng để cộng hàng vừa giao; Đếm kho để thay bằng tổng số thực tế.</span></li><li><strong>Chọn file và xem trước</strong><span>Dòng trống được bỏ qua. Tối đa 500 dòng, file .xlsx không quá 10 MB.</span></li></ol><div class="inventory-template-actions">${btn('Tải mẫu Excel có dữ liệu kho','inventory-template','secondary')}</div><div class="excel-form"><label class="field"><span>Thao tác</span><select id="inventory-import-mode"><option value="RECEIVE">Nhập hàng vừa giao · cộng vào số đang có</option><option value="COUNT">Đếm kho · thay bằng tổng số đang có</option></select></label><label class="field"><span>Chọn file Excel (.xlsx)</span><input id="inventory-excel-file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"></label><p class="form-help">Dùng sheet “Nhap hang” hoặc “Dem kho” tương ứng. Không sửa mã nguyên liệu trong mẫu.</p></div><div id="inventory-excel-preview" aria-live="polite"></div></section>`, {className:'inventory-excel-wrap', label:'Nhập kho từ Excel'});
  const close=()=>closeModal(wrap);wrap.querySelector('.modal-close').onclick=close;
  // Preserve the old rule: a save in flight must not be dismissed.
  wrap.addEventListener('cancel',event=>{if(wrap.querySelector('#inventory-excel-submit:disabled'))event.preventDefault();});

  const modeEl=wrap.querySelector('#inventory-import-mode'),fileEl=wrap.querySelector('#inventory-excel-file'),previewEl=wrap.querySelector('#inventory-excel-preview');
  let excelToolsPromise;
  const loadExcelTools=()=>excelToolsPromise||(excelToolsPromise=import('./inventory-excel.js'));
  let parsed=null, parsedFile=null, parsedMode=null, importId=null, saving=false;
  wrap.querySelectorAll('[data-action="inventory-template"]').forEach(button=>button.addEventListener('click',async()=>{
    try { button.disabled=true;const {buildInventoryTemplate}=await loadExcelTools();const data=await buildInventoryTemplate(ingredients);const blob=new Blob([data],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='Dusko_Mau_Nhap_Kho.xlsx';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000); }
    catch(error){toast(`Không tạo được mẫu Excel: ${error.message}`,true);}finally{button.disabled=false;}
  }));
  const showPreview=async()=>{
    const file=fileEl.files?.[0];if(!file)return;
    parsed=null;parsedFile=file;parsedMode=modeEl.value;importId=crypto.randomUUID();
    previewEl.innerHTML='<p class="excel-loading">Đang đọc và kiểm tra file…</p>';
    try {
      const {parseInventoryWorkbook}=await loadExcelTools();const result=await parseInventoryWorkbook(file,parsedMode,ingredients);parsed=result;
      const action=parsedMode==='RECEIVE'?'cộng thêm vào kho':'ghi đè số hiện tại bằng tổng đã đếm';
      const summary=`<div class="excel-preview-summary ${result.errors.length?'has-errors':''}"><strong>${result.errors.length?'Chưa thể nhập file':`${result.rows.length} dòng sẵn sàng`}</strong><p>${e(file.name)} · ${result.blankRows} dòng trống được bỏ qua. Thao tác sẽ ${action}.</p>${result.rows.length?`<ul>${result.rows.slice(0,8).map(row=>`<li><span>${e(row.name)}</span><strong>${new Intl.NumberFormat('vi-VN',{maximumFractionDigits:3}).format(row.quantity)} ${e(row.unit)}</strong></li>`).join('')}${result.rows.length>8?`<li class="muted">và ${result.rows.length-8} dòng khác</li>`:''}</ul>`:''}${result.errors.length?`<div class="excel-errors"><strong>Sửa các dòng này trong Excel rồi chọn lại file:</strong><ul>${result.errors.slice(0,8).map(error=>`<li>${e(error)}</li>`).join('')}</ul>${result.errors.length>8?`<p>Còn ${result.errors.length-8} lỗi khác.</p>`:''}</div>`:''}</div><button id="inventory-excel-submit" class="btn" ${result.errors.length||!result.rows.length?'disabled':''}>${parsedMode==='RECEIVE'?`Cộng ${result.rows.length} dòng vào kho`:`Cập nhật ${result.rows.length} số đếm`}</button>`;
      previewEl.innerHTML=summary;
      previewEl.querySelector('#inventory-excel-submit')?.addEventListener('click',async event=>{
        if(saving||!parsed||parsed.errors.length)return;
        const mode=parsedMode,rows=parsed.rows.map(({code,quantity,note})=>({code,quantity,note}));
        const accepted=await confirmDialog({title:mode==='RECEIVE'?'Nhập hàng từ Excel?':'Cập nhật tồn theo file đếm?',message:mode==='RECEIVE'?`${rows.length} dòng sẽ được cộng vào tồn hiện tại. Kiểm tra số lượng và phiếu giao trước khi tiếp tục.`:`${rows.length} dòng sẽ thay số tồn hiện tại bằng số đếm trong file. Các dòng trống sẽ được giữ nguyên.`,confirmLabel:mode==='RECEIVE'?'Cộng hàng vào kho':'Cập nhật số đếm',danger:mode==='COUNT'});
        if(!accepted)return;
        saving=true;event.currentTarget.disabled=true;event.currentTarget.textContent='Đang lưu…';
        try {
          const result=await api('/api/inventory/import',{method:'POST',body:{mode,rows,importId}});
          toast(result.alreadyImported?'File này đã được nhập trước đó; không ghi trùng.':`Đã ${mode==='RECEIVE'?'cộng':'cập nhật'} ${result.importedCount} nguyên liệu.`);
          close();
          await loadPage();
        } catch(error) {
          const message=document.createElement('p');message.className='excel-errors';message.textContent=error.message;previewEl.append(message);
          event.currentTarget.disabled=false;event.currentTarget.textContent=mode==='RECEIVE'?`Cộng ${rows.length} dòng vào kho`:`Cập nhật ${rows.length} số đếm`;
        } finally { saving=false; }
      });
    } catch(error) { previewEl.innerHTML=`<p class="excel-errors">${e(error.message)}</p>`; }
  };
  fileEl.addEventListener('change',showPreview);
  modeEl.addEventListener('change',()=>{if(fileEl.files?.[0])showPreview();});
}
function aiDay(offset=0) { return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Bangkok'}).format(new Date(Date.now()+offset*86400000)); }
function aiPanels() {
  const ai=state.aiAnalysis||{}, baskets=ai.baskets, anomaly=ai.anomaly;
  const source=(real,synthetic)=>`${number(real)} đơn thật · ${number(synthetic)} đơn mô phỏng`;
  return `<section id="ai-combos" class="panel ai-section"><header class="ai-section-head"><span class="ai-step">2</span><div><h2>Chọn món để bán kèm và tạo combo</h2><p>Dùng lịch sử gọi món để chọn nhóm món khách thường mua cùng nhau, rồi đặt giá ưu đãi trước khi bán.</p></div></header><div class="forecast-toolbar">${field('Từ ngày',`<input id="basket-from" type="date" value="${ai.from||aiDay(-60)}">`)}${field('Đến ngày',`<input id="basket-to" type="date" value="${ai.to||aiDay(-1)}">`)}${btn('Tìm nhóm món phù hợp','analyze-baskets')}</div><div class="ai-output" aria-live="polite">${ai.basketError?`<p class="error-panel">${e(ai.basketError)}</p>`:baskets?`<p class="ai-source">${number(baskets.transactions)} hóa đơn · ${source(baskets.realOrders,baskets.syntheticOrders)}<br>Khoảng phân tích: ${e(baskets.from)} → ${e(baskets.to)}</p>${baskets.rules.length?`<div class="ai-rule-list">${baskets.rules.map(rule=>`<article class="ai-rule"><div><strong>${rule.antecedents.map(e).join(' + ')}</strong><span class="ai-rule-arrow">→ Gợi ý thêm</span><strong>${rule.consequents.map(e).join(' + ')}</strong></div><p>${number(rule.confidence*100)}% hóa đơn có nhóm món đầu cũng có món gợi ý.</p><details><summary>Căn cứ gợi ý</summary><p>Xuất hiện trong ${number(rule.support*100)}% hóa đơn; mức kết hợp cao gấp ${number(rule.lift)} lần so với mua độc lập.</p></details></article>`).join('')}</div><div class="ai-decision"><strong>Bước tiếp theo: chọn giá combo để bán</strong><p>Tạo bộ dữ liệu từ đúng khoảng ngày đang phân tích. Sau đó quản trị viên chọn giá ưu đãi và duyệt combo; khách chỉ thấy combo đã được duyệt.</p>${btn(access(['ADMIN'])?'Chuẩn bị combo để duyệt giá':'Chuẩn bị dữ liệu đề xuất combo','ai-prepare-combos')}</div>`:'<p>Chưa có nhóm món đạt ngưỡng trong khoảng ngày này.</p>'}<details class="ai-method"><summary>Cách tìm nhóm món</summary><p>FP-Growth, support ≥ 5%, confidence ≥ 30%, lift ≥ 1,2. Hiển thị tối đa 6 cặp món. Gợi ý chưa tự tạo hoặc công bố combo.</p></details>`:'<p class="ai-idle">Chọn khoảng ngày có hóa đơn đã thanh toán. Kết quả giúp chọn món bán kèm; giá ưu đãi được quyết định ở bước duyệt combo.</p>'}</div></section>
  <section id="ai-review" class="panel ai-section"><header class="ai-section-head"><span class="ai-step">3</span><div><h2>Rà soát ngày có biến động bán hàng</h2><p>Tìm ngày cần kiểm tra lại hóa đơn và giảm giá, để quản lý giải thích biến động doanh thu hoặc số đơn.</p></div></header><div class="forecast-toolbar">${field('Ngày đã hoàn tất',`<input id="ai-anomaly-date" type="date" max="${aiDay(-1)}" value="${ai.anomalyDate||aiDay(-1)}">`)}${btn('Kiểm tra ngày bán','check-ai-day')}</div><div class="ai-output" aria-live="polite">${ai.anomalyError?`<p class="error-panel">${e(ai.anomalyError)}</p><p class="ai-idle">Bạn vẫn có thể đối chiếu hóa đơn của ngày đã chọn. Khi đủ dữ liệu, quản trị viên có thể cập nhật mô hình để hỗ trợ kiểm tra biến động.</p>${btn('Xem hóa đơn ngày đã chọn','ai-review-day','secondary')}`:anomaly?`<div class="ai-verdict ${anomaly.isAnomaly?'is-warning':''}"><strong>${anomaly.isAnomaly?'Ngày bán cần kiểm tra':'Chưa phát hiện bất thường'}</strong><p>Ngày ${e(ai.checkedDate)} · ${number(anomaly.observedOrders)} đơn đã thanh toán.</p><p>${anomaly.isAnomaly?'Đối chiếu hóa đơn, giảm giá và sự kiện trong ngày để giải thích biến động.':'Mức sai lệch không vượt ngưỡng của mô hình hiện tại.'}</p></div><div class="ai-next-actions">${btn('Đối chiếu hóa đơn ngày này','ai-review-day')}</div><p class="ai-source">${source(anomaly.realOrders,anomaly.syntheticOrders)}</p><details class="ai-method"><summary>Thông tin mô hình</summary><p>Autoencoder · Sai số ${Number(anomaly.mseLoss).toFixed(6)} · Ngưỡng ${Number(anomaly.threshold).toFixed(6)}. Cảnh báo không phải kết luận sai phạm.</p></details>`:'<p class="ai-idle">Chọn ngày đã kết thúc. Nếu có cảnh báo, mở danh sách hóa đơn của chính ngày đó để đối chiếu.</p>'}</div>${access(['ADMIN'])?`<details class="ai-model-settings"><summary>Quản trị mô hình và điều kiện dữ liệu</summary><div class="ai-model-update"><div><strong>Cập nhật mô hình kiểm tra biến động</strong><p>Học lại khi có thêm lịch sử bán hàng; cần ít nhất 30 ngày có đơn đã thanh toán. Dữ liệu học hiện gồm cả đơn thật và đơn mô phỏng trong database.</p>${ai.trained?`<p>Huấn luyện: ${number(ai.trained.trainingDays)} ngày · Chọn ngưỡng: ${number(ai.trained.calibrationDays)} ngày · Kiểm tra độc lập: ${number(ai.trained.testDays)} ngày.</p>`:''}</div>${btn('Cập nhật mô hình','update-ai-model','secondary')}</div></details>`:''}</section>`;
}
function captureAiInputs() {
  state.aiAnalysis ||= {};
  for(const [id,key] of [['basket-from','from'],['basket-to','to'],['ai-anomaly-date','anomalyDate']]) {
    const element=document.getElementById(id); if(element) state.aiAnalysis[key]=element.value;
  }
  const date=document.getElementById('forecast-date');if(date)state.date=date.value;
}
function forecast() {
  if(state.aiAnalysis?.branchId!==state.branch)state.aiAnalysis={branchId:state.branch};
  const results=state.forecastResultBranch===state.branch?state.data.forecast:undefined;
  const products=state.data.forecastProducts||[];
  const dishes=results?[...results].sort((a,b)=>b.predictedQuantity-a.predictedQuantity):[];
  const summary=forecastSummary(dishes);
  const dateLabel=state.forecastResultDate?new Intl.DateTimeFormat('vi-VN',{dateStyle:'long'}).format(new Date(`${state.forecastResultDate}T12:00:00+07:00`)):'';
  const content=dishes.length
    ? `<div class="forecast-result-heading"><div><h2>Nhu cầu dự kiến để lên kế hoạch</h2><p>Dự kiến cho ${e(dateLabel)}</p></div><span>${dishes.length} món</span></div><div class="forecast-results">${dishes.map(r=>{
        const product=r.product||products.find(p=>p.id===r.productId)||{name:`Món ${r.productId}`};
        return `<article class="forecast-dish">${productPhoto(product)}<div class="forecast-dish-name"><strong>${e(product.name)}</strong><span>${r.modelType==='LSTM'?'Theo mô hình đã học':'Theo trung bình lịch sử'}</span></div><div class="forecast-quantity"><b>${number(r.predictedQuantity)}</b><span>suất</span></div></article>`;
      }).join('')}</div><div class="ai-summary"><span><b>${number(summary.portions)}</b> suất dự kiến / ${summary.dishes} món</span><span>${summary.learned} món dùng mô hình · ${summary.historical} món dùng lịch sử</span></div><div class="ai-decision"><strong>Bước tiếp theo: tính nguyên liệu cần mua</strong><p>Dùng định lượng món và tồn kho để lập dự trù cho ${e(dateLabel)}. Sau đó xem xét tại Kho hiện tại; bước này chưa nhập hàng vào kho.</p>${btn('Lập dự trù nguyên liệu','ai-plan')}</div><p class="forecast-help">Kiểm tra thêm đặt bàn, sự kiện và khả năng phục vụ trước khi chốt lượng chuẩn bị. Món chưa có lịch sử không nằm trong kết quả này.</p>`
    : `<div class="forecast-placeholder"><h2>${results?'Chưa đủ dữ liệu bán hàng':'Bạn cần chuẩn bị cho ngày nào?'}</h2><p>${results?'Không có lịch sử bán hàng phù hợp để tính dự báo cho ngày đã chọn.':'Chọn ngày cần phục vụ để ước tính số suất, sau đó tính nguyên liệu cần mua cho ngày đó.'}</p></div>`;
  render(title('HỖ TRỢ QUẢN LÝ NHÀ HÀNG','Lập kế hoạch từ dữ liệu bán hàng','Chọn việc cần làm, xem căn cứ và chuyển kết quả thành bước xử lý cụ thể.')+`<nav class="ai-purpose-nav" aria-label="Công việc cần thực hiện"><a href="#ai-prepare"><b>1. Chuẩn bị cho ngày tới</b><span>Ước tính món → dự trù nguyên liệu</span></a><a href="#ai-combos"><b>2. Xây dựng combo bán hàng</b><span>Tìm nhóm món → duyệt giá ưu đãi</span></a><a href="#ai-review"><b>3. Kiểm tra hoạt động đã bán</b><span>Phát hiện biến động → đối chiếu hóa đơn</span></a></nav><p class="ai-data-notice">Phạm vi: chi nhánh đang chọn, hóa đơn đã thanh toán. Dữ liệu hiện gồm cả đơn thật và đơn mô phỏng; cần kiểm tra nguồn trước khi quyết định.</p>`+
    `<section id="ai-prepare" class="panel forecast-controls"><header class="ai-section-head"><span class="ai-step">1</span><div><h2>Chuẩn bị món và nguyên liệu cho ngày tới</h2><p>Ước tính nhu cầu từng món để bếp chuẩn bị đủ và kho có căn cứ dự trù mua hàng.</p></div></header><div class="forecast-toolbar">${field('Ngày cần chuẩn bị',`<input type="date" id="forecast-date" value="${state.date}">`)}${btn('Ước tính nhu cầu món','run-forecast')}</div></section><section class="panel forecast-main" aria-live="polite">${content}</section>`+aiPanels());
}

function analytics() {
  const products=state.data.products, today=new Date(), pad=n=>String(n).padStart(2,'0');
  const to=`${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`;
  const from=`${today.getFullYear()}-${pad(today.getMonth()+1)}-01`;
  render(title('PHÂN TÍCH KINH DOANH','Hiệu quả thực đơn','Theo dõi doanh thu đã thanh toán và hiệu quả giá vốn.',btn('Làm mới','reload','secondary'))+
  `<section class="panel revenue-export"><div class="panel-head"><div><h2>Xuất báo cáo doanh thu</h2><p>File Excel tách riêng giao dịch thật và dữ liệu giả lập, có ghi chú rõ nguồn số liệu.</p></div></div><div class="inventory-toolbar">${field('Từ ngày',`<input id="revenue-from" type="date" value="${from}">`)}${field('Đến ngày',`<input id="revenue-to" type="date" value="${to}">`)}${btn('Xuất file Excel','export-revenue','primary')}</div></section>`+
  `<div class="metric-grid two-metrics"><div class="metric"><span>SỐ MÓN ĐANG PHÂN TÍCH</span><strong>${products.length}</strong><small>Toàn bộ thực đơn</small><i>▤</i></div><div class="metric warn"><span>MÓN CÓ GIÁ VỐN CAO</span><strong>${products.filter(p=>p.isHighFoodCost).length}</strong><small>Giá vốn trên 35% giá bán</small><i>!</i></div></div><section class="panel">${products.length?table(['Món ăn','Giá bán','Giá vốn','Lợi nhuận gộp','Tỷ lệ giá vốn'],products.map(p=>row([`<strong>${e(p.productName)}</strong>`,money(p.sellingPrice),p.costPrice===null?'Chưa nhập giá vốn':money(p.costPrice),p.grossProfit===null?'—':money(p.grossProfit),p.foodCostRatioPct===null?'—':`<span class="ratio ${p.isHighFoodCost?'high':''}">${number(p.foodCostRatioPct)}%</span>`]))):empty('Chưa có dữ liệu món','Nhập sản phẩm trong backend để xem phân tích.')}</section>`);
}

async function exportRevenue() {
  const from=document.querySelector('#revenue-from')?.value, to=document.querySelector('#revenue-to')?.value;
  if(!from||!to||from>to) return toast('Chọn khoảng ngày hợp lệ.',true);
  const report=await perform(()=>api(`/api/analytics/revenue-report?branchId=${state.branch}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`));
  if(!report) return;
  const { default: ExcelJS }=await import('exceljs');
  const workbook=new ExcelJS.Workbook(); workbook.creator='Dusko Restaurant'; workbook.created=new Date();
  const summary=workbook.addWorksheet('Tổng hợp');
  summary.addRows([
    ['BÁO CÁO DOANH THU'],['Lưu ý','Phần giả lập là dữ liệu tạo để kiểm thử, không phải doanh thu thực.'],
    ['Chi nhánh',report.branch.name],['Từ ngày',report.from],['Đến ngày',report.to],
    ['Số đơn thật',report.real.orderCount],['Doanh thu thật',report.real.netRevenue],
    ['Số đơn giả lập',report.synthetic.orderCount],['Giá trị giả lập (không phải doanh thu thật)',report.synthetic.netRevenue],
    ['Tổng đơn',report.orderCount],['Tổng trước giảm giá',report.grossRevenue],
    ['Tổng giảm giá',report.discountTotal],['Tổng cộng gồm giả lập',report.netRevenue],
  ]);
  summary.getColumn(1).width=42; summary.getColumn(2).width=62; summary.getRow(1).font={bold:true,size:14};
  for(const rowNum of [7,9,11,12,13]) summary.getCell(`B${rowNum}`).numFmt='#,##0 [$₫-vi-VN]';
  const detail=workbook.addWorksheet('Chi tiết đơn');
  detail.columns=[
    {header:'STT',key:'no',width:8},{header:'Mã đơn',key:'code',width:24},{header:'Nguồn dữ liệu',key:'origin',width:19},{header:'Thời gian tạo đơn',key:'createdAt',width:23},
    {header:'Phương thức',key:'payment',width:20},{header:'Trước giảm giá',key:'gross',width:20},
    {header:'Giảm giá',key:'discount',width:18},{header:'Doanh thu thuần',key:'net',width:20},{header:'Món trong đơn',key:'items',width:56},
  ];
  for(const [index,order] of report.orders.entries()) detail.addRow({no:index+1,code:order.orderCode,origin:order.dataOrigin==='SYNTHETIC'?'Giả lập':'Thật',createdAt:new Date(order.createdAt),payment:({CASH:'Tiền mặt',QR_BANKING:'Chuyển khoản',POS_CARD:'Thẻ'}[order.paymentMethod]||'—'),gross:order.totalAmount,discount:order.discountAmount,net:order.finalAmount,items:order.items.map(item=>`${item.product.name} × ${item.quantity}`).join(', ')});
  detail.getRow(1).font={bold:true}; detail.getRow(1).alignment={vertical:'middle',wrapText:true}; detail.views=[{state:'frozen',ySplit:1}]; detail.autoFilter={from:'A1',to:'I1'};
  detail.getColumn('createdAt').numFmt='dd/mm/yyyy hh:mm'; for(const col of ['gross','discount','net']) detail.getColumn(col).numFmt='#,##0 [$₫-vi-VN]';
  const buffer=await workbook.xlsx.writeBuffer(), blob=new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}), url=URL.createObjectURL(blob), link=document.createElement('a');
  link.href=url; link.download=`bao-cao-doanh-thu-${state.branch}-${from}-${to}.xlsx`; link.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  toast(`Đã xuất ${report.real.orderCount} đơn thật và ${report.synthetic.orderCount} đơn giả lập.`);
}

function locations() { render(title('THIẾT LẬP','Chi nhánh, bàn và QR','Quản lý khu vực phục vụ, trạng thái bàn và mã QR cố định.',btn('Làm mới','reload','secondary')) + locationsHtml({branches:access(['ADMIN'])?state.data.branches:state.data.branches.filter(b=>b.id===state.branch),tables:state.data.tables,qr:state.data.qr||[],branchId:state.branch,admin:access(['ADMIN']),canManageQr:access(['ADMIN','MANAGER'])})); }
function catalog() { render(title('THỰC ĐƠN','Món & nhóm món','Danh mục phục vụ bán hàng và chế biến.',btn('Làm mới','reload','secondary')) + catalogHtml({categories:state.data.categories,products:state.data.products,admin:access(['ADMIN']),chef:access(['ADMIN','MANAGER','CHEF'])})); const search=document.querySelector('#catalog-search'),filter=document.querySelector('#catalog-filter');const apply=()=>{let shown=0;document.querySelectorAll('[data-catalog-name]').forEach(row=>{row.hidden=!row.dataset.catalogName.includes(search.value.trim().toLowerCase())||(filter.value!=='all'&&row.dataset.catalogStatus!==filter.value);if(!row.hidden)shown++;});document.querySelector('#catalog-empty').hidden=shown>0;};search.oninput=apply;filter.onchange=apply; }

function formModal(heading, fields, submit, {description='',submitLabel='Lưu'}={}) {
  document.querySelector('.modal-wrap')?.remove();
  const wrap=openModal(`<div class="modal wide"><button class="modal-close" type="button" aria-label="Đóng">×</button><h2>${e(heading)}</h2>${description?`<p class="form-help">${e(description)}</p>`:''}<form class="manage-form">${fields.map(f=>`<label class="${f.type==='checkbox'?'check-field':''}"><span>${e(f.label)}</span>${f.type==='checkbox'?`<input name="${f.key}" type="checkbox" ${f.value?'checked':''}>`:f.options?`<select name="${f.key}">${f.options.map(o=>`<option value="${e(o.value)}" ${String(o.value)===String(f.value)?'selected':''}>${e(o.label)}</option>`).join('')}</select>`:`<input name="${f.key}" type="${f.type||'text'}" ${f.type==='file'?'accept="image/jpeg,image/png,image/webp"':`value="${e(f.value??'')}"`} ${f.required?'required':''} ${f.min!==undefined?`min="${f.min}"`:''} ${f.step?`step="${f.step}"`:''}>`}</label>`).join('')}<p class="form-error" role="alert" hidden></p><button type="submit" class="btn">${e(submitLabel)}</button></form></div>`, {label:e(heading)});
  wrap.querySelector('.modal-close').onclick=()=>closeModal(wrap);
  // Preserve the old rule: a save in flight must not be dismissed.
  wrap.addEventListener('cancel',event=>{if(wrap.querySelector('button[type=submit]')?.disabled)event.preventDefault();});
  wrap.querySelector('form').onsubmit=async ev=>{ev.preventDefault(); const form=ev.currentTarget, values=Object.fromEntries(new FormData(form)); form.querySelector('button[type="submit"]').disabled=true; try { const result=await submit(values); if(result!==null) { closeModal(wrap); toast('Đã lưu thay đổi.'); if(state.page==='locations') {state.branches=await api('/api/catalog/branches'); shell();} await loadPage(); } } catch(err) { const error=form.querySelector('.form-error');error.textContent=err.message;error.hidden=false;error.scrollIntoView({block:'nearest'}); } finally {form.querySelector('button[type="submit"]').disabled=false;} };
}
const f=(key,label,value='',more={})=>({key,label,value,...more});
const textValue=(value,label)=>{const s=String(value||'').trim(); if(!s) throw new Error(`${label} không được để trống.`); return s;};
const branchFields=b=>[...(b?[]:[f('code','Mã chi nhánh','',{required:true})]),f('name','Tên chi nhánh',b?.name,{required:true}),f('address','Địa chỉ',b?.address),f('phone','Điện thoại',b?.phone)];
const tableFields=t=>[f('tableName','Tên bàn',t?.tableName,{required:true}),f('seatingCapacity','Sức chứa',t?.seatingCapacity||2,{type:'number',min:1,required:true}),...(t?[f('status','Trạng thái',t.status,{options:[{value:'EMPTY',label:'Trống'},{value:'SERVING',label:'Đang phục vụ'},{value:'RESERVED',label:'Đã đặt'}]})]:[])];
const categoryFields=c=>[...(c?[]:[f('code','Mã nhóm','',{required:true})]),f('name','Tên nhóm',c?.name,{required:true})];
const stationOptions=[['WOK_STATION','Bếp xào'],['STEAM_STATION','Bếp hấp'],['FRY_STATION','Bếp chiên'],['BAR_STATION','Quầy đồ uống'],['COLD_DISH','Món nguội']].map(([value,label])=>({value,label}));
const productFields=p=>[...(p?[]:[f('code','Mã món','',{required:true})]),f('name','Tên món',p?.name,{required:true}),f('image','Chọn ảnh món (JPG, PNG, WebP; tối đa 5 MB)','',{type:'file',required:!p}),...(p?[]:[f('categoryId','Nhóm món',state.data.categories[0]?.id,{options:state.data.categories.map(c=>({value:c.id,label:c.name}))})]),f('sellingPrice','Giá bán',p?.sellingPrice??0,{type:'number',min:0,step:'any',required:true}),f('costPrice','Giá vốn tham khảo (tùy chọn)',p?.costPrice??'',{type:'number',min:0,step:'any'}),f('stationType','Trạm bếp',p?.stationType||stationOptions[0].value,{options:stationOptions}),f('prepTimeMinutes','Thời gian chế biến (phút)',p?.prepTimeMinutes||10,{type:'number',min:1,required:true}),f('requiresPreparation','Bếp chế biến món này (bỏ chọn với nước đóng chai, tráng miệng phục vụ ngay)',p?.requiresPreparation??true,{type:'checkbox'})];
const ingredientFields=i=>[...(i?[]:[f('code','Mã nguyên liệu','',{required:true})]),f('name','Tên nguyên liệu',i?.name,{required:true}),f('unit','Đơn vị tính',i?.unit||'kg',{required:true}),f('minStock','Nhắc bổ sung khi còn dưới',i?.minStock??0,{type:'number',min:0,step:'any',required:true}),f('safetyStock','Mức dự phòng',i?.safetyStock??0,{type:'number',min:0,step:'any',required:true}),f('shelfLifeDays','Hạn dùng bảo quản (ngày)',i?.shelfLifeDays??0,{type:'number',min:0,required:true})];

async function openRecipe(product) {
  const [recipe,ingredients]=await Promise.all([api(`/api/catalog/products/${product.id}/recipe`),api('/api/inventory/ingredients')]);
  const editable=access(['ADMIN']);
  const options='<option value="">Chọn nguyên liệu</option>'+ingredients.map(i=>`<option value="${i.id}">${e(i.name)} (${e(i.unit)})</option>`).join('');
  const recipeRow=r=>`<div class="recipe-row"><label>Nguyên liệu<select class="recipe-ingredient" ${editable?'':'disabled'}>${options}</select></label><label>Lượng cho 1 suất<input class="recipe-quantity" type="number" min="0.001" step="any" placeholder="Nhập định lượng" value="${e(r?.quantity??'')}" ${editable?'':'disabled'}></label><label>Hao hụt (%)<input class="recipe-waste" type="number" min="0" max="99.9" step="any" value="${e(r?Number((r.wasteRate*100).toFixed(6)):0)}" ${editable?'':'disabled'}></label>${editable?'<button type="button" class="btn text recipe-remove">Xóa</button>':''}<small class="recipe-preview"></small></div>`;
  const wrap=openModal(`<div class="modal wide"><button class="modal-close" type="button" aria-label="Đóng">×</button><h2>Định lượng · ${e(product.name)}</h2><p class="form-help">Nhập lượng nguyên liệu cho <strong>1 suất</strong>, theo đúng đơn vị kho. Hao hụt nhập theo phần trăm, ví dụ 5 nghĩa là 5%. Món bán nguyên chai/lon cũng cần khai báo lượng hàng tương ứng.</p>${!ingredients.length?'<p>Chưa có nguyên liệu. Thêm nguyên liệu trong Kho trước khi cấu hình món.</p>':''}<div id="recipe-rows">${recipe.length?recipe.map(recipeRow).join(''):ingredients.length?recipeRow(null):''}</div><p class="form-error" role="alert" hidden></p>${editable&&ingredients.length?`${btn('Thêm nguyên liệu','recipe-add','secondary')} ${btn('Lưu định lượng','recipe-save')}`:''}</div>`, {label:`Định lượng ${product.name}`});
  wrap.querySelectorAll('.recipe-ingredient').forEach((select,index)=>select.value=String(recipe[index]?.ingredientId||''));
  const preview=()=>wrap.querySelectorAll('.recipe-row').forEach(row=>{const i=ingredients.find(i=>i.id===Number(row.querySelector('select').value));const q=Number(row.querySelector('.recipe-quantity').value),w=Number(row.querySelector('.recipe-waste').value);row.querySelector('.recipe-preview').textContent=i&&q>0&&w>=0&&w<100?`Kho cần ${(q/(1-w/100)).toLocaleString('vi-VN',{maximumFractionDigits:3})} ${i.unit} cho mỗi suất, đã tính hao hụt.`:'Chọn nguyên liệu và nhập định lượng thực tế.';});preview();wrap.oninput=preview;wrap.onchange=preview;
  wrap.onclick=async ev=>{
    if(ev.target===wrap||ev.target.closest('.modal-close')){closeModal(wrap);return;}
    if(ev.target.closest('.recipe-remove')){ev.target.closest('.recipe-row').remove();return;}
    if(ev.target.closest('[data-action="recipe-add"]')){wrap.querySelector('#recipe-rows').insertAdjacentHTML('beforeend',recipeRow(null));preview();return;}
    const save=ev.target.closest('[data-action="recipe-save"]');if(!save||save.disabled)return;save.disabled=true;
    try{const items=recipeEntries([...wrap.querySelectorAll('.recipe-row')].map(row=>({ingredientId:row.querySelector('select').value,quantity:row.querySelector('.recipe-quantity').value,wasteRate:Number(row.querySelector('.recipe-waste').value)/100})));await api(`/api/catalog/products/${product.id}/recipe`,{method:'PUT',body:{items}});closeModal(wrap);toast('Đã lưu định lượng. Thực đơn và kho đã được cập nhật.');await loadPage();}
    catch(err){const error=wrap.querySelector('.form-error');error.textContent=err.message;error.hidden=false;}finally{save.disabled=false;}
  };
}

async function onClick(ev) {
  const target=ev.target.closest('[data-action]'); if(!target||target.disabled||state.loading) return;
  const action=target.dataset.action, id=target.dataset.id;
  if(action==='new-branch'||action==='edit-branch') { if(!access(['ADMIN'])) return; const branch=state.data.branches.find(b=>b.id===Number(id)); formModal(branch?'Sửa chi nhánh':'Thêm chi nhánh',branchFields(branch),async v=>{const body={name:textValue(v.name,'Tên chi nhánh'),address:v.address,phone:v.phone,...(branch?{}:{code:textValue(v.code,'Mã chi nhánh')})};return api(branch?`/api/catalog/branches/${branch.id}`:'/api/catalog/branches',{method:branch?'PATCH':'POST',body});});return; }
  if(action==='new-table'||action==='edit-table') { if(!access(['ADMIN','MANAGER'])) return; const item=state.data.tables.find(t=>t.id===Number(id)); formModal(item?'Sửa bàn':'Thêm bàn',tableFields(item),async v=>api(item?`/api/catalog/branches/${state.branch}/tables/${item.id}`:`/api/catalog/branches/${state.branch}/tables`,{method:item?'PATCH':'POST',body:{tableName:textValue(v.tableName,'Tên bàn'),seatingCapacity:numberField(v.seatingCapacity,'Sức chứa',1),...(item?{status:v.status}:{})}}));return; }
  if(action==='new-category'||action==='edit-category') { if(!access(['ADMIN'])) return; const item=state.data.categories.find(c=>c.id===Number(id)); formModal(item?'Sửa nhóm món':'Thêm nhóm món',categoryFields(item),async v=>api(item?`/api/catalog/categories/${item.id}`:'/api/catalog/categories',{method:item?'PATCH':'POST',body:{name:textValue(v.name,'Tên nhóm'),...(item?{}:{code:textValue(v.code,'Mã nhóm')})}}));return; }
  if(action==='new-product'||action==='edit-product') { if(!access(['ADMIN'])) return; const item=state.data.products.find(p=>p.id===Number(id)); if(!item&&!state.data.categories.length) return toast('Hãy tạo nhóm món trước.',true); formModal(item?'Sửa món':'Thêm món',productFields(item),async v=>{const file=v.image; if(file?.size && (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size>5*1024*1024)) throw new Error('Chỉ chọn ảnh JPG, PNG hoặc WebP tối đa 5 MB.'); const saved=await api(item?`/api/catalog/products/${item.id}`:'/api/catalog/products',{method:item?'PATCH':'POST',body:{name:textValue(v.name,'Tên món'),sellingPrice:numberField(v.sellingPrice,'Giá bán',0,'any'),costPrice:v.costPrice===''?null:numberField(v.costPrice,'Giá vốn',0,'any'),stationType:v.stationType,prepTimeMinutes:numberField(v.prepTimeMinutes,'Thời gian chế biến',1),requiresPreparation:v.requiresPreparation==='on',...(item?{}:{code:textValue(v.code,'Mã món'),categoryId:numberField(v.categoryId,'Nhóm món',1)})}}); if(file?.size) await uploadProductImage(saved.id,file,state.token); return saved; });return; }
  if(action==='inventory-recipe') {await perform(async()=>{const products=await api('/api/catalog/products');const product=products.find(p=>p.id===Number(id));if(!product)throw Error('Món đã ngừng bán. Mở Thực đơn để quản lý.');await openRecipe(product);});return;}
  if(action==='recipe') { if(!access(['ADMIN','MANAGER','CHEF'])) return; const item=state.data.products.find(p=>p.id===Number(id)); if(item) await perform(()=>openRecipe(item));return; }
  if(action==='toggle-product') { if(!access(['ADMIN'])) return; const item=state.data.products.find(p=>p.id===Number(id)); if(!item||!await confirmDialog({title:item.isActive?'Ngừng bán món?':'Bán lại món?',message:item.isActive?'Món sẽ không còn xuất hiện trong thực đơn đặt món. Các đơn đã nhận không bị thay đổi.':'Món sẽ xuất hiện lại nếu còn đủ nguyên liệu và đã có định lượng.',confirmLabel:item.isActive?'Ngừng bán':'Bán lại',danger:item.isActive})) return; const result=await perform(()=>api(`/api/catalog/products/${id}`,{method:'PATCH',body:{isActive:!item.isActive}}),item.isActive?'Đã ngừng bán món.':'Đã bán lại món.'); if(result) loadPage(); return; }
  if(action==='new-ingredient'||action==='edit-ingredient') { if(!access(['ADMIN'])) return; const item=state.data.ingredients.find(i=>i.id===Number(id)); formModal(item?'Thông tin nguyên liệu':'Thêm nguyên liệu',ingredientFields(item),async v=>api(item?`/api/inventory/ingredients/${item.id}/details`:'/api/inventory/ingredients',{method:item?'PATCH':'POST',body:{name:textValue(v.name,'Tên nguyên liệu'),unit:textValue(v.unit,'Đơn vị'),minStock:numberField(v.minStock,'Mức nhắc bổ sung',0,'any'),safetyStock:numberField(v.safetyStock,'Mức dự phòng',0,'any'),shelfLifeDays:numberField(v.shelfLifeDays,'Hạn dùng',0),...(item?{}:{code:textValue(v.code,'Mã nguyên liệu'),currentStock:0})}}),{description:item?'Thay đổi tên, đơn vị hoặc mức nhắc bổ sung. Muốn ghi số hàng vừa nhận, dùng Nhập hàng; muốn sửa số theo lượng đếm thực tế, dùng Đếm kho.':'Tạo tên nguyên liệu trước. Sau đó dùng Nhập hàng để cộng số vừa nhận hoặc Đếm kho để nhập tổng số thực tế.'});return; }
  if(action==='reload') { invalidateReads(); document.querySelector('#data-refresh-notice')?.remove(); return state.page==='kitchen'?refreshKitchen():loadPage(); }
  if(action==='export-revenue') return exportRevenue();
  if(action==='open-inventory-import') { if(!access(['ADMIN']))return; openInventoryImport(); return; }
  if(action==='kitchen-fullscreen') { const root=document.querySelector('.main'); if(!document.fullscreenElement) await root?.requestFullscreen?.(); else await document.exitFullscreen?.(); return; }
  if(action==='qr-view') { const result=await perform(()=>api(`/api/catalog/branches/${state.branch}/tables/${id}/qr`)); if(result) showQrPreview(result); return; }
  if(action==='qr-create'||action==='qr-reissue') { if(!access(['ADMIN','MANAGER'])) return; if(action==='qr-reissue'&&!await confirmDialog({title:'Cấp mã QR mới?',message:'Mã QR đang in sẽ hết hiệu lực ngay sau khi cấp mã mới. Hãy in và thay mã tại bàn.',confirmLabel:'Cấp mã mới',danger:true})) return; const result=await perform(()=>api(`/api/catalog/branches/${state.branch}/tables/${id}/qr${action==='qr-reissue'?'/reissue':''}`,{method:'POST'}),action==='qr-reissue'?'Đã cấp lại QR.':'Đã tạo mã QR cố định.'); if(result){showQrPreview(result);loadPage();} return; }
  if(action==='qr-revoke') { if(!access(['ADMIN','MANAGER'])||!await confirmDialog({title:'Khóa mã QR?',message:'Khách sẽ không thể mở thực đơn từ mã QR hiện tại. Bạn có thể cấp mã mới sau đó.',confirmLabel:'Khóa QR',danger:true})) return; const result=await perform(()=>api(`/api/catalog/branches/${state.branch}/tables/${id}/qr`,{method:'DELETE'}),'Đã khóa QR.'); if(result) loadPage(); return; }
  if(action==='goto-orders') { state.page='orders'; shell(); return loadPage(); }
  if(action==='select-product') { const select=document.querySelector('#product-select'); if(select) select.value=id; document.querySelectorAll('.product-choice').forEach(card=>card.classList.toggle('selected',card.dataset.id===id)); return; }
  if(action==='add-item') { const id=Number(document.querySelector('#product-select').value), qty=Number(document.querySelector('#qty').value), p=state.data.products.find(x=>x.id===id && x.isActive); if(!p||p.canOrder===false||!Number.isInteger(qty)||qty<1) return toast('Chọn món và số lượng hợp lệ.',true); const note=document.querySelector('#item-note').value.trim(); state.tableId=document.querySelector('#table-id').value; state.cart.push({productId:id,name:p.name,price:p.sellingPrice,quantity:qty,note}); return ordersPage(); }
  if(action==='remove-item') { state.cart.splice(Number(target.dataset.index),1); return ordersPage(); }
  if(action==='create-order') { if(!state.cart.length) return; const tableId=Number(document.querySelector('#table-id').value)||undefined; const order={id:crypto.randomUUID(),userId:state.user.id,branchId:state.branch,...(tableId?{tableId}:{}),items:state.cart.map(({productId,price,quantity,note})=>({productId,price,quantity,note}))}; busy(true); try { if(navigator.onLine===false) throw new TypeError('Mất kết nối'); await api('/api/orders',{method:'POST',body:order}); state.cart=[]; state.tableId=''; toast('Đã tạo đơn hàng.'); await loadPage(); } catch(err) { if(!(err instanceof ApiError) && err instanceof TypeError) { try { const queue=readQueue(localStorage); saveQueue(localStorage,[...queue,order]); state.cart=[]; state.tableId=''; toast('Đã lưu đơn trên máy. Đồng bộ khi có mạng.'); ordersPage(); } catch(storageError) { toast('Không thể lưu đơn offline: '+storageError.message,true); } } else toast(err.message,true); } finally { busy(false); } return; }
  if(action==='sync-orders') { const queue=readQueue(localStorage), pending=pendingFor(queue,state.user.id,state.branch).slice(0,100); if(!pending.length) return; const result=await perform(()=>api('/api/orders/sync-offline',{method:'POST',body:{orders:pending.map(({userId,error,...order})=>order)}})); if(result) { saveQueue(localStorage,applySyncResults(queue,result.details||[])); toast(`Đồng bộ ${result.syncedCount||0} đơn, ${result.duplicateCount||0} đơn đã tồn tại, ${result.failedCount||0} đơn lỗi.`,!!result.failedCount); loadPage(); } return; }
  if(action==='remove-pending') { if(!await confirmDialog({title:'Xóa đơn chờ đồng bộ?',message:'Đơn này sẽ bị xóa khỏi hàng đợi trên trình duyệt hiện tại.',confirmLabel:'Xóa đơn',danger:true})) return; saveQueue(localStorage,readQueue(localStorage).filter(o=>o.id!==id || o.userId!==state.user.id)); return ordersPage(); }
  if(action==='receipt') return perform(()=>openReceipt(api,target.dataset.session?'session':'order',target.dataset.session||id));
  if(action==='pay') { const method=document.getElementById(`pay-${id}`).value; if(method==='QR_BANKING'){const payment=await perform(()=>api(`/api/payments/vnpay/orders/${id}`,{method:'POST',body:{}}));if(payment){closeVnpayPayment?.();closeVnpayPayment=showVnpayPayment(payment,api,async()=>{invalidateReads();await loadPage();await openReceipt(api,'order',id);});}return;} if(!await confirmDialog({title:'Xác nhận thanh toán?',message:'Chỉ xác nhận khi đã nhận đủ tiền từ khách.',confirmLabel:'Đã nhận tiền'})) return; const result=await perform(()=>api(`/api/orders/${id}/pay`,{method:'POST',body:{paymentMethod:method}}),'Thanh toán thành công.'); if(result){await loadPage();await openReceipt(api,'order',id);} return; }
  if(action==='optimize') { const result=await perform(()=>api('/api/kds/batches/optimize',{method:'POST',body:{branchId:state.branch}}),'Đã gom mẻ chế biến.'); if(result) await refreshKitchen(); return; }
  if(action==='batch-cooking'||action==='batch-done') { const status=action==='batch-cooking'?'COOKING':'COMPLETED'; if(action==='batch-cooking'&&ev.target.closest('[data-stale="true"]')&&!await confirmDialog({title:'Mẻ đang chờ lâu',message:'Mẻ đã chờ trên 60 phút. Bạn đã xác minh với nhân viên và muốn tiếp tục chế biến?',confirmLabel:'Tiếp tục chế biến'})) return; if(action==='batch-done'&&!await confirmDialog({title:'Hoàn tất mẻ chế biến?',message:'Xác nhận toàn bộ món trong mẻ đã làm xong và sẵn sàng để nhân viên mang ra.',confirmLabel:'Đánh dấu hoàn tất'})) return; const result=await perform(()=>api(`/api/kds/batches/${id}/status`,{method:'PATCH',body:{status}}),status==='COOKING'?'Đã bắt đầu chế biến.':'Đã hoàn thành món.'); if(result) await refreshKitchen(); return; }
if(action==='goto-forecast'||action==='goto-catalog') { state.page=action==='goto-forecast'?'forecast':'catalog';shell();loadPage();return; }
if(action==='receive-stock'||action==='adjust-stock') {
  const ingredient=state.data.ingredients.find(i=>i.id===Number(id));if(!ingredient||!access(['ADMIN']))return;
  const planId=Number(target.dataset.plan)||undefined,plan=state.data.plan?.find(p=>p.id===planId),receiving=action==='receive-stock';
  const remaining=plan?Math.max(0,plan.suggestedOrderQty-(plan.receivedQuantity||0)):null,requestId=crypto.randomUUID();
  formModal(`${receiving?'Nhập hàng':'Cập nhật theo số đếm'} · ${ingredient.name}`,[f('quantity',receiving?`Số lượng vừa nhận (${ingredient.unit})`:`Tổng số đang có (${ingredient.unit})`,'',{type:'number',min:receiving?0.001:0,step:'0.001',required:true}),f('reason',receiving?'Ghi chú hoặc mã phiếu giao hàng':'Ghi chú kiểm đếm (ghi “khớp” nếu không lệch)','',{required:true})],async values=>{
    const quantity=numberField(values.quantity,'Số lượng',receiving?0.001:0,'any');
    if(remaining!==null&&quantity>remaining)throw Error(`Đề xuất còn ${remaining} ${ingredient.unit} chưa nhận.`);
    return api(`/api/inventory/ingredients/${id}${receiving?'/receive':''}`,{method:receiving?'POST':'PATCH',body:receiving?{quantity,reason:textValue(values.reason,'Ghi chú'),planId,requestId}:{currentStock:quantity,reason:textValue(values.reason,'Lý do')}});
  },{description:receiving?`Nhập phần hàng mới vừa giao; hệ thống sẽ cộng số này vào kho. Đang có ${ingredient.currentStock} ${ingredient.unit}, trong đó ${ingredient.committedStock} ${ingredient.unit} đã giữ cho đơn chưa thanh toán.${remaining!==null?` Đề xuất còn ${remaining} ${ingredient.unit} chưa nhận.`:''}`:`Đếm toàn bộ lượng đang có rồi nhập tổng. Hệ thống sẽ thay số cũ (${ingredient.currentStock} ${ingredient.unit}), không cộng số mới vào. Đơn chưa thanh toán đang cần ${ingredient.committedStock} ${ingredient.unit}, nên không thể ghi tổng thấp hơn lượng này.`,submitLabel:receiving?'Cộng hàng vào kho':'Lưu số đếm'});return;
}
  if(action==='ai-plan') {
    const selected=document.querySelector('#forecast-date').value,day=state.forecastResultDate,branch=state.branch;
    if(!day||selected!==day||state.forecastResultBranch!==branch)return toast('Ngày hoặc chi nhánh đã đổi. Hãy ước tính lại nhu cầu trước khi lập dự trù.',true);
    const plan=await perform(()=>api('/api/inventory/plan',{method:'POST',body:{targetDate:day,branchId:branch}}));
    if(plan&&state.branch===branch)showAiActionResult('Dự trù nguyên liệu cho '+day,'Dựa vào dự báo món, định lượng và số tồn khả dụng. Kiểm tra trước khi duyệt mua hàng.',ingredientPlanMarkup(plan),()=>{state.date=day;state.page='inventory';shell();loadPage();},'Mở kho để xem và duyệt');return;
  }
  if(action==='ai-prepare-combos') {
    const baskets=state.aiAnalysis?.baskets,branch=state.branch;if(!baskets||baskets.branchId!==branch)return toast('Hãy phân tích lại cho chi nhánh đang chọn.',true);if(document.querySelector('#basket-from').value!==baskets.from||document.querySelector('#basket-to').value!==baskets.to)return toast('Khoảng ngày đã đổi. Hãy tìm lại nhóm món trước khi chuẩn bị combo.',true);
    if(!await confirmDialog({title:'Chuẩn bị đề xuất combo?',message:'Lưu bộ dữ liệu hóa đơn từ '+baskets.from+' đến '+baskets.to+' để tạo đề xuất. Combo chỉ bán cho khách sau khi quản trị viên đặt giá và duyệt.',confirmLabel:'Chuẩn bị đề xuất'}))return;
    const result=await perform(()=>api('/api/fp-pipeline/refine?page=1',{method:'POST',body:{branchId:branch,from:baskets.from,to:baskets.to}}));
    if(result&&state.branch===branch){pipelineViews.clear();state.page=access(['ADMIN'])?'combos':'pipeline';shell();await loadPage();toast(access(['ADMIN'])?'Nhập giá ưu đãi rồi duyệt combo muốn bán.':'Bộ dữ liệu đã lưu. Chuyển quản trị viên duyệt giá trước khi bán.');}return;
  }
  if(action==='ai-review-day') {
    const day=state.aiAnalysis?.anomaly?state.aiAnalysis.checkedDate:document.querySelector('#ai-anomaly-date')?.value,branch=state.branch;if(!day||day>aiDay(-1))return toast('Chọn một ngày đã hoàn tất để đối chiếu.',true);
    const report=await perform(()=>api('/api/analytics/revenue-report?branchId='+branch+'&from='+day+'&to='+day,{cache:'no-store'}));
    if(report&&state.branch===branch)showAiActionResult('Đối chiếu ngày '+day,'Kiểm tra hóa đơn, giảm giá và các sự kiện kinh doanh trong ngày.',reviewDayMarkup(report));return;
  }
  if(action==='plan') { state.date=document.querySelector('#plan-date').value; if(!state.date) return toast('Chọn ngày hợp lệ.',true); const result=await perform(()=>api('/api/inventory/plan',{method:'POST',body:{targetDate:state.date,branchId:state.branch}}),'Đã lập kế hoạch nguyên liệu.'); if(result) await loadPage(); return; }
  if(action==='approve') { const result=await perform(()=>api(`/api/inventory/plan/${id}/approve`,{method:'POST'}),'Đã duyệt kế hoạch.'); if(result) await loadPage(); return; }
  if(['analyze-baskets','check-ai-day','update-ai-model'].includes(action)) {
    captureAiInputs();const ai=state.aiAnalysis, branch=state.branch;
    const current=()=>state.page==='forecast'&&state.branch===branch&&state.aiAnalysis===ai;
    if(action==='analyze-baskets') {
      ai.basketError='';const result=await perform(async()=>{try{return await api('/api/forecast/baskets',{method:'POST',body:{branchId:branch,from:ai.from,to:ai.to}});}catch(error){ai.basketError=error.message;throw error;}});
      if(result)ai.baskets=result;if(current())forecast();return;
    }
    if(action==='check-ai-day') {
      if(!ai.anomalyDate||ai.anomalyDate>aiDay(-1))return toast('Chọn một ngày đã hoàn tất.',true);
      ai.anomalyError='';ai.anomaly=null;
      const date=ai.anomalyDate;
      const result=await perform(async()=>{try{return await api('/api/forecast/detect-anomaly',{method:'POST',body:{branchId:branch,date}});}catch(error){ai.anomalyError=error.message;throw error;}});
      if(result){ai.anomaly=result;ai.checkedDate=date;}if(current())forecast();return;
    }
    const result=await perform(()=>api('/api/forecast/train-anomaly',{method:'POST',body:{branchId:branch,epochs:50}}),'Đã cập nhật mô hình Autoencoder.');
    if(result){ai.trained=result;ai.anomaly=null;ai.anomalyError='';}if(current())forecast();return;
  }
  if(action==='run-forecast') {captureAiInputs();const day=document.querySelector('#forecast-date').value,branch=state.branch,token=state.token;if(!day)return toast('Chọn ngày hợp lệ.',true);state.date=day;const result=await perform(()=>api('/api/forecast/daily',{method:'POST',body:{targetDate:day,branchId:branch}}),'Đã ước tính nhu cầu món.');if(result&&state.branch===branch&&state.token===token&&state.page==='forecast'){state.data.forecast=result;state.forecastResultDate=day;state.forecastResultBranch=branch;forecast();}return;}
  if(action==='login') { const username=document.querySelector('#username').value.trim(), password=document.querySelector('#password').value; if(!username||!password) return toast('Nhập tài khoản và mật khẩu.',true); const result=await perform(()=>authenticatorLogin(api,username,password)); if(result){ state.token=result.token;state.user=result.user;state.branch=result.user.branchId || state.branches.find(b=>b.id===state.branch)?.id || state.branches[0]?.id || 1;localStorage.setItem('dusko_branch',state.branch);sessionStorage.setItem('dusko_token',result.token);sessionStorage.setItem('dusko_user',JSON.stringify(result.user)); document.querySelector('.modal-wrap')?.close(); shell(); loadPage();} return; }
  if(action==='mfa-settings')return reconfigureAuthenticator(api,()=>{signOut();toast('Đã đổi Authenticator. Hãy đăng nhập lại.');});
  if(action==='password') return passwordDialog(api,()=>{signOut();toast('Đã đổi mật khẩu. Vui lòng đăng nhập lại.');});
  if(action==='logout') signOut();
}
function signOut() { startSeq++; closeVnpayPayment?.(); stopLive?.(); stopLive=null; invalidateReads(); pipelineViews.clear(); state.token='';state.user=null;state.cart=[];state.data={};sessionStorage.removeItem('dusko_token');sessionStorage.removeItem('dusko_user');shell();loadPage(); }
function loginPanel() { document.querySelector('.avatar')?.remove(); if(state.user) document.querySelector('.top-actions')?.insertAdjacentHTML('beforeend',`<span class="user-name">${e(state.user.fullName)} · ${e(state.user.role)}</span>${state.user.role==='ADMIN'?btn('Authenticator','mfa-settings','text'):''}${btn('Đổi mật khẩu','password','text')}${btn('Đăng xuất','logout','text')}`); }
function showEntry() {
  serviceWorkspace?.destroy();serviceWorkspace=null;
  mountLogin(app,{submit:async(username,password)=>{
    const result=await authenticatorLogin(api,username,password);
    state.token=result.token;state.user=result.user;
    sessionStorage.setItem('dusko_token',result.token);sessionStorage.setItem('dusko_user',JSON.stringify(result.user));
    await start();
  }});
}
// One delegated listener keeps controls working after each page is rendered.
document.addEventListener('click', onClick);
document.addEventListener('change',async ev=>{ if(ev.target.id==='kitchen-status') { state.kitchenStatus=ev.target.value; updateKitchenLive(); } if(ev.target.id==='kitchen-station') { state.kitchenStation=ev.target.value; updateKitchenLive(); } if(ev.target.id==='plan-date') { state.date=ev.target.value; loadPage(); } });
window.addEventListener('online',()=>{ if(state.user && state.page==='orders' && pendingFor(readQueue(localStorage),state.user.id,state.branch).length) toast('Đã có mạng. Bạn có thể đồng bộ đơn đang chờ.'); });
setInterval(()=>{ document.querySelectorAll('[data-kitchen-time]').forEach(el=>{el.textContent=kitchenAgeText(Math.max(0,Date.now()-new Date(el.dataset.kitchenTime).getTime()));}); },1000);
async function refreshKitchen(strict=false) { const branch=state.branch; try { const batches=await api(`/api/kds/batches?branchId=${branch}`);if(state.page!=='kitchen'||state.branch!==branch)return;state.data.batches=batches; state.kitchenLastUpdated=new Date(); updateKitchenLive(); } catch(error) { if(strict)throw error;toast(`Không thể cập nhật màn hình bếp: ${error.message}`,true); } }
setInterval(async()=>{ if(state.page!=='kitchen'||!state.token||state.loading||document.hidden) return; await refreshKitchen(); },15000);
async function start() {
  const seq=++startSeq, token=state.token;
  stopLive?.();stopLive=null;invalidateReads();
  if(!state.user||!token){showEntry();return;}
  app.innerHTML='<div class="loading" role="status">DUSKO · Đang tải không gian làm việc…</div>';
  let revision;
  try {
    let data;
    try { data=await api(`/api/bootstrap?page=${state.page}&branchId=${state.branch}&targetDate=${state.date}`,{cache:'no-store'}); }
    catch(error) {
      if(error.status!==404)throw error;
      const [branches,profile]=await Promise.all([api('/api/catalog/branches'),api('/api/auth/profile')]);
      const user={...state.user,...profile};
      data={branches,user,branchId:user.role==='ADMIN'?(branches.some(b=>b.id===state.branch)?state.branch:branches[0]?.id):user.branchId,resources:{}};
    }
    if(seq!==startSeq||token!==state.token)return;
    state.user=data.user;state.branches=data.branches;state.branch=data.branchId;
    state.page=data.page||state.page;revision=data.revision;
    sessionStorage.setItem('dusko_user',JSON.stringify(data.user));
    localStorage.setItem('dusko_branch',state.branch);
    for(const [path,value] of Object.entries(data.resources))startupReads.set(`${token}:${path}`,value);
    shell();await loadPage();
    if(seq!==startSeq||token!==state.token)return;
    stopLive=watchChanges((path,options)=>api(path,options),async message=>{
      if(token!==state.token)throw Error('login');
      if(message?.revision!==undefined&&message.revision===revision)return;
      invalidateReads();
      if(message?.type==='event')notifyLiveEvent(message);
      if(state.page==='kitchen'){if(state.loading)throw Error('busy');await refreshKitchen(true);}
      else if(state.page==='combos'){if(state.loading)throw Error('busy');await document.querySelector('#combo-approval')?.refreshLive?.();}
      else showDataNotice();
      revision=message?.revision;
    }, '/api/live', {onEvent:async message=>{
      if(token!==state.token)throw Error('login');
      if(message?.revision!==undefined&&message.revision===revision)return;
      invalidateReads();
      notifyLiveEvent(message);
      if(state.page==='kitchen'){if(state.loading)throw Error('busy');await refreshKitchen(true);}
      else if(state.page==='combos'){if(state.loading)throw Error('busy');await document.querySelector('#combo-approval')?.refreshLive?.();}
      else showDataNotice();
      revision=message?.revision;
    }});
  } catch(error) {
    if(seq!==startSeq||token!==state.token)return;
    if(error.status===401){signOut();return;}
    app.innerHTML=`<div class="loading" role="alert">${e(error.message)} <button id="startup-retry" class="btn">Thử lại</button><button id="startup-logout" class="btn">Đăng xuất</button></div>`;
    document.querySelector('#startup-retry').onclick=start;
    document.querySelector('#startup-logout').onclick=signOut;
  }
}
start();

import './pos-theme.css';
