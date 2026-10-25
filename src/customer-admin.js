// Admin pages: Customers / Tiers / Promotions (full promotion CRUD).
// Backend enforces ADMIN for tiers/promotions, ADMIN/MANAGER for customer reads.
// No birthday fields anywhere — explicitly out of scope.
export function createCustomerAdmin({ api, branchId, e, title, table, row, btn, empty, access, formModal, confirmDialog, toast, reload }) {
  const money = v => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(v) || 0);
  const date = v => v ? new Date(v).toLocaleDateString('vi-VN') : '—';
  const typeLabel = t => ({ PERCENTAGE: 'Giảm %', FIXED: 'Giảm tiền', ITEM_PERCENTAGE: 'Giảm % món', ITEM_FIXED: 'Giảm tiền món', CATEGORY_PERCENTAGE: 'Giảm % nhóm', GIFT: 'Tặng món' }[t] || t);

  async function customers() {
    const data = await api(`/api/customers?branchId=${branchId}`);
    const items = data.items || [];
    return title('KHÁCH HÀNG', 'Quản lý khách hàng', 'Khách hàng theo chi nhánh. Số điện thoại là định danh chính, chỉ nhân viên xác nhận tại bàn mới kích hoạt ưu đãi.', btn('Làm mới', 'reload', 'secondary')) +
      table(['Họ tên', 'Số điện thoại', 'Hạng', 'Lượt / Đơn / Chi tiêu', 'Lần cuối', 'Trạng thái'], items.map(c => row([
        e(c.fullName), e(c.phone), e(c.tier?.name || '—'), `${c.totalVisits} / ${c.totalOrders} / ${money(c.totalSpent)}`,
        c.lastVisitAt ? date(c.lastVisitAt) : '—', e(c.status),
      ]))) + (items.length ? '' : empty('Chưa có khách hàng', 'Khách đăng ký từ QR hoặc do nhân viên tạo sẽ xuất hiện ở đây.'));
  }
  async function tiers() {
    const items = await api(`/api/customer-tiers?branchId=${branchId}`);
    return title('HẠNG THÀNH VIÊN', 'Quản lý hạng khách hàng', 'Hạng được đánh lại từ chi tiêu, số đơn và lượt thăm của chi nhánh. Mọi ngưỡng đều phải đạt.', btn('Làm mới', 'reload', 'secondary')) +
      table(['Mã', 'Tên hạng', 'Chi tiêu tối thiểu', 'Số đơn tối thiểu', 'Lượt tối thiểu', 'Thứ tự'], items.map(t => row([e(t.code), e(t.name), money(t.minSpent), t.minOrders, t.minVisits, t.sortOrder])));
  }

  // ---- Promotions ----
  let promos = [], tiersList = [], products = [], categories = [];
  // Retest fix: filter state must survive reload(), otherwise typing a search
  // re-rendered the page with empty filters and lost the search.
  let promoFilter = { search: '', type: '', isActive: '' };
  async function loadData(search = '', type = '', isActive = '') {
    const q = new URLSearchParams({ branchId });
    if (search) q.set('search', search); if (type) q.set('type', type); if (isActive !== '') q.set('isActive', isActive);
    [promos, tiersList, products, categories] = await Promise.all([
      api(`/api/promotions?${q}`),
      api(`/api/customer-tiers?branchId=${branchId}`),
      api(`/api/catalog/products`),
      api(`/api/catalog/categories`),
    ]);
  }
  function promoForm(p) {
    const f = (key, label, value = '', more = {}) => ({ key, label, value, ...more });
    const tierOptions = [{ value: '', label: 'Tất cả hạng (kể cả khách vãng lai nếu cho phép)' }, ...tiersList.map(t => ({ value: t.id, label: `${t.name} (${t.code})` }))];
    const productOptions = [{ value: '', label: 'Không áp cho món riêng' }, ...products.filter(x => x.isActive).map(x => ({ value: x.id, label: `${x.name} · ${money(x.sellingPrice)}` }))];
    const categoryOptions = [{ value: '', label: 'Không áp cho nhóm riêng' }, ...categories.map(c => ({ value: c.id, label: c.name }))];
    const scopeProduct = p?.scopes?.find(s => s.scopeType === 'PRODUCT')?.productId || '';
    const scopeCategory = p?.scopes?.find(s => s.scopeType === 'CATEGORY')?.categoryId || '';
    const toDateInput = v => v ? new Date(v).toISOString().slice(0, 10) : '';
    formModal(p ? 'Sửa khuyến mãi' : 'Tạo khuyến mãi', [
      f('name', 'Tên khuyến mãi', p?.name || '', { required: true }),
      f('code', 'Mã khuyến mãi (2–32 ký tự, chữ hoa/số)', p?.code || '', { required: true }),
      f('description', 'Mô tả', p?.description || ''),
      f('type', 'Loại khuyến mãi', p?.type || 'PERCENTAGE', { options: [
        { value: 'PERCENTAGE', label: 'Giảm % toàn đơn' }, { value: 'FIXED', label: 'Giảm tiền toàn đơn' },
        { value: 'ITEM_PERCENTAGE', label: 'Giảm % món' }, { value: 'ITEM_FIXED', label: 'Giảm tiền món' },
        { value: 'CATEGORY_PERCENTAGE', label: 'Giảm % nhóm món' }, { value: 'GIFT', label: 'Tặng món' },
      ]}),
      f('value', 'Giá trị (% hoặc số tiền)', p?.value ?? '', { type: 'number', min: 0, step: 'any', required: true }),
      f('maxDiscount', 'Giảm tối đa (để trống = không giới hạn)', p?.maxDiscount ?? '', { type: 'number', min: 0, step: 'any' }),
      f('minOrderAmount', 'Đơn tối thiểu', p?.minOrderAmount ?? 0, { type: 'number', min: 0, step: 'any' }),
      f('tierId', 'Hạng áp dụng (để trống = mọi hạng)', p?.eligibleTiers?.[0]?.tierId || '', { options: tierOptions }),
      f('allowGuest', 'Áp dụng cho khách vãng lai (không có hạng)', p ? !!p.allowGuest : true, { type: 'checkbox' }),
      f('productId', 'Món áp dụng / món quà tặng', scopeProduct, { options: productOptions }),
      f('categoryId', 'Nhóm món áp dụng', scopeCategory, { options: categoryOptions }),
      f('startsAt', 'Bắt đầu', toDateInput(p?.startsAt), { type: 'date' }),
      f('endsAt', 'Kết thúc', toDateInput(p?.endsAt), { type: 'date' }),
      f('totalLimit', 'Giới hạn tổng lượt dùng (trống = không giới hạn)', p?.totalLimit ?? '', { type: 'number', min: 1 }),
      f('perCustomerLimit', 'Giới hạn mỗi khách (trống = không giới hạn)', p?.perCustomerLimit ?? '', { type: 'number', min: 1 }),
      f('stackingAllowed', 'Cho phép cộng dồn với khuyến mãi khác', !!p?.stackingAllowed, { type: 'checkbox' }),
      f('isActive', 'Đang hoạt động', p ? !!p.isActive : true, { type: 'checkbox' }),
    ], async v => {
      const name = String(v.name || '').trim(); if (!name) throw new Error('Tên khuyến mãi không được để trống.');
      const code = String(v.code || '').trim().toUpperCase(); if (!/^[A-Z0-9_-]{2,32}$/.test(code)) throw new Error('Mã khuyến mãi phải 2–32 ký tự chữ hoa, số, gạch ngang hoặc gạch dưới.');
      const value = Number(v.value); if (!(value > 0)) throw new Error('Giá trị khuyến mãi phải lớn hơn 0.');
      if (v.type === 'PERCENTAGE' && value > 100) throw new Error('Giảm % không vượt quá 100.');
      if (v.type === 'GIFT' && !v.productId) throw new Error('Khuyến mãi tặng món cần chọn món quà tặng.');
      if (v.type.startsWith('ITEM') && !v.productId) throw new Error('Khuyến mãi theo món cần chọn món áp dụng.');
      if (v.type === 'CATEGORY_PERCENTAGE' && !v.categoryId) throw new Error('Khuyến mãi theo nhóm cần chọn nhóm món.');
      const scopes = [];
      if (v.productId) scopes.push({ scopeType: 'PRODUCT', productId: Number(v.productId) });
      if (v.categoryId) scopes.push({ scopeType: 'CATEGORY', categoryId: Number(v.categoryId) });
      const body = { name, code, description: v.description || null, type: v.type, value, maxDiscount: v.maxDiscount === '' ? null : Number(v.maxDiscount), minOrderAmount: Number(v.minOrderAmount) || 0, startsAt: v.startsAt || null, endsAt: v.endsAt || null, totalLimit: v.totalLimit === '' ? null : Number(v.totalLimit), perCustomerLimit: v.perCustomerLimit === '' ? null : Number(v.perCustomerLimit), stackingAllowed: v.stackingAllowed === 'on', allowGuest: v.allowGuest === 'on', isActive: v.isActive === 'on', scopes, tierIds: v.tierId ? [Number(v.tierId)] : [] };
      return api(p ? `/api/promotions/${p.id}?branchId=${branchId}` : `/api/promotions?branchId=${branchId}`, { method: p ? 'PATCH' : 'POST', body });
    }, { description: 'Giảm giá chỉ tính ở máy chủ khi thanh toán; trang này không tự tính tiền. Backend kiểm tra lại mọi điều kiện: loại, giá trị, ngày, giới hạn lượt dùng và hạng.' });
  }
  async function promotions() {
    await loadData(promoFilter.search, promoFilter.type, promoFilter.isActive);
    const html = title('KHUYẾN MÃI', 'Quản lý khuyến mãi', 'Tạo, sửa, bật/tắt và xem thống kê sử dụng. Giảm giá chỉ tính ở máy chủ; trang này không tự tính tiền.', btn('Tạo khuyến mãi', 'new-promotion')) +
      `<div class="catalog-filters"><input id="promo-search" type="search" placeholder="Tìm mã hoặc tên khuyến mãi" value="${e(promoFilter.search)}"><select id="promo-type"><option value="">Tất cả loại</option><option value="PERCENTAGE" ${promoFilter.type === 'PERCENTAGE' ? 'selected' : ''}>Giảm %</option><option value="FIXED" ${promoFilter.type === 'FIXED' ? 'selected' : ''}>Giảm tiền</option><option value="ITEM_PERCENTAGE" ${promoFilter.type === 'ITEM_PERCENTAGE' ? 'selected' : ''}>Giảm % món</option><option value="ITEM_FIXED" ${promoFilter.type === 'ITEM_FIXED' ? 'selected' : ''}>Giảm tiền món</option><option value="CATEGORY_PERCENTAGE" ${promoFilter.type === 'CATEGORY_PERCENTAGE' ? 'selected' : ''}>Giảm % nhóm</option><option value="GIFT" ${promoFilter.type === 'GIFT' ? 'selected' : ''}>Tặng món</option></select><select id="promo-active"><option value="">Tất cả trạng thái</option><option value="true" ${promoFilter.isActive === 'true' ? 'selected' : ''}>Đang chạy</option><option value="false" ${promoFilter.isActive === 'false' ? 'selected' : ''}>Đã tắt</option></select></div>` +
      table(['Mã', 'Tên', 'Loại', 'Giá trị', 'Giảm tối đa', 'Đơn tối thiểu', 'Hiệu lực', 'Lượt dùng / Tổng giảm', 'Trạng thái', ''], promos.map(p => row([
        e(p.code), e(p.name), typeLabel(p.type), p.type.includes('PERCENTAGE') ? `${p.value}%` : money(p.value), p.maxDiscount ? money(p.maxDiscount) : '—', money(p.minOrderAmount),
        `${date(p.startsAt)} → ${date(p.endsAt)}`, `${p.usageCount ?? 0} / ${money(p.totalDiscount ?? 0)}`, p.isActive ? 'Đang chạy' : 'Đã tắt',
        `<div class="manage-actions">${btn('Chi tiết', 'promo-detail', 'text', `data-id="${p.id}"`)}${btn('Sửa', 'promo-edit', 'text', `data-id="${p.id}"`)}${btn(p.isActive ? 'Tắt' : 'Bật', 'promo-toggle', 'text', `data-id="${p.id}"`)}</div>`,
      ]))) + (promos.length ? '' : empty('Chưa có khuyến mãi', 'Tạo khuyến mãi đầu tiên bằng nút ở trên.'));
    // Wire after render: the caller renders, then we attach via a microtask.
    setTimeout(() => {
      const search = document.querySelector('#promo-search'), typeSel = document.querySelector('#promo-type'), activeSel = document.querySelector('#promo-active');
      const apply = async () => { promoFilter = { search: search.value.trim(), type: typeSel.value, isActive: activeSel.value }; reload(); };
      search.oninput = () => { clearTimeout(search._t); search._t = setTimeout(apply, 400); };
      typeSel.onchange = apply; activeSel.onchange = apply;
      document.querySelectorAll('[data-action="new-promotion"]').forEach(b => b.onclick = () => promoForm(null));
      document.querySelectorAll('[data-action="promo-edit"]').forEach(b => b.onclick = async () => { const p = await api(`/api/promotions/${b.dataset.id}?branchId=${branchId}`); promoForm(p); });
      document.querySelectorAll('[data-action="promo-detail"]').forEach(b => b.onclick = async () => {
        const p = await api(`/api/promotions/${b.dataset.id}?branchId=${branchId}`);
        const wrap = document.createElement('dialog'); wrap.className = 'app-confirm';
        wrap.innerHTML = `<div class="app-confirm__body"><h2>${e(p.name)} · ${e(p.code)}</h2><p>${e(p.description || 'Không có mô tả.')}</p><p>Loại: ${typeLabel(p.type)} · Giá trị: ${p.type.includes('PERCENTAGE') ? `${p.value}%` : money(p.value)} · Giảm tối đa: ${p.maxDiscount ? money(p.maxDiscount) : 'Không giới hạn'} · Đơn tối thiểu: ${money(p.minOrderAmount)}</p><p>Hạng: ${p.eligibleTiers?.length ? p.eligibleTiers.map(t => e(t.tier?.name || t.tierId)).join(', ') : 'Mọi hạng'} · Khách vãng lai: ${p.allowGuest ? 'Có' : 'Không'} · Cộng dồn: ${p.stackingAllowed ? 'Có' : 'Không'}</p><p>Phạm vi: ${(p.scopes || []).map(s => s.product ? `Món: ${e(s.product.name)}` : s.category ? `Nhóm: ${e(s.category.name)}` : s.scopeType).join(', ') || 'Toàn đơn'}</p><p>Thống kê: ${p.usageCount} lượt dùng · Tổng giảm ${money(p.totalDiscount)} · Giới hạn: ${p.totalLimit ?? 'Không giới hạn'} tổng / ${p.perCustomerLimit ?? 'Không giới hạn'} mỗi khách</p><p>Lượt dùng gần nhất:</p><ul>${(p.recentUsages || []).map(u => `<li>${e(u.order?.orderCode || '')} · ${e(u.customer?.fullName || 'Khách')} · −${money(u.amount)} · ${date(u.usedAt)}</li>`).join('') || '<li>Chưa có lượt dùng.</li>'}</ul><button type="button" class="btn">Đóng</button></div>`;
        document.body.appendChild(wrap); wrap.showModal(); wrap.querySelector('button').onclick = () => { wrap.close(); wrap.remove(); };
      });
      document.querySelectorAll('[data-action="promo-toggle"]').forEach(b => b.onclick = async () => {
        const p = promos.find(x => x.id === Number(b.dataset.id)); if (!p) return;
        if (!await confirmDialog({ title: p.isActive ? 'Tắt khuyến mãi?' : 'Bật khuyến mãi?', message: p.isActive ? 'Khuyến mãi sẽ không áp cho đơn mới, nhưng đơn đã áp không bị thay đổi.' : 'Khuyến mãi sẽ áp cho đơn mới nếu đủ điều kiện.', confirmLabel: p.isActive ? 'Tắt' : 'Bật', danger: p.isActive })) return;
        await api(`/api/promotions/${p.id}/status?branchId=${branchId}`, { method: 'PATCH', body: { isActive: !p.isActive } });
        toast(p.isActive ? 'Đã tắt khuyến mãi.' : 'Đã bật khuyến mãi.'); reload();
      });
    }, 0);
    return html;
  }
  return { customers, tiers, promotions };
}
