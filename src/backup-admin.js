import { backupStatusHtml, backupSize, backupStates } from './backup-console.js';
import { escapeHtml as e, dateTime } from './api.js';
import { sharedToast } from './toast.js';

const monitorKey='dusko_backup_restore_monitor';
export function readBackupMonitor(){try{const item=JSON.parse(sessionStorage.getItem(monitorKey)||'null');return item&&/^[a-f0-9-]{36}$/.test(item.id)&&/^[a-f0-9]{64}$/.test(item.token)?item:null;}catch{return null;}}
export function clearBackupMonitor(){sessionStorage.removeItem(monitorKey);}
export function mountBackupAdmin({root,request,canCreate=true,pollMs=4000,onAuthError=()=>{}}){
 let disposed=false,timer,loading=false,working=false,dialog,failed=false,data=null,monitor=readBackupMonitor();
 const toast=sharedToast();
 const schedule=()=>{clearTimeout(timer);if(!disposed)timer=setTimeout(()=>void refresh(),pollMs);};
 const renderMonitor=job=>{
  const percent=Math.min(100,Math.max(0,Number(job.progress)||0)),complete=job.state==='COMPLETED',ended=['COMPLETED','FAILED','INTERRUPTED'].includes(job.state);
  root.innerHTML=`<div class="backup-console"><div class="page-head"><div><span class="eyebrow">KHÔI PHỤC DỮ LIỆU</span><h1>${complete?'Đã khôi phục dữ liệu':ended?'Khôi phục cần kiểm tra':'Đang khôi phục dữ liệu'}</h1><p>Trạng thái được theo dõi riêng khi phiên đăng nhập được thay thế.</p></div></div><section class="bk-card bk-running" aria-live="polite"><div class="bk-running-head"><strong>${e(backupStates[job.state]||'Đang xử lý')}</strong><b>${percent}%</b></div><progress class="bk-meter" value="${percent}" max="100" aria-label="Tiến độ khôi phục">${percent}%</progress><p>${e(({VALIDATING:'Kiểm tra bản sao',SAFETY_BACKUP:'Tạo bản sao an toàn',RESTORE_SQL:'Khôi phục PostgreSQL',RESTORE_MONGO_APP:'Khôi phục MongoDB ứng dụng',RESTORE_MONGO_AI:'Khôi phục MongoDB AI',RESTORE_UPLOADS:'Khôi phục ảnh local',VERIFY_RESTORE:'Kiểm tra và thu hồi phiên đăng nhập',COMPLETED:'Hoàn tất'})[job.phase]||'Chuẩn bị')}</p><small>Tiến độ theo công đoạn · tác vụ chạy nền</small>${job.message?`<p class="${complete?'':'bk-error'}">${e(job.message)}</p>`:''}${complete?'<button class="btn primary" data-backup="relogin">Đăng nhập lại</button>':ended&&!job.maintenance?'<button class="btn secondary" data-backup="return">Quay lại kho sao lưu</button>':ended?'<p class="bk-error">Hệ thống giữ chế độ bảo trì. Cần vận hành đối soát dữ liệu trước khi mở lại.</p>':''}</section></div>`;
  return ended;
 };
 async function refresh(){
  if(disposed||loading||working||dialog?.open){schedule();return;}loading=true;let ended=false;
  try{
   if(monitor){const job=await request(`/api/admin/backups/restore-status/${encodeURIComponent(monitor.id)}`,{headers:{'X-Backup-Monitor':monitor.token},cache:'no-store'});if(disposed)return;ended=renderMonitor(job);}
   else{
    const fresh=await request('/api/admin/backups',{cache:'no-store'});if(disposed)return;data=fresh;
    if(!canCreate)data.capability={...data.capability,canCreate:false,canRestore:false,canManageArchives:false,reason:'Cần đăng nhập bằng tài khoản ADMIN có Authenticator.'};
    const focused=root.contains(document.activeElement)?document.activeElement?.dataset?.backup:null;
    const archiveId=document.activeElement?.dataset?.archiveId;
    const scrolls=[...root.querySelectorAll('.table-scroll')].map(el=>el.scrollLeft);
    root.innerHTML=backupStatusHtml(data);root.querySelectorAll('.table-scroll').forEach((el,i)=>{el.scrollLeft=scrolls[i]||0;});
    if(focused){const candidates=[...root.querySelectorAll('[data-backup]')];candidates.find(el=>el.dataset.backup===focused&&(!archiveId||el.dataset.archiveId===archiveId))?.focus({preventScroll:true});}
   }
   failed=false;
  }catch(error){
   if(disposed)return;
   if(monitor&&[401,403,404].includes(error.status)){ended=true;root.innerHTML='<div class="backup-console"><section class="bk-card bk-restore-result"><h2>Phiên theo dõi đã hết hạn</h2><p>Đăng nhập lại để kiểm tra kết quả. Nếu hệ thống còn bảo trì, cần vận hành đối soát dữ liệu.</p><button class="btn primary" data-backup="relogin">Đăng nhập lại</button></section></div>';return;}
   if([401,403].includes(error.status)&&!monitor){onAuthError();return;}
   if(!root.querySelector('.backup-console'))root.innerHTML='<div class="error-panel" role="alert">Không tải được trạng thái. <button class="btn secondary" data-backup="refresh">Thử lại</button></div>';
   root.querySelectorAll('[data-backup]').forEach(el=>{if(!['refresh','relogin','return'].includes(el.dataset.backup))el.disabled=true;});
   if(!failed)toast.error('Chưa cập nhật được trạng thái',error.message);failed=true;
  }finally{loading=false;if(!ended)schedule();}
 }
 function openOperation(kind,id){
  if(disposed||working||dialog?.open||monitor)return;
  const archive=data?.backups?.find(item=>item.id===id),destructive=['restore','delete'].includes(kind);
  if(['restore','delete','download'].includes(kind)&&!archive)return;
  const titles={create:'Tạo bản sao lưu?',restore:'Khôi phục bản sao lưu?',delete:'Xóa bản sao lưu?',download:'Tải bản sao lưu về máy',schedule:'Cấu hình lịch sao lưu'};
  const labels={create:'Xác nhận sao lưu',restore:'Xác nhận khôi phục',delete:'Xóa bản sao lưu',download:'Tải file ZIP',schedule:'Lưu lịch trình'};
  const notices={create:'Sao lưu PostgreSQL, MongoDB và ảnh local vào kho riêng của máy chủ.',restore:'Dữ liệu hiện tại sẽ bị ghi đè. Hệ thống tạo một bản an toàn trước khi khôi phục và tạm dừng nghiệp vụ. Tài khoản và Authenticator cũng trở về thời điểm của bản sao; ảnh cloud không được khôi phục.',delete:'Bản sao lưu này sẽ bị xóa khỏi máy chủ và không thể hoàn tác.',download:'File ZIP chứa dữ liệu của nhà hàng. Chỉ lưu ở nơi bạn kiểm soát.'};
  const selected=data?.schedule||{frequency:'OFF',hour:2,minute:0,weekday:1};
  const settings=kind==='schedule'?`<div class="bk-modal-fields"><label class="field"><span>Tần suất</span><select name="frequency">${[['OFF','Tắt tự động'],['HOURLY','Hằng giờ'],['DAILY','Hằng ngày'],['WEEKLY','Hằng tuần']].map(([value,label])=>`<option value="${value}" ${selected.frequency===value?'selected':''}>${label}</option>`).join('')}</select></label><label class="field" data-day-field><span>Ngày trong tuần</span><select name="weekday">${['Chủ nhật','Thứ hai','Thứ ba','Thứ tư','Thứ năm','Thứ sáu','Thứ bảy'].map((label,i)=>`<option value="${i}" ${selected.weekday===i?'selected':''}>${label}</option>`).join('')}</select></label><label class="field" data-hour-field><span>Giờ (UTC+7)</span><input name="hour" type="number" min="0" max="23" value="${selected.hour??2}" required></label><label class="field" data-minute-field><span>Phút</span><input name="minute" type="number" min="0" max="59" value="${selected.minute??0}" required></label></div><p class="form-help">Theo giờ Việt Nam (UTC+7). Khi máy chủ ngừng hoạt động, lịch quá hạn được chạy một lần khi dịch vụ trở lại.</p>`:'';
  dialog=document.createElement('dialog');const currentDialog=dialog;dialog.className='app-confirm backup-confirm';dialog.setAttribute('aria-labelledby','backup-confirm-title');
  dialog.innerHTML=`<form class="app-confirm__body"><h2 id="backup-confirm-title" class="${destructive?'bk-danger-heading':''}">${titles[kind]}</h2>${notices[kind]?`<p class="${destructive?'bk-modal-notice':''}">${notices[kind]}</p>`:''}${archive?`<p><strong>${e(dateTime(archive.createdAt))}</strong> · ${e(backupSize(archive.bytes))}</p>`:''}${kind==='create'?'<p class="form-help">Không gồm ảnh cloud hoặc source code. SQL/Mongo được lấy tuần tự.</p>':''}${settings}${kind==='restore'?'<label class="field bk-ack"><span><input name="credentialsConfirmed" type="checkbox" required> Tôi có tài khoản ADMIN và Authenticator còn hiệu lực trong bản sao này.</span></label>':''}${destructive?'<label class="field"><span>Nhập CONFIRM để xác nhận</span><input name="confirmation" autocomplete="off" pattern="CONFIRM" required placeholder="CONFIRM"></label>':''}<label class="field"><span>Mã Authenticator mới</span><input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required placeholder="6 chữ số"></label><p class="form-help">Không dùng lại mã vừa đăng nhập hoặc xác nhận thao tác trước.</p><p class="backup-create-error" role="alert" hidden></p><div class="app-confirm__actions"><button class="app-confirm__button" type="button" data-cancel>Hủy</button><button class="app-confirm__button app-confirm__button--${destructive?'danger':'primary'}" type="submit" disabled>${labels[kind]}</button></div></form>`;
  clearTimeout(timer);
  const form=dialog.querySelector('form'),submit=form.querySelector('[type=submit]'),errorBox=form.querySelector('.backup-create-error');
  const validate=()=>{if(kind==='schedule'){const f=form.elements.frequency.value;form.querySelector('[data-day-field]').hidden=f!=='WEEKLY';form.querySelector('[data-hour-field]').hidden=f==='HOURLY'||f==='OFF';form.querySelector('[data-minute-field]').hidden=f==='OFF';}submit.disabled=working||!/^\d{6}$/.test(form.elements.code.value)||(destructive&&form.elements.confirmation.value!=='CONFIRM')||!form.checkValidity();};
  form.addEventListener('input',validate);form.addEventListener('change',validate);validate();
  form.querySelector('[data-cancel]').onclick=()=>{if(!working)currentDialog.close();};
  dialog.addEventListener('cancel',event=>{if(working)event.preventDefault();});
  dialog.addEventListener('click',event=>{if(event.target===currentDialog&&!working)currentDialog.close();});
  dialog.addEventListener('close',()=>{currentDialog.remove();if(dialog===currentDialog)dialog=null;if(!disposed)root.querySelector('[data-backup=create]')?.focus();schedule();},{once:true});
  form.onsubmit=async event=>{
   event.preventDefault();if(working||!form.reportValidity()||destructive&&form.elements.confirmation.value!=='CONFIRM')return;
   const code=form.elements.code.value.trim(),body={code,...(destructive?{confirmation:form.elements.confirmation.value}:{})};
   if(kind==='schedule')body.schedule={frequency:form.elements.frequency.value,hour:Number(form.elements.hour.value),minute:Number(form.elements.minute.value),weekday:Number(form.elements.weekday.value)};
   working=true;submit.disabled=true;submit.textContent=kind==='download'?'Đang tải ZIP…':'Đang gửi…';errorBox.hidden=true;form.elements.code.disabled=true;
   try{
    const path=kind==='create'?'/api/admin/backups':kind==='schedule'?'/api/admin/backups/schedule':`/api/admin/backups/${encodeURIComponent(id)}${kind==='delete'?'':'/'+kind}`;
    if(kind==='restore')body.credentialsConfirmed=form.elements.credentialsConfirmed.checked;
    const result=await request(path,{method:kind==='delete'?'DELETE':'POST',body,...(kind==='download'?{responseType:'blob'}:{})});
    if(disposed)return;
    form.elements.code.value='';
    if(kind==='restore'){monitor={id:result.id,token:result.monitorToken};sessionStorage.setItem(monitorKey,JSON.stringify(monitor));}
    if(kind==='download'){const url=URL.createObjectURL(result),link=document.createElement('a');link.href=url;link.download=`${id}.zip`;link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
    working=false;currentDialog.close();
    if(['create','restore'].includes(kind))toast.info('Đã tiếp nhận yêu cầu',kind==='restore'?'Tác vụ khôi phục đang chạy nền.':'Tác vụ sao lưu đang chạy nền.');
    else toast.success(kind==='delete'?'Đã xóa bản sao lưu':kind==='schedule'?'Đã cập nhật lịch sao lưu':'Đã tải bản sao lưu');
    await refresh();
   }catch(error){if(disposed)return;errorBox.textContent=error.message;errorBox.hidden=false;form.elements.code.value='';}
   finally{working=false;if(dialog===currentDialog){form.elements.code.disabled=false;submit.textContent=labels[kind];validate();form.elements.code.focus();}}
  };
  document.body.append(dialog);dialog.showModal();(destructive?form.elements.confirmation:form.elements.code).focus();
 }
 const click=event=>{
  const button=event.target.closest('[data-backup]');if(!button||button.disabled)return;
  const kind=button.dataset.backup;
  if(kind==='refresh')void refresh();
  else if(kind==='relogin'){clearBackupMonitor();onAuthError();}
  else if(kind==='return'){clearBackupMonitor();monitor=null;void refresh();}
  else if(['create','restore','delete','download','schedule'].includes(kind))openOperation(kind,button.dataset.archiveId);
 };
 root.addEventListener('click',click);const ready=refresh();
 return{ready,destroy(){disposed=true;clearTimeout(timer);root.removeEventListener('click',click);if(dialog){dialog.close();dialog.remove();dialog=null;}}};
}
