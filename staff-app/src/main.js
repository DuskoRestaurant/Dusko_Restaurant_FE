import '../../src/tokens.css';
import {authenticatorLogin,reconfigureAuthenticator} from '../../src/mfa-login.js';
import { passwordDialog } from '../../src/accounts.js';
import '../../src/accounts.css';
import {mountLogin,managementUrl} from '../../src/app-entry.js';
import './style.css';
import {createServiceWorkspace} from '../../src/service-workspace.js';
import {staffShellsFor, kitchenHtml} from './role-picker.js';
import '../../src/readability.css';
import '../../src/font.css';
import '../../src/pos-theme.css';


const api = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const app = document.querySelector('#app');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'})[c]);
let auth;
try { auth=JSON.parse(sessionStorage.getItem('dusko-auth')||'null'); } catch { auth=null; }
let workspace;
async function request(path,{method='GET',body,signal}={}) {
  const response=await fetch(api+path,{method,signal,headers:{'Content-Type':'application/json',...(auth?{Authorization:`Bearer ${auth.token}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const payload=await response.json().catch(()=>({}));
  if(response.status===401 && auth) {auth=null;sessionStorage.removeItem('dusko-auth');renderLogin('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');}
  if(!response.ok) {const error=Error(payload.error||'Không kết nối được máy chủ');error.status=response.status;throw error;}
  return payload.data;
}
function renderLogin(message='') {
  workspace?.destroy();workspace=null;
  mountLogin(app,{staff:true,message,submit:async(username,password)=>{
    const result=await authenticatorLogin(request,username,password);
    if(!['ADMIN','MANAGER','CASHIER','WAITER','CHEF'].includes(result.user.role))throw Error('Tài khoản này không có quyền phục vụ bàn');
    auth=result;sessionStorage.setItem('dusko-auth',JSON.stringify(auth));await startWorkspace();
  }});
}
async function startWorkspace() {
  // Phase 5 — role picker: single-shell users auto-redirect, multi-shell users choose.
  try { const profile = await request('/api/auth/profile'); if (profile?.roles) { auth.user.roles = profile.roles; sessionStorage.setItem('dusko-auth', JSON.stringify(auth)); } } catch {}
  const shells = staffShellsFor(auth.user);
  const saved = sessionStorage.getItem('dusko-shell');
  const shell = shells.length === 1 ? shells[0] : (shells.includes(saved) ? saved : null);
  if (!shell) {
    app.innerHTML = `<main><h1>Chọn vai trò làm việc</h1><p>${esc(auth.user.fullName)} — chọn giao diện phù hợp với ca làm việc.</p><button type="button" id="pick-cashier">Tiếp tục với tư cách Thu ngân</button><button type="button" id="pick-kitchen">Tiếp tục với tư cách Bếp</button></main>`;
    app.querySelector('#pick-cashier').onclick = () => { sessionStorage.setItem('dusko-shell', 'cashier'); startWorkspace(); };
    app.querySelector('#pick-kitchen').onclick = () => { sessionStorage.setItem('dusko-shell', 'kitchen'); startWorkspace(); };
    return;
  }
  let branches=[];
  const branchId=auth.user.branchId;
  if(!branchId) {
    if(auth.user.role!=='ADMIN')throw Error('Tài khoản chưa được gán chi nhánh. Nhờ quản lý cập nhật.');
    branches=await request('/api/catalog/branches');
    if(!branches.length)throw Error('Chưa có chi nhánh để phục vụ.');
  }
  workspace?.destroy();
  app.innerHTML=`<header class="staff-app-header"><b><span class="staff-brand-mark">D</span><span>DUSKO<small>NHÂN VIÊN</small></span></b><div>${['ADMIN','MANAGER'].includes(auth.user.role)?`<a href="${managementUrl}">Trang quản lý ↗</a>`:''}${auth.user.role==='ADMIN'?'<button id="mfa-settings">Authenticator</button>':''}<button id="password">Đổi mật khẩu</button><button id="logout">Đăng xuất</button></div></header><main><div class="staff-toolbar"><p class="staff-identity"><span class="staff-avatar">${esc((auth.user.fullName||'N').slice(0,1).toLocaleUpperCase('vi'))}</span><span><strong>${esc(auth.user.fullName)}</strong><small>${esc({ADMIN:'Quản trị viên',MANAGER:'Quản lý',CASHIER:'Thu ngân',WAITER:'Nhân viên phục vụ',CHEF:'Bếp'}[auth.user.role])}</small></span></p>${branches.length?`<label class="staff-branch"><span>Chi nhánh</span><select id="staff-branch">${branches.map(branch=>`<option value="${branch.id}">${esc(branch.name)}</option>`).join('')}</select></label>`:''}</div><div id="service-workspace" class="staff-app-surface"></div></main>`;
  if(auth.user.role==='ADMIN')app.querySelector('#mfa-settings').onclick=()=>reconfigureAuthenticator(request,()=>{auth=null;sessionStorage.removeItem('dusko-auth');renderLogin('Đã đổi Authenticator. Hãy đăng nhập lại.');});
  app.querySelector('#password').onclick=()=>passwordDialog(request,()=>{auth=null;sessionStorage.removeItem('dusko-auth');renderLogin('Đã đổi mật khẩu. Vui lòng đăng nhập lại.');});
  app.querySelector('#logout').onclick=()=>{auth=null;sessionStorage.removeItem('dusko-auth');renderLogin();};
  // Phase 3 — staff-assisted customer verification for a table session.
  if (shell === 'kitchen') { /* Kitchen shell: no customer verification, no cashier actions. */ }
  const verifyBar = document.createElement('div');
  if (shell === 'kitchen') verifyBar.hidden = true;
  verifyBar.innerHTML = `<label>Bàn <input id="verify-table" type="number" min="1" placeholder="ID bàn"></label><label>Số điện thoại khách <input id="verify-phone" placeholder="09xx"></label><button type="button" id="verify-customer">Xác nhận khách tại bàn</button><span id="verify-result"></span>`;
  app.querySelector('main').prepend(verifyBar);
  verifyBar.querySelector('#verify-customer').onclick = async () => {
    const result = verifyBar.querySelector('#verify-result');
    try {
      const branch = Number(app.querySelector('#staff-branch')?.value || branchId || branches[0]?.id);
      const tableId = Number(verifyBar.querySelector('#verify-table').value);
      await request(`/api/staff/tables/${tableId}/customer/verify-by-phone`, { method: 'POST', body: JSON.stringify({ branchId: branch, phone: verifyBar.querySelector('#verify-phone').value }) });
      result.textContent = 'Đã xác nhận khách tại bàn. Khách sẽ thấy hạng và ưu đãi trên điện thoại.';
    } catch (e) { result.textContent = e.message; }
  };
  const mount=id=>{
    workspace?.destroy();
    if (shell === 'kitchen') {
      app.querySelector('#service-workspace').innerHTML = kitchenHtml();
      loadKitchen(Number(id));
      workspace = { destroy() {} };
      return;
    }
    workspace=createServiceWorkspace({root:app.querySelector('#service-workspace'),request,branchId:Number(id),role:auth.user.role,userId:auth.user.id,imageBase:api});
  };
  mount(branchId||branches[0].id);
  app.querySelector('#staff-branch')?.addEventListener('change',event=>mount(event.target.value));
}
async function loadKitchen(branchId) {
  const holder = document.querySelector('#kitchen-batches');
  if (!holder) return;
  try {
    const batches = await request(`/api/kds/batches?branchId=${branchId}`);
    const nextStatus = s => s === 'SCHEDULED' ? 'COOKING' : s === 'COOKING' ? 'COMPLETED' : null;
    holder.innerHTML = batches.length ? batches.map(b => { const next = nextStatus(b.status); return `<article><h3>Mẻ #${b.id} · ${esc(b.status)}</h3><ul>${(b.items || []).map(i => `<li>${esc(i.product?.name || `Món #${i.productId}`)} × ${i.quantity}${i.isGift ? ' · <b>Quà tặng</b>' : ''} · ${esc(i.kdsStatus)}</li>`).join('')}</ul>${next ? `<button type="button" data-batch-status="${b.id}" data-next="${next}">${next === 'COOKING' ? 'Bắt đầu nấu' : 'Hoàn thành'}</button>` : '<p>Đã hoàn thành.</p>'}</article>`; }).join('') : '<p>Không có món cần xử lý.</p>';
    holder.querySelectorAll('[data-batch-status]').forEach(btn => btn.onclick = async () => { try { await request(`/api/kds/batches/${btn.dataset.batchStatus}/status`, { method: 'PATCH', body: JSON.stringify({ status: btn.dataset.next, branchId }) }); loadKitchen(branchId); } catch (e) { alert(e.message); } });
  } catch (e) { holder.innerHTML = `<p>Không tải được mẻ bếp: ${esc(e.message)}</p>`; }
}
if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
if(auth)request('/api/auth/profile').then(startWorkspace).catch(error=>renderLogin(error.message));else renderLogin();
