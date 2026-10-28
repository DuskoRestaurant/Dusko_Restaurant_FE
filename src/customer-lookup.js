import {escapeHtml as e} from './api.js';
export function mountCustomerLookup({root,request,branchId}) {
  let disposed=false;
  root.innerHTML='<section class="customer-lookup"><h2>Khách hàng</h2><p>Tra cứu hoặc đăng ký khách. Để áp dụng ưu đãi tại bàn, vào chi tiết bàn và chọn Gắn khách hàng.</p><form><label>Số điện thoại<input name="phone" type="tel" autocomplete="tel" required maxlength="20" placeholder="09xx xxx xxx"></label><button type="submit">Tra cứu</button></form><div data-customer-result role="status"></div><details><summary>Đăng ký khách mới</summary><form data-register><label>Họ tên<input name="fullName" required maxlength="100" autocomplete="name"></label><label>Số điện thoại<input name="phone" type="tel" required maxlength="20" autocomplete="tel"></label><button type="submit">Đăng ký</button></form></details></section>';
  const result=root.querySelector('[data-customer-result]');
  root.querySelectorAll('form').forEach(form=>form.onsubmit=async event=>{
    event.preventDefault();const button=form.querySelector('button');if(button.disabled)return;button.disabled=true;result.textContent='Đang xử lý…';
    const values=Object.fromEntries(new FormData(form));
    try{const register=form.hasAttribute('data-register');const data=await request(register?'/api/customers':'/api/customers/lookup',{method:'POST',body:{branchId,...values}});if(disposed)return;
      result.innerHTML=register?'Đã đăng ký khách. Mở bàn để gắn khách hàng nếu cần.':data.exists?`<p><strong>${e(data.maskedName)}</strong> · ${e(data.phone)}</p><p>Hạng: ${e(data.tierName||'Chưa có hạng')}</p>`:'Chưa tìm thấy khách ở chi nhánh này.';
    }catch(error){if(!disposed)result.textContent=error.message;}finally{button.disabled=false;}
  });
  return {destroy(){disposed=true;root.replaceChildren();}};
}
