import { escapeHtml as e, number } from './api.js';
import { productPhoto } from './product-photo.js';

const stations = {WOK_STATION:'Bếp xào',STEAM_STATION:'Bếp hấp',FRY_STATION:'Bếp chiên',BAR_STATION:'Quầy pha chế',COLD_DISH:'Món nguội'};
const staleAfter = 60 * 60 * 1000;
const age = batch => Math.max(0, Date.now() - new Date(batch.scheduledTime).getTime());
export function kitchenAgeText(ms) {
  const minutes=Math.floor(ms/60000);
  if(minutes>=1440)return `${Math.floor(minutes/1440)} ngày ${Math.floor(minutes%1440/60)} giờ`;
  if(minutes>=60)return `${Math.floor(minutes/60)} giờ ${minutes%60} phút`;
  return `${String(minutes).padStart(2,'0')}:${String(Math.floor(ms%60000/1000)).padStart(2,'0')}`;
}
export function kitchenControls(status, station) {
  return `<div class="kitchen-controls"><label>Hiển thị<select id="kitchen-status"><option value="ALL" ${status==='ALL'?'selected':''}>Tất cả món</option><option value="SCHEDULED" ${status==='SCHEDULED'?'selected':''}>Chờ nấu</option><option value="COOKING" ${status==='COOKING'?'selected':''}>Đang nấu</option><option value="STALE" ${status==='STALE'?'selected':''}>Chờ lâu · cần kiểm tra</option></select></label><label>Khu vực<select id="kitchen-station"><option value="ALL">Tất cả khu vực</option>${Object.entries(stations).map(([key,label])=>`<option value="${key}" ${station===key?'selected':''}>${label}</option>`).join('')}</select></label><span>Tự cập nhật mỗi 15 giây</span></div><div id="kds-live" aria-live="polite"></div>`;
}
function ticket(batch) {
  const cooking=batch.status==='COOKING';
  const stale=!cooking&&age(batch)>=staleAfter;
  const destinations=(batch.orderItems||[]).map(item=>`<div class="kt-line"><div class="kt-destination"><strong>${e(item.order?.table?.tableName||'Mang đi')}</strong><span>${number(item.quantity)} suất</span></div>${item.note?`<p class="kt-note">${e(item.note)}</p>`:''}</div>`).join('');
  const codes=[...new Set((batch.orderItems||[]).map(item=>item.order?.orderCode).filter(Boolean))];
  return `<article class="kitchen-ticket ${cooking?'is-cooking':''}" data-batch="${batch.id}"><div class="kt-heading"><h2>${e(batch.product?.name||'Món ăn')}</h2><div class="kt-quantity"><strong>${number(batch.totalQuantity)}</strong><span>suất</span></div></div><div class="kt-meta"><div class="kt-station">${productPhoto(batch.product||{},'kt-photo')}<span>${e(stations[batch.stationType]||batch.stationType)}</span></div><span>${cooking?'Đang nấu':'Chờ nấu'}</span></div><div class="kt-destinations">${destinations||'<p>Chưa có thông tin bàn nhận.</p>'}</div><div class="kt-bottom"><span>Từ lúc nhận <b data-kitchen-time="${e(batch.scheduledTime)}">${kitchenAgeText(age(batch))}</b></span><details><summary>Chi tiết</summary><p>Mã mẻ: ${e(batch.batchCode)}</p>${codes.map(code=>`<p>Lượt: ${e(code)}</p>`).join('')}</details></div><button class="btn ${cooking?'primary':'secondary'} kt-action" data-action="${cooking?'batch-done':'batch-cooking'}" data-id="${batch.id}" data-stale="${stale}">${cooking?'Đã làm xong':'Bắt đầu nấu'}</button></article>`;
}
export function kitchenPanel({batches=[],status='ALL',station='ALL',updated}) {
  const waiting=batches.filter(b=>b.status==='SCHEDULED');
  const cooking=batches.filter(b=>b.status==='COOKING');
  const selected=batches.filter(b=>(station==='ALL'||station===b.stationType)&&(status==='ALL'||status===b.status||status==='STALE'&&b.status==='SCHEDULED'&&age(b)>=staleAfter));
  const groups=[{name:'Chờ nấu',items:selected.filter(b=>b.status==='SCHEDULED'&&age(b)<staleAfter)},{name:'Đang nấu',items:selected.filter(b=>b.status==='COOKING')},{name:'Chờ lâu · cần kiểm tra',items:selected.filter(b=>b.status==='SCHEDULED'&&age(b)>=staleAfter),stale:true}].filter(group=>group.items.length);
  const updatedLabel=updated?new Intl.DateTimeFormat('vi-VN',{hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(updated):'Vừa xong';
  return `<div class="kitchen-statusline"><span><b>${waiting.length}</b> mẻ chờ nấu</span><span><b>${cooking.length}</b> mẻ đang nấu</span><small>Cập nhật ${updatedLabel}</small></div>${groups.length?groups.map(group=>`<section class="kitchen-group"><div class="kg-heading"><h2>${group.name}</h2><span>${group.items.length} mẻ</span></div>${group.stale?'<p class="kitchen-alert">Các mẻ này đã chờ hơn 60 phút. Kiểm tra với nhân viên phục vụ trước khi bắt đầu nấu.</p>':''}<div class="kitchen-grid">${group.items.map(ticket).join('')}</div></section>`).join(''):'<div class="kitchen-empty"><h2>Không có món cần xử lý</h2><p>Món mới tự xuất hiện sau khi nhân viên nhận yêu cầu. Kiểm tra bộ lọc nếu bạn đang tìm một món cụ thể.</p></div>'}`;
}
