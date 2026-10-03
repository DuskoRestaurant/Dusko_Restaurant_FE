import './style.css';
import {createServiceWorkspace} from '../../src/service-workspace.js';
import '../../src/readability.css';
import '../../src/font.css';
import './staff-workspace.css';

const api = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080').replace(/\/$/, '');
const app = document.querySelector('#app');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'})[c]);
let auth;
try { auth=JSON.parse(sessionStorage.getItem('dusko-auth')||'null'); } catch { auth=null; }
let workspace;
async function request(path,{method='GET',body}={}) {
  const response=await fetch(api+path,{method,headers:{'Content-Type':'application/json',...(auth?{Authorization:`Bearer ${auth.token}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const payload=await response.json().catch(()=>({}));
  if(response.status===401) {auth=null;sessionStorage.removeItem('dusko-auth');renderLogin('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');}
  if(!response.ok) {const error=Error(payload.error||'Không kết nối được máy chủ');error.status=response.status;throw error;}
  return payload.data;
}
function renderLogin(message='') {
  workspace?.destroy();workspace=null;
  app.innerHTML=`<main class="login"><h1>DUSKO <small>NHÂN VIÊN</small></h1><p>Chọn bàn, nhận yêu cầu và mang món ra.</p><form id="login"><label>Tài khoản<input name="username" required autocomplete="username"></label><label>Mật khẩu<input name="password" type="password" required autocomplete="current-password"></label><button class="primary">Đăng nhập</button></form><p role="status">${esc(message)}</p></main>`;
  app.querySelector('#login').onsubmit=async event=>{
    event.preventDefault();const form=new FormData(event.target);const button=event.target.querySelector('button');button.disabled=true;
    try {
      const result=await request('/api/auth/login',{method:'POST',body:{username:form.get('username'),password:form.get('password')}});
      if(!['ADMIN','MANAGER','CASHIER','WAITER'].includes(result.user.role))throw Error('Tài khoản này không có quyền phục vụ bàn');
      auth=result;sessionStorage.setItem('dusko-auth',JSON.stringify(auth));await startWorkspace();
    } catch(error) {renderLogin(error.message);}
  };
}
async function startWorkspace() {
  let branches=[];
  const branchId=auth.user.branchId;
  if(!branchId) {
    if(auth.user.role!=='ADMIN')throw Error('Tài khoản chưa được gán chi nhánh. Nhờ quản lý cập nhật.');
    branches=await request('/api/catalog/branches');
    if(!branches.length)throw Error('Chưa có chi nhánh để phục vụ.');
  }
  workspace?.destroy();
  app.innerHTML=`<header class="staff-app-header"><b><span class="staff-brand-mark">D</span><span>DUSKO<small>NHÂN VIÊN</small></span></b><button id="logout">Đăng xuất</button></header><main><div class="staff-toolbar"><p class="staff-identity"><span class="staff-avatar">${esc((auth.user.fullName||'N').slice(0,1).toLocaleUpperCase('vi'))}</span><span><strong>${esc(auth.user.fullName)}</strong><small>${esc({ADMIN:'Quản trị viên',MANAGER:'Quản lý',CASHIER:'Thu ngân',WAITER:'Nhân viên phục vụ'}[auth.user.role])}</small></span></p>${branches.length?`<label class="staff-branch"><span>Chi nhánh</span><select id="staff-branch">${branches.map(branch=>`<option value="${branch.id}">${esc(branch.name)}</option>`).join('')}</select></label>`:''}</div><div id="service-workspace" class="staff-app-surface"></div></main>`;
  app.querySelector('#logout').onclick=()=>{auth=null;sessionStorage.removeItem('dusko-auth');renderLogin();};
  const mount=id=>{workspace?.destroy();workspace=createServiceWorkspace({root:app.querySelector('#service-workspace'),request,branchId:Number(id),role:auth.user.role,userId:auth.user.id,imageBase:api});};
  mount(branchId||branches[0].id);
  app.querySelector('#staff-branch')?.addEventListener('change',event=>mount(event.target.value));
}
if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
if(auth)request('/api/auth/profile').then(startWorkspace).catch(error=>renderLogin(error.message));else renderLogin();
