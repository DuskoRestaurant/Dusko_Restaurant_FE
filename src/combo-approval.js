import { escapeHtml as e, money } from './api.js';
export async function mountComboApproval(root,api,branchId){
  let busy=false;
  root.refreshLive=async()=>{if(busy)throw Error("busy");await load();};
  async function load(){
    const data=await api(`/api/combos/approval?branchId=${branchId}`);
    if(!root.isConnected)return;
    root.innerHTML=`<h1>Duyệt combo cho khách</h1><p>FP-Growth đề xuất nhóm món. Chỉ combo được admin duyệt mới hiển thị ở trang khách. Giá bằng tổng giá món lẻ, không tự giảm giá.</p><p role="status"></p>${data.combos.map(c=>`<section class="panel"><h2>${c.items.map(i=>e(i.name)).join(' + ')}</h2><p>${money(c.total)} · Mỗi món 1 suất</p><p>${c.approved?'Đang hiển thị cho khách':'Chờ admin duyệt'}</p><button class="btn primary" data-key="${e(c.id)}" data-approve="${!c.approved}">${c.approved?'Ngừng hiển thị':'Duyệt combo'}</button></section>`).join('')||'<p>Chưa có đề xuất phù hợp. Tạo bộ dữ liệu tại mục Luồng FP-Growth.</p>'}${data.saved.filter(s=>s.approved&&!data.combos.some(c=>c.id===s.key)).map(s=>`<section class="panel"><p>Combo đã duyệt trước đây: ${e(s.key)}</p><button class="btn secondary" data-key="${e(s.key)}" data-approve="false">Ngừng hiển thị</button></section>`).join('')}`;
    root.querySelectorAll('[data-key]').forEach(b=>b.onclick=async()=>{if(busy)return;busy=true;b.disabled=true;try{await api('/api/combos/approval',{method:'POST',body:{branchId,key:b.dataset.key,approved:b.dataset.approve==='true'}});await load();}catch(error){root.querySelector('[role=status]').textContent=error.message;b.disabled=false;}finally{busy=false;}});
  }
  try{await load();}catch(error){if(root.isConnected)root.textContent=error.message;}
}
