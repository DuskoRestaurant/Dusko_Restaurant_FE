export function customerServiceActions({sessionOpen,requests=[],busyKind=null}) {
  if(!sessionOpen)return '';
  return `<div class="service-actions" aria-label="Hỗ trợ tại bàn">${[['ASSISTANCE','Gọi nhân viên','M12 3a6 6 0 0 0-6 6v4l-2 3h16l-2-3V9a6 6 0 0 0-6-6M10 20h4'],['BILL','Thanh toán','M5 3h14v18l-3-2-4 2-4-2-3 2V3M8 7h8M8 11h8M8 15h4']].map(([kind,label,path])=>{
    const pending=requests.some(request=>request.kind===kind),sending=busyKind===kind;
    return `<button type="button" data-service="${kind}" aria-describedby="service-state-${kind}" ${pending||busyKind?'disabled':''} ${sending?'aria-busy="true"':''}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="${path}" stroke-linecap="round" stroke-linejoin="round"/></svg><span>${label}</span><span class="guest-service-state" aria-hidden="true">${sending?'<span class="guest-action-spinner" aria-hidden="true"></span>':pending?'<span class="guest-service-check" aria-hidden="true">✓</span>':''}</span></button><span id="service-state-${kind}" class="guest-sr-only">${sending?'Đang gửi yêu cầu':pending?'Đã gửi yêu cầu, đang chờ nhân viên':'Gửi yêu cầu hỗ trợ tại bàn'}</span>`;
  }).join('')}</div>`;
}
