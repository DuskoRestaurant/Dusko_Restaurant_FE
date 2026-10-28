const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=value=>new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND'}).format(value);
function statusText(order){
  if(order.status==='AWAITING_CONFIRMATION')return 'Chờ nhân viên xác nhận';
  if(order.status==='CANCELLED')return `Đã từ chối: ${order.note||'Vui lòng hỏi nhân viên'}`;
  const label=item=>item.servedAt?'Đã mang ra bàn':item.kdsStatus==='DONE'?'Sẵn sàng phục vụ':item.kdsStatus==='COOKING'?'Đang chế biến':'Đang chờ chế biến';
  return `${order.status==='PAID'?'Đã thanh toán':'Đã nhận yêu cầu'}${order.items?.length?' · '+order.items.map(item=>`${item.product.name} × ${item.quantity}: ${label(item)}`).join('; '):''}`;
}
export function customerOrderHistory(orders,{open=false}={}){
  if(!orders.length)return '';
  const pending=orders.filter(order=>order.status==='AWAITING_CONFIRMATION').length;
  return `<details class="receipt guest-order-history" ${open?'open':''}><summary><strong>Món đã gọi</strong><span>${orders.length} lượt${pending?` · ${pending} chờ xác nhận`:''}</span></summary><div class="guest-order-list">${orders.map(order=>`<article class="tracked-order"><p>Lượt gọi lúc <b>${new Date(order.createdAt).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})}</b>${order.source==='CUSTOMER_QR'?'':' · nhân viên gọi'}</p>${Number.isFinite(order.finalAmount)?`<p>Thành tiền: <b>${money(order.finalAmount)}</b>${order.discountAmount?` · Đã giảm ${money(order.discountAmount)}`:''}</p>`:''}<p class="tracked-status" data-order-status="${escape(order.id)}">${escape(statusText(order))}</p></article>`).join('')}</div></details>`;
}
