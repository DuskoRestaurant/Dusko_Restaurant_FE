import {canUseStaffWorkspace} from '../../src/permissions.js';
export const shellLabels={kitchen:'Bếp',cashier:'Thu ngân',service:'Phục vụ'};
export const shellDescriptions={
  kitchen:'Nhận mẻ nấu, cập nhật món đang làm và đã hoàn thành.',
  cashier:'Thanh toán cho khách, xem và in hóa đơn.',
  service:'Mở bàn, nhận yêu cầu gọi món và mang món cho khách.',
};
export function staffShellsFor(user) {
  return canUseStaffWorkspace(user) ? ['kitchen','cashier','service'] : [];
}
