const definitions=[['BEST_SELLER','Bán chạy','popular'],['SPICY','Món cay','spicy'],['VEGETARIAN','Món chay','vegetarian']];
export function customerDishBadges(product) {
  const tags=new Set(Array.isArray(product.tags)?product.tags:[]);
  return definitions.filter(([key])=>tags.has(key)).map(([key,label,tone])=>({key,label,tone}));
}
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=value=>new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND'}).format(value);
export function nextDishQuantity(quantity,delta,max) {
  return Math.max(1,Math.min(Math.max(1,max),quantity+delta));
}
export function dishNotePlaceholder(product={}) {
  const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/đ/g,'d');
  const name=normalize(product.name),category=normalize(product.category?.name);
  const drink=/^(bia|nuoc|tra|ca phe|cafe|sinh to|ep|ruou|soda|cocktail|mocktail)\b/;
  const food=/^(canh|com|goi|lau|rau|thit|ca|tom|muc|ga|bo|heo|bun|mi|pho|khoai|sup|banh)\b/;
  if(drink.test(name)||(!food.test(name)&&/(do uong|giai khat|bia|ruou|ca phe)/.test(category)))return 'Ví dụ: ít đá, dùng lạnh…';
  if(name.startsWith('lau ')||category.includes('lau'))return 'Ví dụ: ít cay, nước lẩu để riêng…';
  if(/trang mieng|kem|banh ngot/.test(category))return 'Ví dụ: ít ngọt, sốt để riêng…';
  return 'Ví dụ: ít cay, không hành…';
}
export function customerDishImages(product={}) {
  return [...new Set([product.imageUrl,...(Array.isArray(product.imageUrls)?product.imageUrls:[]),...(Array.isArray(product.images)?product.images.map(image=>typeof image==='string'?image:image?.url):[])].filter(url=>typeof url==='string'&&url.trim()))];
}
function galleryHtml(product,api){
  const images=customerDishImages(product);if(!images.length)return '';
  return `<div class="guest-detail-gallery"><div class="guest-gallery-track" ${images.length>1?'tabindex="0" role="group" aria-label="Ảnh món ăn, vuốt hoặc dùng phím mũi tên để xem"':''}>${images.map((url,index)=>`<img class="guest-detail-photo" src="${escape(url.startsWith('http')?url:api+url)}" alt="${escape(product.name)} · Ảnh ${index+1}" ${index?'loading="lazy"':''}>`).join('')}</div>${images.length>1?'<div class="guest-gallery-navigation"><button type="button" data-gallery-prev aria-label="Ảnh trước" disabled>‹</button><span data-gallery-position aria-live="polite">1 / '+images.length+'</span><button type="button" data-gallery-next aria-label="Ảnh tiếp theo">›</button></div>':''}</div>`;
}
export function createCustomerDishDetails({root,add,getLine,api='',canAdd=true}) {
  const dialog=document.createElement('dialog');
  dialog.className='guest-dish-dialog';dialog.setAttribute('aria-labelledby','guest-detail-title');root.append(dialog);
  let product,source,previousOverflow='',pending=false;
  function close(){if(!pending)dialog.close();}
  const restore=()=>{document.body.style.overflow=previousOverflow;if(source?.isConnected)source.focus({preventScroll:true});};
  dialog.addEventListener('close',restore);
  dialog.addEventListener('cancel',event=>{if(pending)event.preventDefault();});
  dialog.addEventListener('click',event=>{
    if(event.target!==dialog)return;
    const rect=dialog.getBoundingClientRect();
    if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)close();
  });
  function open(p,trigger){
    if(document.querySelector('dialog[open]'))return;
    product=p;source=trigger;
    const line=getLine?.(p.id),max=Math.min(1000,Math.max(0,(p.maxOrderQuantity??1000)-(line?.quantity||0)));
    dialog.innerHTML=`<div class="guest-detail-top"><h2 id="guest-detail-title">${escape(p.name)}</h2><button type="button" data-detail-close aria-label="Đóng chi tiết món" autofocus>✕</button></div><div class="guest-detail-scroll">${galleryHtml(p,api)}<div class="guest-detail-body"><div class="guest-dish-badges">${customerDishBadges(p).map(tag=>`<span class="guest-badge guest-badge-${tag.tone}">${tag.label}</span>`).join('')}</div>${p.description?`<p>${escape(p.description)}</p>`:''}<strong>${money(p.sellingPrice)} / suất</strong><form id="guest-detail-form"><span id="guest-detail-quantity-label">Số lượng thêm</span><div class="cart-stepper guest-detail-stepper" role="group" aria-labelledby="guest-detail-quantity-label"><button type="button" data-detail-minus aria-label="Giảm số lượng" disabled>−</button><output id="guest-detail-quantity" aria-live="polite">1</output><button type="button" data-detail-plus aria-label="Tăng số lượng">+</button></div><label for="guest-detail-note">Ghi chú cho món <small>(không bắt buộc)</small></label><textarea id="guest-detail-note" maxlength="500" rows="2" placeholder="${escape(dishNotePlaceholder(p))}">${escape(line?.note||'')}</textarea><p class="guest-note-hint">${line?`Món này đã có ${line.quantity} suất trong giỏ chung. Ghi chú áp dụng cho toàn bộ món này. Để trống sẽ giữ ghi chú hiện tại. `:''}Nhân viên sẽ xác nhận khả năng đáp ứng yêu cầu. Phụ thu, nếu có, cần được xác nhận riêng.</p><p class="guest-detail-error" role="alert" hidden></p></form></div></div><div class="guest-detail-footer"><button class="primary" type="submit" form="guest-detail-form" ${!p.canOrder||!max?'disabled':''}>${!max?'Đã đạt số lượng còn lại':`Thêm vào giỏ · ${money(p.sellingPrice)}`}</button></div>`;
    dialog.querySelector('[data-detail-close]').onclick=close;
    const track=dialog.querySelector('.guest-gallery-track'),images=customerDishImages(p);
    if(track&&images.length>1){
      const prev=dialog.querySelector('[data-gallery-prev]'),next=dialog.querySelector('[data-gallery-next]');
      const move=delta=>track.scrollTo({left:Math.max(0,Math.min(images.length-1,Math.round(track.scrollLeft/track.clientWidth)+delta))*track.clientWidth,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
      prev.onclick=()=>move(-1);next.onclick=()=>move(1);
      track.onscroll=()=>{const index=Math.round(track.scrollLeft/track.clientWidth);dialog.querySelector('[data-gallery-position]').textContent=`${index+1} / ${images.length}`;prev.disabled=index===0;next.disabled=index===images.length-1;};
      track.onkeydown=event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();move(event.key==='ArrowLeft'?-1:1);}};
    }
    const quantity=dialog.querySelector('#guest-detail-quantity'),submit=dialog.querySelector('[type=submit]');
    const minus=dialog.querySelector('[data-detail-minus]'),plus=dialog.querySelector('[data-detail-plus]');
    let selectedQuantity=1;
    function updateQuantity(){
      quantity.value=String(selectedQuantity);
      minus.disabled=pending||selectedQuantity<=1;
      plus.disabled=pending||selectedQuantity>=max||!canAdd||!p.canOrder;
      if(!pending&&canAdd&&p.canOrder&&max)submit.textContent=`Thêm vào giỏ · ${money(p.sellingPrice*selectedQuantity)}`;
    }
    minus.onclick=()=>{selectedQuantity=nextDishQuantity(selectedQuantity,-1,max);updateQuantity();};
    plus.onclick=()=>{selectedQuantity=nextDishQuantity(selectedQuantity,1,max);updateQuantity();};
    updateQuantity();
    dialog.querySelector('form').onsubmit=async event=>{
      event.preventDefault();if(pending||!canAdd||!p.canOrder||!max)return;
      pending=true;submit.disabled=true;submit.textContent='Đang thêm…';
      updateQuantity();
      dialog.querySelector('[data-detail-close]').disabled=true;
      try {
        const success=await add(p.id,selectedQuantity,trigger,dialog.querySelector('#guest-detail-note').value.trim());
        if(success===false)throw Error('Chưa thêm được món. Vui lòng thử lại.');
        pending=false;dialog.close();
      } catch(error) {
        const errorNode=dialog.querySelector('.guest-detail-error');errorNode.textContent=error.message;errorNode.hidden=false;
      } finally {pending=false;submit.disabled=false;dialog.querySelector('[data-detail-close]').disabled=false;updateQuantity();}
    };
    if(!canAdd){submit.disabled=true;submit.textContent='Bàn chưa mở phục vụ';}
    previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';dialog.showModal();
  }
  return {open,close,destroy(){dialog.removeEventListener('close',restore);if(dialog.open){dialog.close();document.body.style.overflow=previousOverflow;}dialog.remove();}};
}
