import { escapeHtml as e, money, number } from './api.js';
import { productPhoto } from './product-photo.js';

const button = (label, action, id) => `<button class="btn small" data-action="${action}" data-id="${id}">${label}</button>`;
const panel = (heading, body, action = '') => `<section class="panel"><div class="panel-head"><h2>${heading}</h2>${action}</div>${body}</section>`;
const empty = message => `<p class="muted">${message}</p>`;
const stationName = { WOK_STATION:'Bếp xào', STEAM_STATION:'Bếp hấp', FRY_STATION:'Bếp chiên', BAR_STATION:'Quầy đồ uống', COLD_DISH:'Món nguội' };

export function locationsHtml({ branches, tables, qr = [], branchId, admin, canManageQr = false }) {
  const branch=branches.find(b=>b.id===branchId);
  const branchRows=branches.map(b=>'<div class="manage-row"><div><strong>'+e(b.name)+'</strong><small>'+e(b.code)+' · '+e(b.address||'Chưa có địa chỉ')+'</small></div>'+(admin?button('Sửa','edit-branch',b.id):'')+'</div>').join('');
  const rows=tables.map(t=>{
    const token=qr.find(q=>q.id===t.id)?.qrToken;
    const status={EMPTY:'Trống',SERVING:'Đang phục vụ',RESERVED:'Đã đặt'}[t.status]||t.status;
    const actions=canManageQr?(token?.isActive?button('Xem QR','qr-view',t.id)+button('Khóa QR','qr-revoke',t.id):button(token?'Mở lại QR':'Tạo QR','qr-create',t.id))+(token?button('Cấp mã mới','qr-reissue',t.id):''):'';
    return '<article class="location-table" data-location-table data-name="'+e(t.tableName)+'" data-status="'+e(t.status)+'"><header class="location-table-heading"><strong>'+e(t.tableName)+'</strong><span class="location-status location-status-'+e(t.status.toLowerCase())+'">'+e(status)+'</span></header><div class="location-table-facts"><div><span>Sức chứa</span><strong>'+number(t.seatingCapacity)+' chỗ</strong></div><div><span>Mã QR</span><strong>'+(!token?'Chưa tạo':token.isActive?'Đang hoạt động':'Đã khóa')+'</strong></div></div>'+(t.unconfirmedOrderCount?'<p class="location-pending">'+number(t.unconfirmedOrderCount)+' yêu cầu chờ xác nhận</p>':'')+'<footer class="manage-actions">'+button('Sửa bàn','edit-table',t.id)+(canManageQr?(token?.isActive?button('Xem QR','qr-view',t.id):button(token?'Mở lại QR':'Tạo QR','qr-create',t.id)):'')+(canManageQr&&token?'<details class="location-qr-menu"><summary>Quản lý QR</summary><div>'+(token.isActive?button('Khóa QR','qr-revoke',t.id):'')+button('Cấp mã mới','qr-reissue',t.id)+(token.lastUsedAt?'<small>Dùng gần nhất '+dateLabel(token.lastUsedAt)+'</small>':'')+'</div></details>':'')+'</footer></article>';
  }).join('');
  return '<div id="locations-manager"><details class="panel location-branches"><summary>Quản lý chi nhánh ('+branches.length+')</summary>'+branchRows+(admin?button('Thêm chi nhánh','new-branch',''):'')+'</details><section class="panel"><div class="panel-head"><h2>Bàn và QR · '+e(branch?.name||'Chi nhánh '+branchId)+'</h2>'+button('Thêm bàn','new-table','')+'</div><div class="location-toolbar"><label>Tìm bàn<input type="search" data-location-search placeholder="Tên bàn…"></label><label>Trạng thái<select data-location-status><option value="ALL">Tất cả trạng thái</option><option value="EMPTY">Trống</option><option value="SERVING">Đang phục vụ</option><option value="RESERVED">Đã đặt</option></select></label></div><p data-location-count role="status"></p><div class="location-table-list" data-location-list>'+rows+'</div><p data-location-empty hidden>Không có bàn phù hợp. Thử đổi tên hoặc trạng thái.</p><div class="location-pagination"><button class="btn secondary" data-location-prev>Trước</button><span data-location-page></span><button class="btn secondary" data-location-next>Sau</button></div></section></div>';
}
const dateLabel=value=>e(new Intl.DateTimeFormat('vi-VN',{dateStyle:'short',timeStyle:'short'}).format(new Date(value)));
export function bindLocations(root){
  const rows=[...root.querySelectorAll('[data-location-table]')];let page=1;
  const normalize=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/gi,'d').toLowerCase().trim();
  const apply=()=>{const query=normalize(root.querySelector('[data-location-search]').value),status=root.querySelector('[data-location-status]').value;
    const matches=rows.filter(row=>normalize(row.dataset.name).includes(query)&&(status==='ALL'||row.dataset.status===status));
    const pages=Math.max(1,Math.ceil(matches.length/12));page=Math.min(page,pages);rows.forEach(row=>row.hidden=true);matches.slice((page-1)*12,page*12).forEach(row=>row.hidden=false);
    root.querySelector('[data-location-count]').textContent=matches.length+' / '+rows.length+' bàn';root.querySelector('[data-location-empty]').hidden=matches.length>0;root.querySelector('[data-location-page]').textContent='Trang '+page+' / '+pages;root.querySelector('[data-location-prev]').disabled=page===1;root.querySelector('[data-location-next]').disabled=page===pages;
  };
  root.querySelector('[data-location-search]').oninput=()=>{page=1;apply();};root.querySelector('[data-location-status]').onchange=()=>{page=1;apply();};root.querySelector('[data-location-prev]').onclick=()=>{page--;apply();};root.querySelector('[data-location-next]').onclick=()=>{page++;apply();};apply();
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
