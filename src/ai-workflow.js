import {escapeHtml as e} from './api.js';
const number = value => new Intl.NumberFormat('vi-VN', {maximumFractionDigits: 3}).format(Number(value) || 0);
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
 return `<p><strong>${rows.filter(row=>row.suggestedOrderQty>0).length} nguyên liệu cần bổ sung</strong> · Chưa phát sinh nhập kho hoặc đặt mua.</p><div class="ai-table-scroll"><table><thead><tr><th>Nguyên liệu</th><th>Cần cho món</th><th>Tồn khả dụng</th><th>Tồn an toàn</th><th>Cần mua thêm</th><th>Trạng thái</th></tr></thead><tbody>${rows.map(row=>`<tr><td>${e(row.ingredient.name)}</td><td>${number(row.grossDemand)} ${e(row.ingredient.unit)}</td><td>${number(row.currentStock)} ${e(row.ingredient.unit)}</td><td>${number(row.safetyStock)} ${e(row.ingredient.unit)}</td><td><strong>${number(row.suggestedOrderQty)} ${e(row.ingredient.unit)}</strong></td><td>${row.approvedByUser?'Đã duyệt':'Chờ xem xét'}</td></tr>`).join('')}</tbody></table></div>${rows.map(row=>`<details class="ai-evidence"><summary>Vì sao cần mua ${number(row.suggestedOrderQty)} ${e(row.ingredient.unit)} ${e(row.ingredient.name)}?</summary><p>max(0, ${number(row.grossDemand)} nhu cầu + ${number(row.safetyStock)} tồn an toàn − ${number(row.currentStock)} tồn khả dụng) = ${number(row.suggestedOrderQty)} ${e(row.ingredient.unit)}. Tồn khả dụng đã trừ phần giữ cho đơn chưa thanh toán.</p>${row.explanation?.sources?`<ul>${row.explanation.sources.map(item=>`<li>${e(item.productName)}: ${number(item.portions)} suất × ${number(item.recipeQuantity)} ${e(row.ingredient.unit)}/suất ÷ (1 − ${number(item.wasteRate)}) = ${number(item.demand)} ${e(row.ingredient.unit)}.</li>`).join('')}</ul><p>Cộng nhu cầu của các món, làm tròn tổng đến 3 chữ số thập phân trước khi tính lượng mua.</p>`:'<p>Kế hoạch lưu trước đó chưa có phân rã theo món trong phản hồi này; các số trên là số đã lưu, không tính lại từ công thức mới.</p>'}</details>`).join('')}`;
}
