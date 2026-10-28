const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=value=>new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND'}).format(value);
export function customerItemStatus(order,item){
  if(order.status==='CANCELLED')return ['cancelled','Đã từ chối'];
  if(order.status==='AWAITING_CONFIRMATION')return ['waiting','Chờ xác nhận'];
  if(item.servedAt)return ['served','Đã lên bàn'];
  if(item.kdsStatus==='DONE')return ['ready','Sẵn sàng'];
  if(item.kdsStatus==='COOKING')return ['cooking','Đang chế biến'];
  return ['waiting','Chờ chế biến'];
}
export function customerOrderHistory(orders){
  if(!orders.length)return '<p class="guest-history-empty">Chưa có lượt gọi món nào trong phiên phục vụ này.</p>';
  return `<div class="guest-order-list">${orders.map(order=>`<article class="tracked-order"><div class="guest-order-heading"><strong>Lượt ${new Date(order.createdAt).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})}</strong><span>${order.status==='PAID'?'Đã thanh toán':order.status==='CANCELLED'?'Đã từ chối':order.status==='AWAITING_CONFIRMATION'?'Chờ xác nhận':'Đã nhận yêu cầu'}</span></div>${order.source==='CUSTOMER_QR'?'':'<small>Nhân viên gọi món</small>'}<ul class="guest-order-items">${(order.items||[]).map(item=>{const [tone,label]=customerItemStatus(order,item);return `<li><div><strong>${escape(item.product?.name||'Món ăn')}</strong><span class="guest-order-quantity">× ${escape(item.quantity)}</span></div><span class="guest-order-status guest-order-status-${tone}">${label}</span></li>`;}).join('')}</ul>${order.status==='CANCELLED'?`<p class="guest-order-reason">${escape(order.note||'Vui lòng hỏi nhân viên để được hỗ trợ.')}</p>`:''}${Number.isFinite(order.finalAmount)?`<div class="guest-order-total"><span>Thành tiền${order.discountAmount?` <small>· Đã giảm ${money(order.discountAmount)}</small>`:''}</span><strong>${money(order.finalAmount)}</strong></div>`:''}</article>`).join('')}</div>`;
}
