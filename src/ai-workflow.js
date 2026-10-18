import {escapeHtml as e,money,number} from './api.js';
export function forecastSummary(rows){
 return {dishes:rows.length,portions:rows.reduce((sum,row)=>sum+Number(row.predictedQuantity||0),0),learned:rows.filter(row=>row.modelType==='LSTM').length,historical:rows.filter(row=>row.modelType!=='LSTM').length};
}
export function showAiActionResult(title,intro,content,onNext,nextLabel){
 const dialog=document.createElement('dialog');dialog.className='ai-action-dialog';
 dialog.innerHTML=`<header><h2>${e(title)}</h2><button type="button" data-close aria-label="Đóng">×</button></header><p>${e(intro)}</p>${content}<div class="ai-next-actions"><button type="button" class="btn secondary" data-close>Đóng</button>${onNext?`<button type="button" class="btn" data-next>${e(nextLabel)}</button>`:''}</div>`;
 dialog.querySelectorAll('[data-close]').forEach(button=>button.onclick=()=>dialog.close());
 if(onNext)dialog.querySelector('[data-next]').onclick=()=>{dialog.close();onNext();};
 dialog.addEventListener('close',()=>dialog.remove(),{once:true});document.body.append(dialog);dialog.showModal();
}
export function ingredientPlanMarkup(rows){
 if(!rows.length)return '<p>Chưa có nguyên liệu trong dự trù. Kiểm tra công thức món và kết quả dự báo.</p>';
 return `<p><strong>${rows.filter(row=>row.suggestedOrderQty>0).length} nguyên liệu cần bổ sung</strong> · Chưa phát sinh nhập kho hoặc đặt mua.</p><div class="ai-table-scroll"><table><thead><tr><th>Nguyên liệu</th><th>Cần cho món</th><th>Cần mua thêm</th><th>Trạng thái</th></tr></thead><tbody>${rows.map(row=>`<tr><td>${e(row.ingredient.name)}</td><td>${number(row.grossDemand)} ${e(row.ingredient.unit)}</td><td><strong>${number(row.suggestedOrderQty)} ${e(row.ingredient.unit)}</strong></td><td>${row.approvedByUser?'Đã duyệt':'Chờ xem xét'}</td></tr>`).join('')}</tbody></table></div>`;
}
export function reviewDayMarkup(report){
 return `<div class="ai-summary"><span>${report.orderCount} đơn đã thanh toán</span><span>Doanh thu thuần: <b>${money(report.netRevenue)}</b></span><span>Giảm giá: <b>${money(report.discountTotal)}</b></span></div><p>Đối chiếu số tiền, giảm giá và hoạt động thực tế trong ngày. Kết quả cảnh báo chưa xác định nguyên nhân.</p><div class="ai-table-scroll"><table><thead><tr><th>Hóa đơn</th><th>Thời gian (UTC+7)</th><th>Giảm giá</th><th>Thanh toán</th><th>Nguồn</th></tr></thead><tbody>${report.orders.map(order=>`<tr><td>${e(order.orderCode)}</td><td>${e(new Date(order.createdAt).toLocaleTimeString('vi-VN',{timeZone:'Asia/Bangkok',hour:'2-digit',minute:'2-digit'}))}</td><td>${money(order.discountAmount)}</td><td>${money(order.finalAmount)}</td><td>${order.dataOrigin==='REAL'?'Đơn thật':'Đơn mô phỏng'}</td></tr>`).join('')}</tbody></table></div>`;
}
