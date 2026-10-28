// Move the existing shared basket into a native modal: one set of controls,
// one source of totals, and native focus trapping/Escape handling.
export function createCustomerCartOverlay({root, summary, startOpen = false}) {
  const cart = root.querySelector('#customer-cart');
  const anchor = document.createComment('customer-cart-position');
  cart.before(anchor);
  const dock = document.createElement('button');
  dock.type = 'button';
  dock.className = 'customer-cart-dock';
  dock.setAttribute('aria-haspopup', 'dialog');
  dock.setAttribute('aria-controls', 'customer-cart-dialog');
  dock.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 4h2l2.2 11h11.5l2-8H6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg><span class="customer-cart-badge"></span>';
  const feedback = document.createElement('div');
  feedback.className = 'customer-cart-feedback';
  feedback.setAttribute('role', 'status');
  feedback.setAttribute('aria-live', 'polite');
  let feedbackTimer;
  const dialog = document.createElement('dialog');
  dialog.id = 'customer-cart-dialog';
  dialog.className = 'customer-cart-dialog';
  dialog.setAttribute('aria-label', 'Giỏ món của bàn');
  dialog.innerHTML = '<div class="customer-cart-dialog-bar"><strong>Kiểm tra giỏ món</strong><button type="button" autofocus aria-label="Đóng giỏ món">Đóng ✕</button></div>';
  const actions=document.createElement('div');
  actions.className='customer-action-dock';
  const help=root.querySelector('.restaurant-help')||document.querySelector('.restaurant-help');
  const helpParent=help?.parentNode;
  if(help)actions.append(help);
  actions.append(dock);
  root.append(actions, dialog, feedback);
  const compact = matchMedia('(max-width: 1050px)');
  let previousOverflow;
  function restore() {
    anchor.after(cart);
    document.body.style.overflow = previousOverflow ?? '';
    dock.setAttribute('aria-expanded', 'false');
  }
  function open() {
    if (!compact.matches || dialog.open) return;
    previousOverflow = document.body.style.overflow;
    dialog.append(cart);
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    dock.setAttribute('aria-expanded', 'true');
  }
  function close() { if (dialog.open) dialog.close(); }
  dialog.addEventListener('close', restore);
  dialog.querySelector('button').onclick = close;
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
  });
  dock.onclick = open;
  const jump = root.querySelector('.pos-cart-jump');
  const jumpClick = event => { if (compact.matches) { event.preventDefault(); open(); } };
  jump?.addEventListener('click', jumpClick);
  function resize() { if (!compact.matches) close(); }
  compact.addEventListener('change', resize);
  function update() {
    const {count, total, busy} = summary();
    dock.querySelector('.customer-cart-badge').textContent=count>99?'99+':String(count);
    dock.setAttribute('aria-label', `Xem giỏ món · ${count} món · ${total}${busy?' · Đang cập nhật':''}`);
    dock.title=`Giỏ món · ${count} món · ${total}`;
    dock.setAttribute('aria-busy', String(Boolean(busy)));
    dock.setAttribute('aria-expanded', String(dialog.open));
  }
  update();
  if (startOpen) open();
  function added(name, source) {
    clearTimeout(feedbackTimer);
    feedback.textContent=`Đã thêm ${name} vào giỏ`;
    feedback.classList.add('is-visible');
    feedbackTimer=setTimeout(()=>feedback.classList.remove('is-visible'),2400);
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      dock.animate([{transform:'scale(1)'},{transform:'scale(1.18) rotate(-8deg)'},{transform:'scale(1)'}],{duration:420,easing:'ease-out'});
      if (source?.isConnected) source.animate([{transform:'scale(1)'},{transform:'scale(.85)'},{transform:'scale(1.12)'},{transform:'scale(1)'}],{duration:320});
    }
  }
  return {update, added, isOpen:() => dialog.open, destroy() {
    clearTimeout(feedbackTimer);
    dialog.removeEventListener('close', restore);
    if (dialog.open) { dialog.close(); restore(); }
    compact.removeEventListener('change', resize);
    jump?.removeEventListener('click', jumpClick);
    if(help&&helpParent)helpParent.append(help);
    actions.remove();dialog.remove();anchor.remove();feedback.remove();
  }};
}
