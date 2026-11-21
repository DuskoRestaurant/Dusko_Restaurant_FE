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
  root.innerHTML = `<main class="entry-page"><header><a class="entry-brand" href="${managementUrl}"><img class="dusko-logo" src="/dusko-logo-v1.png" alt="">Dusko Restaurant</a><nav class="entry-destinations" aria-label="Khu vực đăng nhập"><a href="${managementUrl}" ${!staff?'aria-current="page"':''}>Quản lý</a><a href="${staffUrl}" ${staff?'aria-current="page"':''}>Nhân viên</a></nav></header><section class="entry-form-panel"><div class="entry-form-box"><h1>Đăng nhập ${staff?'nhân viên':'quản lý'}</h1><p>Nhập tài khoản để bắt đầu làm việc.</p><form><label>Tên đăng nhập<input name="username" autocomplete="username" required placeholder="Nhập tên đăng nhập" autocapitalize="none" spellcheck="false"></label><label>Mật khẩu<div class="entry-password"><input name="password" type="password" autocomplete="current-password" required placeholder="Nhập mật khẩu"><button type="button" data-password aria-label="Hiện mật khẩu">Hiện</button></div></label><p class="entry-error" role="status" aria-live="polite"></p><button class="entry-submit" type="submit">Đăng nhập</button></form><div class="entry-account-help">Chưa có tài khoản hoặc quên mật khẩu?<br>Liên hệ quản lý nhà hàng để được hỗ trợ.</div></div></section></main>`;
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
