import { escapeHtml as e, money, number } from './api.js';
import { productPhoto } from './product-photo.js';

const button = (label, action, id) => `<button class="btn small" data-action="${action}" data-id="${id}">${label}</button>`;
const panel = (heading, body, action = '') => `<section class="panel"><div class="panel-head"><h2>${heading}</h2>${action}</div>${body}</section>`;
const empty = message => `<p class="muted">${message}</p>`;
const stationName = { WOK_STATION:'Bếp xào', STEAM_STATION:'Bếp hấp', FRY_STATION:'Bếp chiên', BAR_STATION:'Quầy đồ uống', COLD_DISH:'Món nguội' };

export function locationsHtml({ branches, tables, qr = [], branchId, admin, canManageQr = false }) {
  const branchRows = branches.map(b => `<div class="manage-row"><div><strong>${e(b.name)}</strong><small>${e(b.code)} · ${e(b.address || 'Chưa có địa chỉ')}</small></div>${admin ? button('Sửa', 'edit-branch', b.id) : ''}</div>`).join('') || empty('Chưa có chi nhánh.');
  const tableRows = tables.map(t => `<div class="manage-row"><div><strong>${e(t.tableName)}</strong><small>${number(t.seatingCapacity)} chỗ · ${t.status === 'EMPTY' ? 'Trống' : t.status === 'SERVING' ? 'Đang phục vụ' : 'Đã đặt'}${t.unconfirmedOrderCount?` · ${number(t.unconfirmedOrderCount)} yêu cầu chờ xác nhận`:''}</small></div>${button('Sửa', 'edit-table', t.id)}</div>`).join('') || empty('Chi nhánh chưa có bàn.');
  const qrRows=qr.map(item=>`<div class="manage-row qr-row"><div><strong>${e(item.tableName)}</strong><small>${!item.qrToken?'Chưa tạo QR':item.qrToken.isActive?'Đang hoạt động':'Đã khóa'}${item.qrToken?.lastUsedAt?` · dùng gần nhất ${new Intl.DateTimeFormat('vi-VN',{dateStyle:'short',timeStyle:'short'}).format(new Date(item.qrToken.lastUsedAt))}`:' · chưa ghi nhận lượt quét'}</small></div>${canManageQr?`<div class="manage-actions">${item.qrToken?.isActive?button('Xem QR','qr-view',item.id):button(item.qrToken?'Mở lại QR':'Tạo QR','qr-create',item.id)}${item.qrToken?.isActive?button('Khóa','qr-revoke',item.id):''}${item.qrToken?button('Cấp mã mới','qr-reissue',item.id):''}</div>`:''}</div>`).join('')||empty('Chi nhánh chưa có bàn để tạo QR.');
  return `<div class="two-col">${panel('Chi nhánh', branchRows, admin ? button('Thêm chi nhánh', 'new-branch', '') : '')}${panel(`Bàn tại chi nhánh ${branchId}`, tableRows, button('Thêm bàn', 'new-table', ''))}</div><div class="space-top">${panel('Mã QR cố định theo bàn',qrRows)}</div>`;
}

export { menuCatalogHtml as catalogHtml } from './catalog-manager.js';

export function numberField(value, name, min = 0, step = '1') {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || step === '1' && !Number.isSafeInteger(n)) throw new Error(`${name} không hợp lệ.`);
  return n;
}

export function recipeEntries(rows) {
  if (!rows.length) throw new Error('Công thức cần ít nhất một nguyên liệu.');
  const ids = new Set();
  return rows.map(row => {
    const ingredientId = numberField(row.ingredientId, 'Nguyên liệu', 1);
    const quantity = numberField(row.quantity, 'Định lượng', Number.EPSILON, 'any');
    const wasteRate = numberField(row.wasteRate, 'Hao hụt', 0, 'any');
    if (wasteRate >= 1 || ids.has(ingredientId)) throw new Error('Nguyên liệu bị lặp hoặc tỷ lệ hao hụt không hợp lệ.');
    ids.add(ingredientId);
    return { ingredientId, quantity, wasteRate };
  });
}
