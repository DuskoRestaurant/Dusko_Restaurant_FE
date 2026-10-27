import {watchChanges} from './live-updates.js';
import {escapeHtml as e} from './api.js';
import './kitchen-workspace.css';

export function mountKitchen({root,request,branchId,pollMs=15000}) {
  let disposed=false,pending=null,busy=false,again=false,batches=[],finished=[],filter='SCHEDULED',updated=null,live=false,failed=false;
  const controller=new AbortController();
  root.innerHTML='<section class="kw-workspace"><div class="kw-heading"><div><h2>Nhà bếp</h2><p>Món, số lượng và bàn nhận trong từng mẻ nấu.</p></div><button type="button" data-kw-refresh>Làm mới</button></div><p data-kw-sync role="status"></p><p data-kw-error role="alert" hidden></p><div class="kw-tabs" aria-label="Trạng thái mẻ bếp"></div><div class="kw-list"></div></section>';
  const status=root.querySelector('[data-kw-sync]'), error=root.querySelector('[data-kw-error]');
  const sync=()=>{status.textContent=`${failed?'Chưa cập nhật được dữ liệu':live?'Đang kết nối trực tiếp':'Cập nhật dự phòng mỗi 15 giây'}${updated?` · Lần cuối ${updated.toLocaleTimeString('vi-VN')}`:''}`;};
  function render(){
    const tabs=[['SCHEDULED','Chờ làm'],['COOKING','Đang làm'],['COMPLETED','Đã hoàn thành']];
    root.querySelector('.kw-tabs').innerHTML=tabs.map(([id,label])=>`<button type="button" data-kw-filter="${id}" aria-pressed="${filter===id}">${label} <b>${id==='COMPLETED'?finished.length:batches.filter(b=>b.status===id).length}</b></button>`).join('');
    const selected=filter==='COMPLETED'?finished:batches.filter(b=>b.status===filter);
    root.querySelector('.kw-list').innerHTML=(filter==='COMPLETED'?'<p class="kw-history-note">Các mẻ hoàn thành trong lần mở màn hình này (tối đa 30 mẻ).</p>':'')+(selected.map(batch=>`<article class="kw-ticket"><div class="kw-ticket-heading"><h3>${e(batch.product?.name||'Món ăn')}</h3><strong>${batch.totalQuantity} suất</strong></div><p>Mẻ ${e(batch.batchCode||batch.id)} · ${e({SCHEDULED:'Chờ làm',COOKING:'Đang làm',COMPLETED:'Đã hoàn thành'}[batch.status])}</p><ul>${(batch.orderItems||[]).map(item=>`<li><strong>${e(item.order?.table?.tableName||'Mang đi')} · ${item.quantity} suất${item.isGift?' · Quà tặng':''}</strong>${item.note?`<p>${e(item.note)}</p>`:''}</li>`).join('')}</ul>${batch.status!=='COMPLETED'?`<button type="button" data-kw-batch="${batch.id}" data-next="${batch.status==='SCHEDULED'?'COOKING':'COMPLETED'}" ${busy?'disabled':''}>${batch.status==='SCHEDULED'?'Bắt đầu nấu':'Đã làm xong'}</button>`:''}</article>`).join('')||'<p class="kw-empty">Không có mẻ ở trạng thái này. Món mới sẽ tự cập nhật.</p>');
    sync();
  }
  function refresh(){
    if(disposed)return Promise.resolve();
    if(busy){again=true;return Promise.resolve();}
    if(pending){again=true;return pending;}
    pending=(async()=>{
      try{
        const data=await request(`/api/kds/batches?branchId=${branchId}`,{signal:controller.signal});
        if(disposed)return;
        batches=data;updated=new Date();if(failed)error.hidden=true;failed=false;render();
      }catch(err){if(disposed)return;failed=true;error.textContent=`${err.message} Dữ liệu cũ vẫn được giữ lại. Nhấn Làm mới để thử lại.`;error.hidden=false;sync();}
      finally{pending=null;if(again&&!disposed&&!busy){again=false;refresh();}}
    })();return pending;
  }
  root.onclick=async event=>{
    const button=event.target.closest('button');if(!button||disposed)return;
    if(button.hasAttribute('data-kw-refresh')){error.hidden=true;return refresh();}
    if(button.dataset.kwFilter){filter=button.dataset.kwFilter;render();return;}
    if(!button.dataset.kwBatch||busy)return;
    busy=true;if(pending)await pending;if(disposed)return;
    const batch=batches.find(b=>String(b.id)===button.dataset.kwBatch);if(!batch){busy=false;return refresh();}
    render();error.hidden=true;
    try{
      await request(`/api/kds/batches/${batch.id}/status`,{method:'PATCH',body:{branchId,status:button.dataset.next},signal:controller.signal});
      if(disposed)return;
      if(button.dataset.next==='COMPLETED')finished=[{...batch,status:'COMPLETED'},...finished.filter(b=>b.id!==batch.id)].slice(0,30);
    }catch(err){if(!disposed){error.textContent=err.message;error.hidden=false;}}
    finally{busy=false;if(!disposed){render();refresh();}}
  };
  const stopLive=watchChanges(request,refresh,'/api/live',{onEvent:refresh,onStatus:connected=>{live=connected;if(!disposed)sync();}});
  const timer=setInterval(()=>{if(!document.hidden)refresh();},pollMs);
  const onVisible=()=>{if(!document.hidden)refresh();};document.addEventListener('visibilitychange',onVisible);
  render();refresh();
  return {destroy(){disposed=true;controller.abort();stopLive();clearInterval(timer);document.removeEventListener('visibilitychange',onVisible);root.onclick=null;}};
}
