import './vnpay-payment.css';

export function showVnpayPayment(payment, request, onPaid = () => {}) {
  const url=new URL(payment.paymentUrl);
  if(url.origin!=='https://sandbox.vnpayment.vn'||url.pathname!=='/paymentv2/vpcpay.html')throw Error('Đường dẫn VNPay Sandbox không hợp lệ');
  if(!String(payment.qrDataUrl).startsWith('data:image/png;base64,'))throw Error('Ảnh QR không hợp lệ');
  const dialog=document.createElement('dialog');dialog.className='vnpay-payment';
  dialog.innerHTML='<button type="button" class="vnpay-close" aria-label="Đóng">×</button><span class="vnpay-badge">VNPAY SANDBOX · THỬ NGHIỆM</span><h2>QR thanh toán VNPay</h2><strong class="vnpay-amount"></strong><img width="300" height="300" alt="QR mở cổng thanh toán VNPay Sandbox"><p>Quét bằng camera để mở cổng VNPay và chọn thanh toán QR thử nghiệm.</p><a target="_blank" rel="noopener noreferrer">Mở VNPay Sandbox ↗</a><p class="vnpay-expiry"></p><p class="vnpay-status" role="status">Đang chờ thanh toán…</p><small>Đóng cửa sổ không hủy giao dịch. Không thu tiền lần hai khi giao dịch đang chờ. Hóa đơn chỉ hoàn tất sau xác nhận từ VNPay.</small>';
  dialog.querySelector('.vnpay-amount').textContent=new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND'}).format(payment.amount);
  dialog.querySelector('img').src=payment.qrDataUrl;
  dialog.querySelector('a').href=url.href;
  dialog.querySelector('.vnpay-expiry').textContent=`Hết hạn lúc ${new Date(payment.expiresAt).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})}`;
  const status=dialog.querySelector('.vnpay-status');
  let stopped=false,busy=false,timer,controller;
  const stop=()=>{stopped=true;clearInterval(timer);controller?.abort();};
  async function poll(){
    if(stopped||busy)return;busy=true;controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),10000);
    try{
      const result=await request(`/api/payments/vnpay/${encodeURIComponent(payment.id)}`,{signal:controller.signal});
      if(stopped)return;
      if(result.status==='SUCCEEDED'){status.textContent='Thanh toán Sandbox thành công. Hóa đơn đã được cập nhật.';stop();await onPaid();}
      else if(result.status==='FAILED'){status.textContent='Giao dịch không thành công hoặc đã hủy. Có thể đóng và tạo yêu cầu mới.';stop();}
      else if(result.status==='EXPIRED'){status.textContent='QR đã hết hạn. Kiểm tra giao dịch tại VNPay trước khi đổi phương thức thanh toán.';stop();}
      else if(result.status==='REVIEW'){status.textContent='VNPay báo đã nhận thanh toán nhưng hóa đơn cần đối soát. Không thu tiền lần hai.';stop();}
      else status.textContent='Đang chờ VNPay xác nhận thanh toán…';
    }catch(error){if(!stopped)status.textContent=`Chưa kiểm tra được trạng thái: ${error.message}. Không thu tiền lần hai.`;}
    finally{busy=false;clearTimeout(timeout);}
  }
  dialog.querySelector('button').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{stop();dialog.remove();},{once:true});
  document.body.append(dialog);dialog.showModal();timer=setInterval(poll,3000);poll();
  return ()=>{stop();if(dialog.open)dialog.close();else dialog.remove();};
}
