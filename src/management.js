import { escapeHtml as e, money, number } from './api.js';

const button = (label, action, id) => `<button class="btn small" data-action="${action}" data-id="${id}">${label}</button>`;
const panel = (heading, body, action = '') => `<section class="panel"><div class="panel-head"><h2>${heading}</h2>${action}</div>${body}</section>`;
const empty = message => `<p class="muted">${message}</p>`;
const stationName = { WOK_STATION:'Bếp xào', STEAM_STATION:'Bếp hấp', FRY_STATION:'Bếp chiên', BAR_STATION:'Quầy đồ uống', COLD_DISH:'Món nguội' };

export function locationsHtml({ branches, tables, branchId, admin }) {
  const branchRows = branches.map(b => `<div class="manage-row"><div><strong>${e(b.name)}</strong><small>${e(b.code)} · ${e(b.address || 'Chưa có địa chỉ')}</small></div>${admin ? button('Sửa', 'edit-branch', b.id) : ''}</div>`).join('') || empty('Chưa có chi nhánh.');
  const tableRows = tables.map(t => `<div class="manage-row"><div><strong>${e(t.tableName)}</strong><small>${number(t.seatingCapacity)} chỗ · ${t.status === 'EMPTY' ? 'Trống' : t.status === 'SERVING' ? 'Đang phục vụ' : 'Đã đặt'}</small></div>${button('Sửa', 'edit-table', t.id)}</div>`).join('') || empty('Chi nhánh chưa có bàn.');
  return `<div class="two-col">${panel('Chi nhánh', branchRows, admin ? button('Thêm chi nhánh', 'new-branch', '') : '')}${panel(`Bàn tại chi nhánh ${branchId}`, tableRows, button('Thêm bàn', 'new-table', ''))}</div>`;
}

export function catalogHtml({ categories, products, admin, chef }) {
  const categoryRows = categories.map(c => `<div class="manage-row"><div><strong>${e(c.name)}</strong><small>${e(c.code)}</small></div>${admin ? button('Sửa', 'edit-category', c.id) : ''}</div>`).join('') || empty('Chưa có nhóm món.');
  const productRows = products.map(p => `<div class="manage-row"><div><strong>${e(p.name)}</strong><small>${e(p.code)} · ${e(p.category?.name || '')} · ${money(p.sellingPrice)} · ${e(stationName[p.stationType] || p.stationType)}${p.isActive?'':' · Đã ngừng bán'}</small></div><div class="manage-actions">${admin ? button('Sửa', 'edit-product', p.id) : ''}${admin || chef ? button('Công thức', 'recipe', p.id) : ''}${admin ? button(p.isActive?'Ngừng bán':'Bán lại', 'toggle-product', p.id) : ''}</div></div>`).join('') || empty('Chưa có món.');
  return `<div class="two-col">${panel('Nhóm món', categoryRows, admin ? button('Thêm nhóm', 'new-category', '') : '')}${panel('Món ăn', productRows, admin ? button('Thêm món', 'new-product', '') : '')}</div>`;
}

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
