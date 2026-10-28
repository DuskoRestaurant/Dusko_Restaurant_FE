import {readStoredJson,tryStoreJson} from '../../src/browser-storage.js';
export function createRecognition({token,request,getSessionId,onVerified}) {
  const storage={getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)};
  const key=`dusko-customer-mode:${token}`;
  let mode=readStoredJson(storage,key,'guest',value=>['guest','new','returning'].includes(value)),verified=null,sessionId=null,pollTimer=null,pending=false,expanded=false,phone='',fullName='',message='';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const checkSession=()=>{const current=getSessionId?.();if(current!==sessionId){sessionId=current;verified=null;phone='';fullName='';message='';if(pollTimer){clearInterval(pollTimer);pollTimer=null;}}};
  function render(){
    checkSession();const holder=document.querySelector('#customer-recognition');if(!holder)return;
    holder.innerHTML=`<details class="customer-recognition" ${expanded?'open':''}><summary>${verified?'Thành viên đã được xác nhận':'Ưu đãi thành viên · Không bắt buộc'}</summary><p>Bạn có thể chọn món và gửi yêu cầu mà không cần đăng ký.</p>${verified?`<p>Xin chào <strong>${esc(verified.maskedName)}</strong> · ${esc(verified.tierName||'Khách quen')}</p>${verified.promotions?.length?`<ul>${verified.promotions.map(p=>`<li>${esc(p.name)} (${esc(p.code)})</li>`).join('')}</ul>`:''}`:`<div class="recognition-choices">${[['returning','Khách quen'],['new','Đăng ký thành viên'],['guest','Bỏ qua']].map(([id,label])=>`<button type="button" data-rec-mode="${id}" aria-pressed="${mode===id}">${label}</button>`).join('')}</div>${mode!=='guest'?`<form>${mode==='new'?`<label>Họ tên<input name="fullName" value="${esc(fullName)}" required maxlength="100" autocomplete="name"></label>`:''}<label>Số điện thoại<input name="phone" value="${esc(phone)}" type="tel" inputmode="tel" required maxlength="20" autocomplete="tel"></label><button type="submit" ${pending?'disabled':''}>${mode==='new'?'Đăng ký':'Tra cứu'}</button></form>`:''}`}<p role="status" data-rec-message>${esc(message)}</p></details>`;
    const details=holder.querySelector('details');details.ontoggle=()=>{expanded=details.open;};
    holder.querySelectorAll('[data-rec-mode]').forEach(button=>button.onclick=()=>{mode=button.dataset.recMode;tryStoreJson(storage,key,mode);message='';render();});
    holder.querySelector('form')?.addEventListener('input',event=>{if(event.target.name==='phone')phone=event.target.value;if(event.target.name==='fullName')fullName=event.target.value;});
    holder.querySelector('form')?.addEventListener('submit',async event=>{
      event.preventDefault();if(pending)return;pending=true;const current=sessionId;message='Đang xử lý…';render();
      try{
        const register=mode==='new';const data=await request(`/api/public/tables/${token}/customer/${register?'register':'lookup'}`,{method:'POST',body:JSON.stringify(register?{phone,fullName}:{phone})});
        if(current!==getSessionId?.())return;
        message=register?'Đã đăng ký. Nhờ nhân viên xác nhận tại bàn để nhận ưu đãi.':data.exists?`Tìm thấy ${data.maskedName} · ${data.phone}. Nhờ nhân viên xác nhận tại bàn.`:'Chưa tìm thấy khách. Bạn vẫn có thể gọi món hoặc đăng ký thành viên.';
        if(register||data.exists){startPoll();pollVerified();}
      }catch(error){message=error.message;}finally{pending=false;render();}
    });
  }
  async function pollVerified(){
    checkSession();const current=sessionId;if(!current)return;
    try{const data=await request(`/api/public/tables/${token}/customer`);if(current!==getSessionId?.())return;
      const next=data?.verified?data:null;if(JSON.stringify(next)!==JSON.stringify(verified)){verified=next;message=next?'Đã xác nhận tại bàn. Ưu đãi áp dụng theo điều kiện của nhà hàng.':'';onVerified?.(next);render();}
    }catch(error){const holder=document.querySelector('[data-rec-message]');if(holder)holder.textContent=`Chưa cập nhật được thành viên: ${error.message}`;}
  }
  function startPoll(){if(!pollTimer)pollTimer=setInterval(pollVerified,15000);}
  return {render,pollVerified,startPoll,get verified(){return verified;},destroy(){clearInterval(pollTimer);pollTimer=null;}};
}
