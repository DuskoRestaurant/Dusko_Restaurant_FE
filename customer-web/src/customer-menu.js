import {customerMenuGroups} from './customer-menu-data.js';
import {categoryScrollTarget} from './customer-category-scroll.js';
import {categoryAtReadingLine} from './customer-category-spy.js';
import {customerDishBadges,createCustomerDishDetails} from './customer-dish-details.js';
const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = value => new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND'}).format(value);
export function createCustomerMenu({root, products, quantityOf, changeQuantity, sessionOpen, api = '', view, getLine}) {
  let query = view?.query || '', groups = [], frame = 0;
  let tag=view?.tag||'';
  let centeredButton,centeredWidth=0;
  let scrollIntent=null,initialDraw=true;
  let activeIndex=-1,pendingIndex=-1,switchTimer;
  root.innerHTML = '<div class="guest-menu-heading"><h2>Thực đơn</h2><input type="search" aria-label="Tìm món ăn" placeholder="Tìm món ăn…"></div><div class="guest-menu-layout"><nav class="guest-categories" aria-label="Danh mục món ăn"></nav><div class="guest-menu-sections"></div></div>';
  const nav = root.querySelector('nav'), sections = root.querySelector('.guest-menu-sections');
  const header=document.querySelector('#app>header');
  function measureHeader(){root.style.setProperty('--guest-header-offset',`${Math.ceil(header?.getBoundingClientRect().height||64)}px`);}
  const headerObserver=new ResizeObserver(()=>{measureHeader();onScroll();});
  if(header)headerObserver.observe(header);
  measureHeader();
  const details=createCustomerDishDetails({root,add:changeQuantity,getLine,api,canAdd:sessionOpen});
  const tags=[...new Map(products.flatMap(customerDishBadges).map(badge=>[badge.key,badge])).values()];
  if(!tags.some(badge=>badge.key===tag))tag='';
  if(tags.length){
    const filters=document.createElement('div');filters.className='guest-tag-filters';filters.setAttribute('role','group');filters.setAttribute('aria-label','Đặc trưng món ăn');
    filters.innerHTML=`<button type="button" data-tag="">Tất cả</button>${tags.map(badge=>`<button type="button" data-tag="${badge.key}">${badge.label}</button>`).join('')}`;
    root.querySelector('.guest-menu-heading').after(filters);
  }
  root.querySelector('input').value=query;
  function card(p) {
    const quantity = quantityOf(p.id), unavailable = !p.canOrder;
    return `<article class="guest-dish ${unavailable?'guest-dish-unavailable':''}"><button type="button" class="guest-dish-photo" data-menu-detail="${p.id}" aria-label="Xem ${escape(p.name)}">${p.imageUrl?`<img src="${escape(p.imageUrl.startsWith('http')?p.imageUrl:api+p.imageUrl)}" alt="" loading="lazy">`:'<span>Chưa có ảnh</span>'}</button><div class="guest-dish-info"><div class="guest-dish-title"><h4><button type="button" data-menu-detail="${p.id}">${escape(p.name)}</button></h4><div class="guest-dish-badges">${customerDishBadges(p).map(badge=>`<span class="guest-badge guest-badge-${badge.tone}">${badge.label}</span>`).join('')}</div></div>${p.description?`<p class="guest-dish-description">${escape(p.description)}</p>`:''}<div class="guest-dish-order"><div class="guest-dish-price"><strong>${money(p.sellingPrice)}</strong>${unavailable?`<small>${escape(p.availabilityReason||'Tạm hết')}</small>`:`<span class="guest-dish-counter" ${quantity?'':'hidden'}>Đã chọn <b data-quantity="${p.id}">${quantity}</b></span>`}</div>${unavailable?'':`<button type="button" data-menu-add="${p.id}" aria-label="Tùy chỉnh và thêm ${escape(p.name)}" ${sessionOpen?'':'disabled'}>+</button>`}</div></div></article>`;
  }
  function activate(index,force=false) {
    activeIndex=index;
    nav.querySelectorAll('button').forEach((button,i)=>{
      if (i===index) button.setAttribute('aria-current','true'); else button.removeAttribute('aria-current');
    });
    const current = nav.querySelector('[aria-current]');
    if(current&&(force||current!==centeredButton||nav.clientWidth!==centeredWidth)){
      centeredButton=current;centeredWidth=nav.clientWidth;
      nav.scrollTo({left:categoryScrollTarget(current.offsetLeft,current.offsetWidth,nav.clientWidth,nav.scrollWidth),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
    }
  }
  function spy() {
    frame = 0;
    if(scrollIntent){
      const {index,target}=scrollIntent;
      activate(index);
      if(Math.abs(window.scrollY-target)>2)return;
      scrollIntent=null;
    }
    const elements=[...sections.querySelectorAll('.guest-menu-group')];
    const maxScroll=document.documentElement.scrollHeight-innerHeight;
    const index=categoryAtReadingLine(elements.map(element=>element.getBoundingClientRect().top),nav.getBoundingClientRect().bottom+24,activeIndex,{atEnd:maxScroll>24&&window.scrollY>=maxScroll-3});
    if(index<0)return;
    if(activeIndex<0){activate(index);return;}
    if(index===activeIndex){clearTimeout(switchTimer);pendingIndex=-1;return;}
    if(pendingIndex!==index){
      clearTimeout(switchTimer);pendingIndex=index;
      switchTimer=setTimeout(()=>{const next=pendingIndex;pendingIndex=-1;if(next>=0&&!scrollIntent)activate(next);},160);
    }
  }
  function onScroll() {if (!frame) frame=requestAnimationFrame(spy);}
  function go(index) {
    clearTimeout(switchTimer);pendingIndex=-1;
    const section=sections.children[index];if(!section)return;
    const offset=(header?.getBoundingClientRect().height||64)+nav.getBoundingClientRect().height+12;
    const target=Math.max(0,Math.min(document.documentElement.scrollHeight-innerHeight,window.scrollY+section.getBoundingClientRect().top-offset));
    scrollIntent={index,target};
    activate(index,true);
    window.scrollTo({top:target,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  }
  function draw() {
    groups=customerMenuGroups(products,{search:query,tag});
    root.querySelectorAll('[data-tag]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.tag===tag)));
    nav.innerHTML=groups.map((group,index)=>`<button type="button" id="guest-category-tab-${index}" data-category="${index}" aria-controls="guest-category-${index}"><span>${escape(group.name)}</span></button>`).join('');
    sections.innerHTML=groups.map((group,index)=>`<section class="guest-menu-group" id="guest-category-${index}" aria-labelledby="guest-category-title-${index}"><h3 class="guest-category-title" id="guest-category-title-${index}">${escape(group.name)}</h3><div class="guest-dishes">${group.items.map(card).join('')}</div></section>`).join('') || '<p class="guest-menu-empty" role="status">Không tìm thấy món. Thử tên khác nhé.</p>';
    scrollIntent=null;
    clearTimeout(switchTimer);pendingIndex=-1;activeIndex=-1;
    if(initialDraw){nav.scrollLeft=view?.scrollLeft||0;initialDraw=false;}
    spy();
  }
  root.querySelector('input').oninput=event=>{query=event.target.value;draw();};
  root.onclick=event=>{
    const button=event.target.closest('button');
    if (!button || button.disabled) return;
    if (button.hasAttribute('data-tag')){tag=button.dataset.tag;draw();}
    if (button.hasAttribute('data-category')) go(Number(button.dataset.category));
    const productId=button.dataset.menuAdd||button.dataset.menuDetail;
    if(productId) details.open(products.find(p=>p.id===Number(productId)),button);
  };
  window.addEventListener('scroll',onScroll,{passive:true});
  window.addEventListener('resize',onScroll);
  const cancelIntent=()=>{scrollIntent=null;};
  window.addEventListener('wheel',cancelIntent,{passive:true});
  window.addEventListener('touchstart',cancelIntent,{passive:true});
  window.addEventListener('keydown',cancelIntent);
  draw();
  return {isDialogOpen:()=>Boolean(root.querySelector('.guest-dish-dialog[open]')),getView:()=>({query,tag,scrollLeft:nav.scrollLeft}),update() {
    root.querySelectorAll('[data-quantity]').forEach(counter=>{
      const quantity=quantityOf(Number(counter.dataset.quantity));counter.textContent=quantity;counter.parentElement.hidden=!quantity;
    });
  },destroy() {clearTimeout(switchTimer);headerObserver.disconnect();details.destroy();cancelAnimationFrame(frame);window.removeEventListener('scroll',onScroll);window.removeEventListener('resize',onScroll);window.removeEventListener('wheel',cancelIntent);window.removeEventListener('touchstart',cancelIntent);window.removeEventListener('keydown',cancelIntent);root.onclick=null;}};
}
