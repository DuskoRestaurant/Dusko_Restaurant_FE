import './customer-help.css';
export function createCustomerHelp({token,request,getState,addCombo,api,cartLines,onCombosChanged=()=>{}}) {
  let combos=[], loaded=false;
  async function loadCombos(strict=false){
    try { const response=await request(`/api/public/tables/${token}/combos`);combos=response.combos;loaded=true;renderCombos(); }
    catch(error) { if(strict)throw error;const root=document.querySelector('#customer-combos');if(root)root.textContent='Gợi ý combo tạm chưa sẵn sàng. Bạn vẫn có thể chọn món trong thực đơn.'; }
  }
  function getCombos(){
    const state=getState();
    if(!loaded||!state.data)return [];
    return combos.map(c=>({...c,items:c.items.map(i=>({...i,...state.data.products.find(p=>p.id===i.id)}))})).filter(c=>c.items.every(i=>i.canOrder));
  }
  function renderCombos(){onCombosChanged(getCombos());}
  const host=document.createElement('aside');host.className='restaurant-help';document.body.append(host);
  host.innerHTML=`<button class="help-toggle" aria-expanded="false" aria-controls="restaurant-chat" aria-label="Hỏi nhà hàng" title="Hỏi nhà hàng"><svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M20 11.5a8 8 0 0 1-8 8H5l-3 2v-7a8 8 0 1 1 18-3Z" stroke-linejoin="round"/><path d="M7 10h8M7 14h5" stroke-linecap="round"/></svg></button><section id="restaurant-chat" hidden><div class="help-heading"><h2>Trợ lý nhà hàng</h2><button class="help-close" aria-label="Đóng chat">×</button></div><p class="help-disclosure">Hỗ trợ bởi Gemini. Câu hỏi, thực đơn và tên nguyên liệu được gửi tới Google để trả lời. Không gửi thông tin cá nhân.</p><div class="help-messages" role="log" aria-live="polite"><p class="answer">Bạn đang phân vân chọn món? Tôi có thể giải thích nguyên liệu của món, gợi ý theo số người, ngân sách, combo đã duyệt hoặc hướng dẫn yêu cầu phục vụ. Hãy ghi đầy đủ nhu cầu trong mỗi câu hỏi nhé.</p></div><div class="help-suggestions" aria-label="Câu hỏi gợi ý"></div><form><label for="restaurant-question">Bạn cần hỗ trợ gì?</label><textarea id="restaurant-question" maxlength="1000" required rows="2" placeholder="Ví dụ: 2 người, ngân sách 400.000đ, nên gọi món nào?"></textarea><button type="submit">Gửi câu hỏi</button></form></section>`;
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
  return {loadCombos,renderCombos,getCombos};
}
