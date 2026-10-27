// Phase 5 — Staff role split.
// Cashier shell = service workspace (orders, confirm, pay, receipts).
// Kitchen shell = KDS batches only (accept/start/finish, gift badge).
// Effective roles come from /api/auth/profile (primary + UserRole rows).
// CHEF maps to Kitchen; CASHIER/WAITER to Cashier; MANAGER/ADMIN get the picker.
export function staffShellsFor(user) {
  const roles = user.roles || [user.role];
  const cashier = roles.some(r => ['CASHIER', 'WAITER', 'MANAGER', 'ADMIN'].includes(r));
  const kitchen = roles.some(r => ['CHEF', 'MANAGER', 'ADMIN'].includes(r));
  if (cashier && !kitchen) return ['cashier'];
  if (kitchen && !cashier) return ['kitchen'];
  return ['cashier', 'kitchen'];
}
export function kitchenHtml() {
  return `<section class="kitchen-shell"><h2>Màn hình bếp</h2><p class="sw-help">Chỉ hiển thị mẻ bếp. Món quà tặng có nhãn “Quà tặng” và được nấu/phục vụ như món thường.</p><div id="kitchen-batches"></div></section>`;
}
