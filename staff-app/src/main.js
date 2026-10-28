import {jsonRequest} from '../../src/json-request.js';
import {canManage,canAdminister} from '../../src/permissions.js';
import {mountKitchen} from '../../src/kitchen-workspace.js';
import {mountCustomerLookup} from '../../src/customer-lookup.js';
import {mountReceiptManager} from '../../src/receipt-manager.js';
import '../../src/tokens.css';
import {authenticatorLogin,reconfigureAuthenticator} from '../../src/mfa-login.js';
import { passwordDialog } from '../../src/accounts.js';
import '../../src/accounts.css';
import {mountLogin,managementUrl} from '../../src/app-entry.js';
import './style.css';
import {createServiceWorkspace} from '../../src/service-workspace.js';
import {staffShellsFor, shellLabels, shellDescriptions} from './role-picker.js';
import '../../src/readability.css';
import '../../src/font.css';
import '../../src/pos-theme.css';


const api = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const app = document.querySelector('#app');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'})[c]);
let auth;
try { auth=JSON.parse(sessionStorage.getItem('dusko-auth')||'null'); } catch { auth=null; }
let workspace;
async function request(path,options={}) {
  try{return await jsonRequest(api,path,{...options,token:auth?.token});}
  catch(error){if(error.status===401&&auth){auth=null;sessionStorage.removeItem('dusko-auth');sessionStorage.removeItem('dusko-shell');renderLogin('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');}throw error;}
}
function renderLogin(message='') {
  workspace?.destroy();workspace=null;
  mountLogin(app,{staff:true,message,submit:async(username,password)=>{
    const result=await authenticatorLogin(request,username,password);
    if(!staffShellsFor(result.user).length)throw Error('Tài khoản này không có quyền truy cập web nhân viên');
    auth=result;sessionStorage.setItem('dusko-auth',JSON.stringify(auth));await startWorkspace();
  }});
}
async function startWorkspace(selectedShell=null) {
  workspace?.destroy();workspace=null;
  const profile=await request('/api/auth/profile');
  if(!auth)return;
  auth.user={...auth.user,...profile};sessionStorage.setItem('dusko-auth',JSON.stringify(auth));
  const shells=staffShellsFor(auth.user);
  if(!shells.length)throw Error('Tài khoản chưa có vai trò làm việc. Liên hệ quản lý.');
  const shell=shells.includes(selectedShell)?selectedShell:null;
  if(!shell){
    app.innerHTML=`<main class="role-picker"><div class="role-picker-header"><img class="dusko-logo" src="/dusko-logo-v1.png" alt="Dusko Restaurant"><button type="button" data-picker-logout>Đăng xuất</button></div><h1>Chọn khu vực làm việc</h1><p>Xin chào ${esc(auth.user.fullName)}. Chọn công việc bạn muốn thực hiện trong ca.</p><div class="role-picker-grid">${shells.map((id,index)=>`<button type="button" class="role-card" data-shell="${id}"><span class="role-card-number" aria-hidden="true">0${index+1}</span><strong>${shellLabels[id]}</strong><span>${shellDescriptions[id]}</span><span class="role-card-enter">Vào khu vực →</span></button>`).join('')}</div><p class="role-picker-note">Bạn có thể đổi khu vực bất cứ lúc nào. Các thao tác được ghi nhận bằng tài khoản của bạn.</p><p role="status" data-picker-error></p></main>`;
    app.querySelector('[data-picker-logout]').onclick=()=>{auth=null;sessionStorage.removeItem('dusko-auth');sessionStorage.removeItem('dusko-shell');renderLogin();};
    let selecting=false;
    app.querySelectorAll('[data-shell]').forEach(button=>button.onclick=async()=>{
      if(selecting)return;selecting=true;
      app.querySelectorAll('[data-shell]').forEach(card=>card.disabled=true);
      try{await startWorkspace(button.dataset.shell);}
      catch(error){app.querySelector('[data-picker-error]')?.replaceChildren(document.createTextNode(error.message));}
      finally{selecting=false;app.querySelectorAll('[data-shell]').forEach(card=>card.disabled=false);}
    });
    return;
  }
  let branches=[];
  const branchId=auth.user.branchId;
  if(!branchId) {
    if(!canAdminister(auth.user))throw Error('Tài khoản chưa được gán chi nhánh. Nhờ quản lý cập nhật.');
    branches=await request('/api/catalog/branches');
    if(!branches.length)throw Error('Chưa có chi nhánh để phục vụ.');
  }
  workspace?.destroy();
  app.innerHTML=`<header class="staff-app-header"><b><img class="dusko-logo" src="/dusko-logo-v1.png" alt="Dusko Restaurant"><span>DUSKO<small>${esc(shellLabels[shell])}</small></span></b><div>${canManage(auth.user)?`<a href="${managementUrl}">Trang quản lý ↗</a>`:''}${canAdminister(auth.user)?'<button id="mfa-settings">Authenticator</button>':''}<button id="switch-role">Đổi khu vực</button><button id="password">Đổi mật khẩu</button><button id="logout">Đăng xuất</button></div></header><main class="staff-main"><div class="staff-toolbar"><p class="staff-identity"><span class="staff-avatar">${esc((auth.user.fullName||'N').slice(0,1).toLocaleUpperCase('vi'))}</span><span><strong>${esc(auth.user.fullName)}</strong><small>${esc({ADMIN:'Quản trị viên',MANAGER:'Quản lý',CASHIER:'Thu ngân',WAITER:'Nhân viên phục vụ',CHEF:'Bếp'}[auth.user.role])}</small></span></p>${branches.length?`<label class="staff-branch"><span>Chi nhánh</span><select id="staff-branch">${branches.map(branch=>`<option value="${branch.id}">${esc(branch.name)}</option>`).join('')}</select></label>`:''}</div><div id="service-workspace" class="staff-app-surface"></div></main>`;
  if(canAdminister(auth.user))app.querySelector('#mfa-settings').onclick=()=>reconfigureAuthenticator(request,()=>{auth=null;sessionStorage.removeItem('dusko-auth');renderLogin('Đã đổi Authenticator. Hãy đăng nhập lại.');});
  app.querySelector('#password').onclick=()=>passwordDialog(request,()=>{auth=null;sessionStorage.removeItem('dusko-auth');renderLogin('Đã đổi mật khẩu. Vui lòng đăng nhập lại.');});
  app.querySelector('#switch-role')?.addEventListener('click',()=>{sessionStorage.removeItem('dusko-shell');startWorkspace().catch(error=>renderLogin(error.message));});
  app.querySelector('#logout').onclick=()=>{auth=null;sessionStorage.removeItem('dusko-auth');sessionStorage.removeItem('dusko-shell');renderLogin();};
  let activeView='service';
  const cashier=shell==='cashier';
  const nav=document.createElement('nav');nav.className='staff-work-nav';nav.setAttribute('aria-label','Không gian làm việc');
  if(cashier){
    nav.innerHTML='<button type="button" data-view="service" aria-pressed="true">Bàn chờ thanh toán</button><button type="button" data-view="receipts" aria-pressed="false">Hóa đơn</button><button type="button" data-view="customers" aria-pressed="false">Khách hàng</button>';
    app.querySelector('#service-workspace').before(nav);
  }
  let showView;
  const mount=id=>{
    workspace?.destroy();const root=app.querySelector('#service-workspace');
    if(shell==='kitchen'){workspace=mountKitchen({root,request,branchId:Number(id)});return;}
    root.innerHTML='<div data-service-pane></div><div data-other-pane hidden></div>';
    const servicePane=root.querySelector('[data-service-pane]'),otherPane=root.querySelector('[data-other-pane]');
    const service=createServiceWorkspace({root:servicePane,request,branchId:Number(id),role:cashier?'CASHIER':'WAITER',userId:auth.user.id,imageBase:api});
    let other;
    showView=()=>{
      const isService=activeView==='service';servicePane.hidden=!isService;otherPane.hidden=isService;
      nav.querySelectorAll('[data-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===activeView)));
      other?.destroy();other=null;
      if(activeView==='receipts')other=mountReceiptManager({root:otherPane,request,branchId:Number(id)});
      if(activeView==='customers')other=mountCustomerLookup({root:otherPane,request,branchId:Number(id)});
    };
    workspace={destroy(){service.destroy();other?.destroy();}};showView();
  };
  nav.onclick=event=>{const button=event.target.closest('[data-view]');if(!button||button.dataset.view===activeView)return;activeView=button.dataset.view;showView();};
  mount(branchId||branches[0].id);
  app.querySelector('#staff-branch')?.addEventListener('change',event=>mount(event.target.value));
}
if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
if(auth)startWorkspace().catch(error=>renderLogin(error.message));else renderLogin();

import '../../src/ui-foundation.css';
