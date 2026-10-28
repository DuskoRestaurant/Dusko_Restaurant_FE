// Development-only preview: real workspace, synthetic data, no backend writes.
import { navIcon } from '../src/ui-icons.js';
import tokens from '../src/tokens.css?raw';

const params = new URLSearchParams(location.search);
const staff = params.get('app') === 'staff';
await import('../src/tokens.css');
await import('../src/accounts.css');
await import('../src/app-entry.css');
if (staff) await import('../staff-app/src/style.css');
else {
  await import('../src/style.css');
  await import('../src/offline.css');
  await import('../src/management.css');
  await import('../src/theme.css');
}
const { createServiceWorkspace } = await import('../src/service-workspace.js');
await import('../src/readability.css');
await import('../src/font.css');
if (!staff) await import('../src/forecast.css');
await import('../src/pos-theme.css');
// Preview-only media override using actual tokens, without changing app settings.
if (params.get('theme') === 'light') {
  const theme = document.createElement('style');
  theme.textContent = tokens.match(/:root\s*\{[^}]*\}/)[0];
  document.head.append(theme);
}
const baseProducts = [
  {id:1, name:'Lẩu Thái hải sản', sellingPrice:289000, imageUrl:'/dishes/lau-thai.webp', category:{name:'Món chính'}},
  {id:2, name:'Cơm chiên hải sản', sellingPrice:89000, imageUrl:'/dishes/com-chien.webp', category:{name:'Món chính'}},
  {id:3, name:'Rau muống xào tỏi', sellingPrice:49000, imageUrl:'/dishes/rau-muong-xao.webp', category:{name:'Rau'}},
  {id:4, name:'Khoai tây chiên', sellingPrice:39000, imageUrl:'/dishes/khoai-tay-chien.webp', category:{name:'Khai vị'}},
].map(p => ({...p, isActive:true, canOrder:true, maxOrderQuantity:30, requiresPreparation:true}));
const products = params.has('stress') ? Array.from({length:120}, (_,i) => ({
  ...baseProducts[i % baseProducts.length], id:i+1,
  name:`${baseProducts[i % baseProducts.length].name}${i % 9 === 0 ? ' đặc biệt với nấm, rau củ theo mùa và nước sốt riêng của nhà hàng' : ''} · ${i+1}`,
  imageUrl:i % 11 === 0 ? '' : baseProducts[i % baseProducts.length].imageUrl,
  canOrder:i % 17 !== 16, availabilityReason:'Tạm hết nguyên liệu',
})) : baseProducts;
const tables = Array.from({length:12}, (_, i) => ({
  id:i + 1, tableName:`Bàn ${String(i + 1).padStart(2, '0')}`, seatingCapacity:i % 3 ? 4 : 6,
  status:i < 5 ? 'SERVING' : i === 11 ? 'RESERVED' : 'EMPTY',
  serviceRequestCount:i === 0 ? 1 : 0, unconfirmedOrderCount:i === 1 ? 2 : 0,
  readyQuantity:i === 2 ? 3 : 0, pendingOrderCount:i < 5 ? 1 : 0, checkoutReady:i === 3, billRequested:i === 4,
}));
const session = {
  id:'preview-session', orders:[
    {id:'preview-pending', orderCode:'HD-DEMO01', status:'AWAITING_CONFIRMATION', createdAt:new Date(), finalAmount:378000,
      items:products.slice(0, 2).map(p => ({id:p.id, product:p, quantity:1, price:p.sellingPrice, note:p.id === 1 ? 'Ít cay' : ''}))},
    {id:'preview-active', orderCode:'HD-DEMO02', status:'PENDING', createdAt:new Date(), finalAmount:187000,
      items:products.slice(1,4).map(p => ({id:p.id + 10, product:p, quantity:1, price:p.sellingPrice, kdsStatus:p.id === 2 ? 'DONE' : p.id === 3 ? 'COOKING' : 'WAITING'}))},
  ],
};
// A settled service flow with many accepted rounds, to inspect checkout density.
if (params.has('bill')) {
  session.orders = Array.from({length:24},(_,i)=>({
    id:`preview-bill-${i+1}`,orderCode:`HD-DEMO${i+1}`,status:'PENDING',
    source:i%2?'CUSTOMER_QR':'STAFF',createdAt:new Date(Date.now()-(24-i)*60000),
    discountAmount:10000,finalAmount:products.slice(0,3).reduce((sum,p)=>sum+p.sellingPrice,0)-10000,
    items:products.slice(0,3).map(p=>({id:1000+i*10+p.id,product:p,quantity:1,price:p.sellingPrice,kdsStatus:'DONE',servedAt:new Date().toISOString(),note:p.id===1?'Ít cay':''})),
  }));
}
const mode = params.get('state');
const data = mode === 'empty' ? [] : tables;
const previewNotice = '<p style="font:13px var(--font-ui);color:var(--muted);margin:0 0 16px">BẢN XEM THỬ · Dữ liệu giả lập · Không kết nối dữ liệu nhà hàng</p>';
const app = document.querySelector('#app');
if (staff) {
  app.innerHTML = `<header class="staff-app-header"><b>DUSKO · Nhân viên</b></header><main>${previewNotice}<div id="service-workspace" class="staff-app-surface"></div></main>`;
} else {
  app.innerHTML = `<div class="layout"><aside class="sidebar"><div class="brand"><span class="brand-mark">D</span><div><strong>DUSKO</strong><small>RESTAURANT OS</small></div></div><div class="workspace-label">ĐIỀU HÀNH NHÀ HÀNG</div><nav>${[['overview','Tổng quan'],['orders','Phục vụ & thu ngân'],['kitchen','Màn hình bếp'],['inventory','Kho hiện tại'],['forecast','Dự báo AI']].map(([id, label]) => `<div class="nav-item ${id === 'orders' ? 'active' : ''}"><span class="nav-icon">${navIcon(id)}</span>${label}</div>`).join('')}</nav></aside><main class="main"><header class="topbar"><span class="breadcrumb">Vận hành / Phục vụ & thu ngân</span><label class="branch-picker">Chi nhánh <select><option>Chi nhánh Quận 1</option></select></label></header><div class="content" id="page">${previewNotice}<div class="service-page-heading"><div class="page-head"><div><span class="eyebrow">VẬN HÀNH</span><h1>Phục vụ & thu ngân</h1><p>Quản lý bàn và hoàn tất thanh toán tại một nơi.</p></div></div></div><div id="service-workspace"></div></div></main></div>`;
}
async function request(path, options = {}) {
  if (path === '/api/live') throw Error('Preview: live updates disabled');
  await new Promise(resolve => setTimeout(resolve, mode === 'loading' ? 60000 : 180));
  if (mode === 'error') throw Error('Không thể kết nối. Vui lòng kiểm tra mạng và thử lại.');
  if (options.method) throw Error('Bản xem thử không ghi dữ liệu.');
  if (path.includes('/session?')) {
    const id = Number(path.match(/tables\/(\d+)/)?.[1]);
    return {table:tables.find(t => t.id === id), session:id <= 5 ? session : null, serviceRequests:[]};
  }
  if (path.includes('/tables')) return data;
  if (path === '/api/catalog/products') return products;
  throw Error('Thao tác này cần dữ liệu thật trong ứng dụng.');
}
const workspace = createServiceWorkspace({root:document.querySelector('#service-workspace'), request, branchId:1, role:staff ? 'WAITER' : 'CASHIER', userId:'preview'});
window.addEventListener('pagehide', () => workspace.destroy(), {once:true});
