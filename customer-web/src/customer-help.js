import './customer-help.css';
const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = n => new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND'}).format(n);
export function createCustomerHelp({token,request,getState,addCombo,api,cartLines}) {
  let combos=[], loaded=false;
  async function loadCombos(strict=false){
    try { const response=await request(`/api/public/tables/${token}/combos`);combos=response.combos;loaded=true;renderCombos(); }
    catch(error) { if(strict)throw error;const root=document.querySelector('#customer-combos');if(root)root.textContent='Gợi ý combo tạm chưa sẵn sàng. Bạn vẫn có thể chọn món trong thực đơn.'; }
  }
  function renderCombos(){
    const root=document.querySelector('#customer-combos');if(!root)return;
    if(!loaded){root.textContent='Đang tìm combo phù hợp…';return;}
    const state=getState();
    const current=combos.map(c=>({...c,items:c.items.map(i=>({...i,...state.data.products.find(p=>p.id===i.id)}))})).filter(c=>c.items.every(i=>i.canOrder));
    root.innerHTML=`<h2>Gợi ý combo cho bàn bạn</h2><p>Các món thường được gọi cùng nhau. Mỗi món 1 suất, giá ưu đãi khi đặt trọn combo.</p>${current.length?`<div class="combo-grid">${current.map(c=>`<article class="combo-card"><div class="combo-images">${c.items.filter(i=>i.imageUrl).map(i=>`<img src="${escape(i.imageUrl.startsWith('http')?i.imageUrl:api+i.imageUrl)}" alt="${escape(i.name)}" loading="lazy">`).join('')}</div><h3>${c.items.map(i=>escape(i.name)).join(' + ')}</h3><strong>${money(c.price)}</strong><del>${money(c.originalTotal)}</del><small>Tiết kiệm ${money(c.discountAmount)}</small><button type="button" data-combo="${escape(c.id)}" ${!state.data.sessionOpen||state.busy?'disabled':''}>Thêm combo vào giỏ</button></article>`).join('')}</div>`:'<p>Chưa có combo phù hợp với các món còn sẵn. Bạn chọn món riêng trong thực đơn nhé.</p>'}<p class="combo-message" role="status"></p>`;
    root.querySelectorAll('[data-combo]').forEach(button=>button.onclick=()=>{
      const combo=current.find(c=>c.id===button.dataset.combo);
      const state=getState();
      if(!state.data.sessionOpen||state.busy)return;
      const basket=cartLines?cartLines():new Map();
      const valid=combo.items.every(i=>{const p=state.data.products.find(p=>p.id===i.id);return p?.canOrder&&(basket.get(i.id)||0)+1<=Math.min(1000,p.maxOrderQuantity??1000);});
      root.querySelector('.combo-message').textContent=valid?'Đang thêm combo vào giỏ…':'Số lượng vượt mức còn sẵn. Vui lòng điều chỉnh giỏ hoặc hỏi nhân viên.';
      if(valid)addCombo(combo);
    });
  }
  const host=document.createElement('aside');host.className='restaurant-help';document.body.append(host);
  host.innerHTML=`<button class="help-toggle" aria-expanded="false" aria-controls="restaurant-chat">Hỏi Dusko</button><section id="restaurant-chat" hidden><div class="help-heading"><h2>Trợ lý nhà hàng</h2><button class="help-close" aria-label="Đóng chat">×</button></div><p class="help-disclosure">Hỗ trợ bởi Gemini. Câu hỏi, thực đơn và tên nguyên liệu được gửi tới Google để trả lời. Không gửi thông tin cá nhân.</p><div class="help-messages" role="log" aria-live="polite"><p class="answer">Bạn đang phân vân chọn món? Tôi có thể giải thích nguyên liệu của món, gợi ý theo số người, ngân sách, combo đã duyệt hoặc hướng dẫn yêu cầu phục vụ. Hãy ghi đầy đủ nhu cầu trong mỗi câu hỏi nhé.</p></div><div class="help-suggestions" aria-label="Câu hỏi gợi ý"></div><form><label for="restaurant-question">Bạn cần hỗ trợ gì?</label><textarea id="restaurant-question" maxlength="1000" required rows="2" placeholder="Ví dụ: 2 người, ngân sách 400.000đ, nên gọi món nào?"></textarea><button type="submit">Gửi câu hỏi</button></form></section>`;
  const panel=host.querySelector('section'), toggle=host.querySelector('.help-toggle'), log=host.querySelector('.help-messages');
  const suggestions=['Món gỏi cuốn gồm những nguyên liệu nào?', '2 người, ngân sách 400.000đ nên gọi món nào?', 'Có combo nào đã được nhà hàng duyệt?', 'Tôi muốn món ít cay thì ghi chú ở đâu?', 'Muốn đổi món đã gửi thì làm thế nào?'];
  for(const question of suggestions){const button=document.createElement('button');button.type='button';button.textContent=question;button.onclick=()=>{host.querySelector('textarea').value=question;host.querySelector('textarea').focus();};host.querySelector('.help-suggestions').append(button);}
  const open=value=>{panel.hidden=!value;toggle.setAttribute('aria-expanded',String(value));if(value)host.querySelector('textarea').focus();};
  toggle.onclick=()=>open(panel.hidden);host.querySelector('.help-close').onclick=()=>open(false);
  host.querySelector('form').onsubmit=async event=>{
    event.preventDefault();const input=host.querySelector('textarea'),button=host.querySelector('[type=submit]');
    if(button.disabled||!input.value.trim())return;
    const question=input.value.trim();input.value='';button.disabled=true;button.textContent='Đang trả lời…';
    const append=(text,className)=>{const p=document.createElement('p');p.className=className;p.textContent=text;log.append(p);log.scrollTop=log.scrollHeight;};
    append(question,'question');
    try {const result=await request(`/api/public/tables/${token}/chat`,{method:'POST',body:JSON.stringify({message:question})});append(result.answer,'answer');}
    catch(error){append(error.message,'answer');}
    finally{button.disabled=false;button.textContent='Gửi câu hỏi';}
  };
  return {loadCombos,renderCombos};
}
