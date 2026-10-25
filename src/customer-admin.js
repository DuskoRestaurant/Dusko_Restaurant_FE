// Phase 4 — Dedicated Admin pages: Customers / Tiers / Promotions.
// These pages call the Phase 2 APIs; the backend enforces ADMIN for
// tiers/promotions and ADMIN/MANAGER for customer reads.
export function createCustomerAdmin({ api, branchId, e, title, table, btn, empty, access }) {
  async function customers() {
    const data = await api(`/api/customers?branchId=${branchId}`);
    const items = data.items || [];
    return title('KHÁCH HÀNG', 'Quản lý khách hàng', 'Khách hàng theo chi nhánh. Số điện thoại là định danh chính, chỉ nhân viên xác nhận tại bàn mới kích hoạt ưu đãi.', btn('Làm mới', 'reload', 'secondary')) +
      table(['Họ tên', 'Số điện thoại', 'Hạng', 'Lượt / Đơn / Chi tiêu', 'Lần cuối', 'Trạng thái'], items.map(c => [
        e(c.fullName), e(c.phone), e(c.tier?.name || '—'), `${c.totalVisits} / ${c.totalOrders} / ${Number(c.totalSpent).toLocaleString('vi-VN')}₫`,
        c.lastVisitAt ? new Date(c.lastVisitAt).toLocaleDateString('vi-VN') : '—', e(c.status),
      ])) + (items.length ? '' : empty('Chưa có khách hàng', 'Khách đăng ký từ QR hoặc do nhân viên tạo sẽ xuất hiện ở đây.'));
  }
  async function tiers() {
    const items = await api(`/api/customer-tiers?branchId=${branchId}`);
    return title('HẠNG THÀNH VIÊN', 'Quản lý hạng khách hàng', 'Hạng được đánh lại từ chi tiêu, số đơn và lượt thăm của chi nhánh. Mọi ngưỡng đều phải đạt.', btn('Làm mới', 'reload', 'secondary')) +
      table(['Mã', 'Tên hạng', 'Chi tiêu tối thiểu', 'Số đơn tối thiểu', 'Lượt tối thiểu', 'Thứ tự'], items.map(t => [e(t.code), e(t.name), Number(t.minSpent).toLocaleString('vi-VN'), t.minOrders, t.minVisits, t.sortOrder]));
  }
  async function promotions() {
    const items = await api(`/api/promotions?branchId=${branchId}`);
    return title('KHUYẾN MÃI', 'Quản lý khuyến mãi', 'Trang riêng quản trị khuyến mãi. Giảm giá chỉ tính ở máy chủ; trang này không tự tính tiền.', btn('Làm mới', 'reload', 'secondary')) +
      table(['Mã', 'Tên', 'Loại', 'Giá trị', 'Giảm tối đa', 'Đơn tối thiểu', 'Hiệu lực', 'Trạng thái'], items.map(p => [
        e(p.code), e(p.name), e(p.type), p.value, p.maxDiscount ?? '—', Number(p.minOrderAmount).toLocaleString('vi-VN'),
        `${p.startsAt ? new Date(p.startsAt).toLocaleDateString('vi-VN') : '—'} → ${p.endsAt ? new Date(p.endsAt).toLocaleDateString('vi-VN') : '—'}`,
        p.isActive ? 'Đang chạy' : 'Tắt',
      ])) + `<p class="form-help">Tạo/sửa khuyến mãi dùng API quản trị (POST/PATCH /api/promotions) hoặc form sẽ được bổ sung sau khi duyệt mẫu này. Không dùng trang này để tính giảm giá cho đơn.</p>`;
  }
  return { customers, tiers, promotions };
}
