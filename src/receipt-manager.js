import {showReceipt} from './receipt.js';
import './receipt-manager.css';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const money=value=>new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND'}).format(value||0);
const date=value=>new Date(value).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'});

export function mountReceiptManager({root,request,branchId}) {
  let disposed=false, sequence=0, page=1, items=[], closeReceipt;
  const filters={q:'',from:'',to:''};
  root.innerHTML=`<div class="rm-manager"><div class="rm-heading"><div><h2>Quản lý hóa đơn</h2><p>Tra cứu hóa đơn đã phát hành, xem chi tiết và in lại.</p></div><button type="button" data-rm-refresh>Làm mới</button></div><form class="rm-filters"><label>Tìm hóa đơn<input name="q" type="search" maxlength="100" placeholder="Mã hóa đơn hoặc tên bàn"></label><label>Từ ngày<input name="from" type="date"></label><label>Đến ngày<input name="to" type="date"></label><button type="submit">Tìm kiếm</button><button type="button" data-rm-reset>Xóa lọc</button></form><p data-rm-status role="status"></p><div data-rm-results></div><div class="rm-pagination"><button type="button" data-rm-prev>← Trước</button><span data-rm-page></span><button type="button" data-rm-next>Sau →</button></div></div>`;
  const status=root.querySelector('[data-rm-status]'), results=root.querySelector('[data-rm-results]');
  const form=root.querySelector('form'), previous=root.querySelector('[data-rm-prev]'), next=root.querySelector('[data-rm-next]');
  async function load() {
    const current=++sequence;
    previous.disabled=next.disabled=true;
    status.textContent='Đang tải hóa đơn…';
    results.setAttribute('aria-busy','true');
    results.innerHTML='';items=[];
    try {
      const params=new URLSearchParams({branchId:String(branchId),page:String(page),...filters});
      const data=await request(`/api/receipts/history?${params}`);
      if(disposed||current!==sequence)return;
      const pages=Math.max(1,Math.ceil(data.total/data.pageSize));
      if(page>pages){page=pages;return load();}
      items=data.items;
      status.textContent=`${data.total} hóa đơn${filters.q||filters.from||filters.to?' phù hợp bộ lọc':''} · Chi nhánh ${branchId}`;
      results.innerHTML=items.length?`<div class="rm-list">${items.map((receipt,index)=>{const bill=receipt.snapshot;return `<button type="button" class="rm-row" data-rm-open="${index}"><span class="rm-reference"><strong>${escape(bill.code)}</strong><small>${escape(date(bill.issuedAt))}</small></span><span>${escape(bill.tableName)}<small>${escape(bill.staffName||bill.cashier)}</small></span><span class="rm-amount"><strong>${money(bill.total)}</strong><small>Xem chi tiết →</small></span></button>`;}).join('')}</div>`:'<div class="rm-empty"><h3>Không có hóa đơn</h3><p>Chưa phát hành hóa đơn hoặc không có kết quả phù hợp. Hãy thử đổi bộ lọc.</p></div>';
      root.querySelector('[data-rm-page]').textContent=`Trang ${page} / ${pages}`;
      previous.disabled=page===1;next.disabled=page>=pages;
    }catch(error){if(disposed||current!==sequence)return;status.textContent=`Không tải được hóa đơn: ${error.message}. Nhấn Làm mới để thử lại.`;root.querySelector('[data-rm-page]').textContent='';}
    finally{if(!disposed&&current===sequence)results.removeAttribute('aria-busy');}
  }
  form.onsubmit=event=>{event.preventDefault();const fields=new FormData(form);for(const key of Object.keys(filters))filters[key]=fields.get(key).trim();if(filters.from&&filters.to&&filters.from>filters.to){status.textContent='Ngày bắt đầu phải trước ngày kết thúc.';return;}page=1;load();};
  root.querySelector('[data-rm-refresh]').onclick=()=>load();
  root.querySelector('[data-rm-reset]').onclick=()=>{form.reset();for(const key of Object.keys(filters))filters[key]='';page=1;load();};
  previous.onclick=()=>{page--;load();};next.onclick=()=>{page++;load();};
  results.onclick=event=>{const button=event.target.closest('[data-rm-open]');if(button){closeReceipt?.();closeReceipt=showReceipt(items[Number(button.dataset.rmOpen)]);}};
  load();
  return {destroy(){disposed=true;++sequence;closeReceipt?.();root.replaceChildren();}};
}
