import './app-entry.css';

function destination(port, override) {
  if (override) return override;
  const url = new URL('/', window.location.href);
  if (['5173', '5175'].includes(url.port)) url.port = port;
  else url.pathname = port === '5175' ? '/staff/' : '/';
  return url.href;
}
export const staffUrl = destination('5175', import.meta.env.VITE_STAFF_APP_URL);
export const managementUrl = destination('5173', import.meta.env.VITE_MANAGEMENT_APP_URL);

export function mountLogin(root, {staff = false, submit, message = ''}) {
  root.innerHTML = `<main class="entry-page entry-premium"><section class="entry-intro"><a class="entry-brand" href="${managementUrl}"><img class="dusko-logo" src="/dusko-logo-v1.png" alt="Dusko Restaurant"> DUSKO</a><div class="entry-editorial"><span class="entry-kicker">DUSKO RESTAURANT</span><h1>Quản lý nhà hàng.<br>Phục vụ khách hàng.</h1><p>Chọn đúng khu vực để bắt đầu ca làm việc của bạn.</p><div class="entry-photo-grid"><img src="/dishes/lau-thai.webp" alt="Lẩu Thái của nhà hàng"><div><span>Ẩm thực & dịch vụ</span><strong>Chu đáo trong từng<br>lượt phục vụ.</strong><p>Thực đơn · Bàn ăn · Nhà bếp</p></div></div></div><div class="entry-destinations"><a href="${managementUrl}" ${!staff?'aria-current="page"':''}><strong>Quản lý nhà hàng</strong><span>Doanh thu, bếp, thực đơn, kho và phân tích AI</span></a><a href="${staffUrl}" ${staff?'aria-current="page"':''}><strong>App nhân viên ↗</strong><span>Nhận bàn, xác nhận yêu cầu và phục vụ món</span></a></div></section><section class="entry-form-panel"><div class="entry-form-box"><div class="entry-form-logo"><img class="dusko-logo" src="/dusko-logo-v1.png" alt="Dusko Restaurant"><span>DUSKO<small>WORKSPACE</small></span></div><span class="entry-kicker">${staff?'DÀNH CHO NHÂN VIÊN':'DÀNH CHO QUẢN LÝ & VẬN HÀNH'}</span><h2>Chào mừng trở lại</h2><p>Đăng nhập để bắt đầu ca làm việc của bạn.</p><div class="entry-role-badge">${staff?'Phục vụ · Thu ngân · Nhà bếp':'Quản lý & vận hành'}</div><form><label>Tên đăng nhập<input name="username" autocomplete="username" required placeholder="Nhập tên đăng nhập" autocapitalize="none" spellcheck="false"></label><label>Mật khẩu<div class="entry-password"><input name="password" type="password" autocomplete="current-password" required placeholder="Nhập mật khẩu"><button type="button" data-password aria-label="Hiện mật khẩu">Hiện</button></div></label><p class="entry-error" role="status" aria-live="polite"></p><button class="entry-submit" type="submit">Đăng nhập</button></form><div class="entry-account-help">Chưa có tài khoản hoặc quên mật khẩu?<br>Liên hệ quản lý nhà hàng để được hỗ trợ.</div><p class="entry-help">${staff?'Quản lý cần xem doanh thu và kho?':'Bạn đang phục vụ tại bàn?'} <a href="${staff?managementUrl:staffUrl}">${staff?'Mở trang quản lý':'Mở app nhân viên'} →</a></p></div></section></main>`;
  const form=root.querySelector('form'), error=root.querySelector('.entry-error'), button=root.querySelector('[type=submit]');
  error.textContent=message;
  root.querySelector('[data-password]').onclick=event=>{const input=form.elements.password;input.type=input.type==='password'?'text':'password';event.target.textContent=input.type==='password'?'Hiện':'Ẩn';event.target.setAttribute('aria-label',input.type==='password'?'Hiện mật khẩu':'Ẩn mật khẩu');};
  form.onsubmit=async event=>{
    event.preventDefault();if(button.disabled)return;
    button.disabled=true;button.textContent='Đang đăng nhập…';error.textContent='';
    try {await submit(form.elements.username.value.trim(),form.elements.password.value);}
    catch(err){error.textContent=err.message;}
    finally{button.disabled=false;button.textContent='Đăng nhập';}
  };
}
