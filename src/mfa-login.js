import './mfa-login.css';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const trustedKey=username=>`dusko_trusted_device_${username}`;
export function getTrustedDevice(username){try{const raw=localStorage.getItem(trustedKey(username));if(!raw)return null;const data=JSON.parse(raw);if(!data.token||!data.expiresAt||new Date(data.expiresAt)<=new Date()){localStorage.removeItem(trustedKey(username));return null;}return data;}catch{localStorage.removeItem(trustedKey(username));return null;}}
export function setTrustedDevice(username,token,expiresAt){try{localStorage.setItem(trustedKey(username),JSON.stringify({token,expiresAt}));}catch{}}
export function clearTrustedDevice(username){try{localStorage.removeItem(trustedKey(username));}catch{}}
export async function forgetTrustedDevice(request,username){const stored=getTrustedDevice(username);if(stored){try{await request('/api/auth/trusted-device',{method:'DELETE',body:{trustedDeviceToken:stored.token}});}catch{}}clearTrustedDevice(username);}
export async function completeMfaLogin(result,request,username){
 if(!result.mfaRequired)return result;
 const setup=result.setupRequired?await request('/api/auth/mfa/setup',{method:'POST',body:{challengeToken:result.challengeToken}}):null;
 return new Promise((resolve,reject)=>{
  const dialog=document.createElement('dialog');dialog.className='mfa-dialog';dialog.setAttribute('aria-labelledby','mfa-title');let done=false,recovery=false;
  dialog.innerHTML=`<button type="button" data-close class="mfa-close" aria-label="Đóng">×</button><span class="mfa-kicker">BẢO VỆ TÀI KHOẢN QUẢN TRỊ</span><h2 id="mfa-title">${setup?'Thiết lập Authenticator':'Xác thực hai bước'}</h2>${setup?`<p>Mở Google Authenticator hoặc Microsoft Authenticator, chọn thêm tài khoản và quét mã QR bên dưới.</p><img alt="QR liên kết Authenticator" width="240" height="240"><details><summary>Không quét được mã QR?</summary><p>Chọn nhập khóa thiết lập trong ứng dụng:</p><code class="mfa-secret"></code></details><p>Nhập mã 6 số đang hiển thị để xác nhận thiết lập.</p>`:'<p>Nhập mã 6 số trong ứng dụng Authenticator để tiếp tục vào quản trị.</p>'}<form><label data-code-label>Mã Authenticator<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" minlength="6" maxlength="6" required autofocus></label><label class="mfa-trust"><input name="trustDevice" type="checkbox"> Lưu thiết bị này trong 1 ngày (chỉ dùng trên thiết bị cá nhân)</label><p class="mfa-error" role="status"></p><button type="submit" class="btn">${setup?'Xác nhận và bật xác thực':'Xác thực'}</button></form>${!setup?'<button type="button" data-recovery class="mfa-link">Dùng mã khôi phục</button>':''}<p class="mfa-help">Phiên xác thực có hiệu lực 5 phút. Bật ngày giờ tự động trên điện thoại. Mỗi mã chỉ dùng một lần. Thiết bị đã lưu hết hạn sau đúng 24 giờ và không tự gia hạn.</p>`;
  if(setup){dialog.querySelector('img').src=setup.qrDataUrl;dialog.querySelector('code').textContent=setup.secret;}
  const form=dialog.querySelector('form'),input=form.elements.code,submit=form.querySelector('[type=submit]'),error=dialog.querySelector('.mfa-error');
  dialog.querySelector('[data-close]').onclick=()=>dialog.close();
  dialog.querySelector('[data-recovery]')?.addEventListener('click',event=>{recovery=!recovery;input.value='';input.type='text';input.inputMode=recovery?'text':'numeric';input.minLength=recovery?16:6;input.maxLength=recovery?32:6;input.pattern=recovery?'[A-Fa-f0-9 -]{16,32}':'[0-9]{6}';event.target.textContent=recovery?'Dùng mã Authenticator':'Dùng mã khôi phục';dialog.querySelector('[data-code-label]').firstChild.textContent=recovery?'Mã khôi phục dùng một lần':'Mã Authenticator';const trust=form.elements.trustDevice;if(trust){trust.disabled=recovery;if(recovery)trust.checked=false;}input.focus();});
  form.onsubmit=async event=>{
   event.preventDefault();if(submit.disabled)return;submit.disabled=true;error.textContent='';
   try{
    const verified=await request('/api/auth/mfa/verify',{method:'POST',body:{challengeToken:result.challengeToken,code:input.value.trim(),trustDevice:!recovery&&!!form.elements.trustDevice?.checked}});
    if(username&&verified.trustedDeviceToken&&verified.trustedDeviceExpiresAt)setTrustedDevice(username,verified.trustedDeviceToken,verified.trustedDeviceExpiresAt);
    if(!dialog.isConnected)return;
    if(verified.recoveryCodes){
     dialog.innerHTML=`<span class="mfa-kicker">THIẾT LẬP THÀNH CÔNG</span><h2>Lưu mã khôi phục</h2><p>Dùng khi mất điện thoại. Mỗi mã dùng một lần cùng mật khẩu đăng nhập. Các mã chỉ hiển thị tại bước này.</p><div class="mfa-recovery-codes">${verified.recoveryCodes.map(code=>`<code>${escape(code)}</code>`).join('')}</div><button type="button" data-download class="btn secondary">Tải mã khôi phục</button><label class="mfa-ack"><input type="checkbox"> Tôi đã lưu mã ở nơi an toàn</label><button type="button" data-continue class="btn" disabled>Tiếp tục vào hệ thống</button>`;
     dialog.querySelector('[data-download]').onclick=()=>{const url=URL.createObjectURL(new Blob(['DUSKO - MÃ KHÔI PHỤC XÁC THỰC\nMỗi mã dùng một lần. Không chia sẻ.\n\n'+verified.recoveryCodes.join('\n')],{type:'text/plain;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='Dusko-ma-khoi-phuc.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
     dialog.querySelector('input').onchange=event=>dialog.querySelector('[data-continue]').disabled=!event.target.checked;
     dialog.querySelector('[data-continue]').onclick=()=>{done=true;dialog.close();dialog.remove();resolve(verified);};
    }else{done=true;dialog.close();dialog.remove();resolve(verified);}
   }catch(err){if(dialog.isConnected){error.textContent=err.message;input.value='';input.focus();}}
   finally{submit.disabled=false;}
  };
  dialog.addEventListener('close',()=>{dialog.remove();if(!done)reject(Error('Đã hủy xác thực. Vui lòng đăng nhập lại khi sẵn sàng.'));},{once:true});document.body.append(dialog);dialog.showModal();input.focus();
 });
}
export async function authenticatorLogin(request,username,password){
 const stored=getTrustedDevice(username);
 const result=await request('/api/auth/login',{method:'POST',body:{username,password,...(stored?{trustedDeviceToken:stored.token}:{})}});
 if(result.token&&!result.mfaRequired)return {token:result.token,user:result.user};
 if(stored&&result.mfaRequired)clearTrustedDevice(username);
 const verified=await completeMfaLogin(result,request,username);
 return {token:verified.token,user:verified.user};
}
export function reconfigureAuthenticator(request,onDone){
 const dialog=document.createElement('dialog');dialog.className='mfa-dialog';dialog.innerHTML='<button type="button" data-close class="mfa-close" aria-label="Đóng">×</button><h2>Đổi ứng dụng Authenticator</h2><p>Xác nhận mật khẩu và mã Authenticator hiện tại hoặc một mã khôi phục. Thiết lập cũ vẫn hoạt động cho đến khi bạn quét và xác nhận khóa mới.</p><form><label>Mật khẩu hiện tại<input name="password" type="password" autocomplete="current-password" required></label><label>Mã Authenticator hoặc mã khôi phục<input name="code" autocomplete="one-time-code" required maxlength="32"></label><p class="mfa-error" role="status"></p><button type="submit" class="btn">Thiết lập lại</button></form>';
 dialog.querySelector('[data-close]').onclick=()=>dialog.close();
 dialog.querySelector('form').onsubmit=async event=>{event.preventDefault();const form=event.target,button=form.querySelector('button');button.disabled=true;try{const challenge=await request('/api/auth/mfa/reset',{method:'POST',body:{password:form.elements.password.value,code:form.elements.code.value.trim()}});dialog.close();await completeMfaLogin(challenge,request);onDone();}catch(error){if(dialog.isConnected)dialog.querySelector('[role=status]').textContent=error.message;else onDone();}finally{button.disabled=false;}};
 dialog.addEventListener('close',()=>dialog.remove(),{once:true});document.body.append(dialog);dialog.showModal();
}
