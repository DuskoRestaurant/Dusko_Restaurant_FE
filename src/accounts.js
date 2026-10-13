import { escapeHtml as e } from './api.js';

export function passwordDialog(api, signedOut) {
  const dialog = document.createElement('dialog');
  dialog.className = 'account-dialog';
  dialog.innerHTML = `<form><h2>Đổi mật khẩu</h2><p>Sau khi đổi, bạn cần đăng nhập lại trên các thiết bị.</p><label>Mật khẩu hiện tại<input type="password" name="currentPassword" autocomplete="current-password" required></label><label>Mật khẩu mới<input type="password" name="newPassword" autocomplete="new-password" minlength="10" required></label><small>Ít nhất 10 ký tự, có chữ và số.</small><label>Nhập lại mật khẩu mới<input type="password" name="repeatPassword" autocomplete="new-password" required></label><p role="status"></p><div class="account-actions"><button class="btn secondary close" type="button">Đóng</button><button class="btn primary" type="submit">Đổi mật khẩu</button></div></form>`;
  document.body.append(dialog); dialog.showModal();
  dialog.addEventListener('close', () => dialog.remove());
  dialog.querySelector('.close').onclick = () => dialog.close();
  dialog.querySelector('form').onsubmit = async event => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const status = dialog.querySelector('[role=status]');
    if (data.newPassword !== data.repeatPassword) { status.textContent = 'Hai mật khẩu mới chưa khớp.'; return; }
    const button = dialog.querySelector('[type=submit]'); button.disabled = true;
    try { await api('/api/auth/password', { method: 'POST', body: { currentPassword: data.currentPassword, newPassword: data.newPassword } }); dialog.close(); signedOut(); }
    catch (error) { status.textContent = error.message; }
    finally { button.disabled = false; }
  };
}

export async function mountAccounts(root, api, branches, session = {}) {
  const roles = { ADMIN: 'Quản trị viên', MANAGER: 'Quản lý', CASHIER: 'Thu ngân', WAITER: 'Phục vụ', CHEF: 'Bếp' };
  let selected;
  const users = await api('/api/users');
  if (!root.isConnected) return;
  root.innerHTML = `<div class="page-head"><div><h1>Tài khoản nhân viên</h1><p>Phân quyền, gán chi nhánh và quản lý quyền đăng nhập.</p></div><button class="btn secondary" id="new-account">Thêm tài khoản</button></div><p role="status"></p><div class="table-scroll"><table><thead><tr><th>Tài khoản</th><th>Họ tên</th><th>Vai trò</th><th>Chi nhánh</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${users.map(user => `<tr><td>${e(user.username)}</td><td>${e(user.fullName)}</td><td>${e(roles[user.role])}</td><td>${e(branches.find(b => b.id === user.branchId)?.name || 'Toàn hệ thống')}</td><td>${user.isActive ? 'Hoạt động' : 'Đã khóa'}</td><td><button class="btn secondary" data-edit="${user.id}">Chỉnh sửa</button> <button class="btn secondary" data-revoke="${user.id}">Thu hồi phiên</button></td></tr>`).join('')}</tbody></table></div><section id="account-editor" class="panel" hidden></section>`;
  const editor = root.querySelector('#account-editor');
  function edit(user) {
    selected = user; editor.hidden = false;
    editor.innerHTML = `<h2>${user ? 'Chỉnh sửa tài khoản' : 'Tạo tài khoản'}</h2><form class="account-form"><label>Tên đăng nhập<input name="username" value="${e(user?.username || '')}" ${user ? 'readonly' : 'required'} pattern="[a-zA-Z0-9_.-]{3,50}"></label><label>Họ tên<input name="fullName" value="${e(user?.fullName || '')}" maxlength="100" required></label><label>Vai trò<select name="role">${Object.entries(roles).map(([value, label]) => `<option value="${value}" ${value === (user?.role || 'WAITER') ? 'selected' : ''}>${label}</option>`).join('')}</select></label><label>Chi nhánh<select name="branchId"><option value="">Toàn hệ thống (chỉ Admin)</option>${branches.map(b => `<option value="${b.id}" ${b.id === (user?.branchId ?? (!user ? branches[0]?.id : null)) ? 'selected' : ''}>${e(b.name)}</option>`).join('')}</select></label><label>${user ? 'Đặt lại mật khẩu (để trống nếu giữ nguyên)' : 'Mật khẩu'}<input name="password" type="password" autocomplete="new-password" minlength="10" ${user ? '' : 'required'}></label><label>Trạng thái<select name="isActive"><option value="true">Hoạt động</option><option value="false" ${user?.isActive === false ? 'selected' : ''}>Khóa đăng nhập</option></select></label><p>Thay đổi tài khoản sẽ thu hồi các phiên đăng nhập cũ.</p><p role="status"></p><div class="account-actions"><button class="btn primary" type="submit">Lưu tài khoản</button><button class="btn secondary" type="button" id="cancel-account">Đóng</button></div></form>`;
    editor.querySelector('#cancel-account').onclick = () => { editor.hidden = true; };
    editor.querySelector('form').onsubmit = async event => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget));
      data.isActive = data.isActive === 'true'; data.branchId = data.branchId ? Number(data.branchId) : null;
      if (selected && !data.password) delete data.password;
      const button = editor.querySelector('[type=submit]'); button.disabled = true;
      try { await api(`/api/users${selected ? '/' + selected.id : ''}`, { method: selected ? 'PATCH' : 'POST', body: data }); if(selected?.id === session.userId) { session.signedOut?.(); return; } await mountAccounts(root, api, branches, session); root.querySelector('[role=status]').textContent = 'Đã lưu tài khoản.'; }
      catch (error) { editor.querySelector('[role=status]').textContent = error.message; }
      finally { button.disabled = false; }
    };
    editor.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  root.querySelector('#new-account').onclick = () => edit();
  root.querySelectorAll('[data-edit]').forEach(button => { button.onclick = () => edit(users.find(user => user.id === Number(button.dataset.edit))); });
  root.querySelectorAll('[data-revoke]').forEach(button => { button.onclick = async () => {
    button.disabled = true;
    try { await api(`/api/users/${button.dataset.revoke}/revoke-sessions`, { method: 'POST' }); if(Number(button.dataset.revoke) === session.userId) { session.signedOut?.(); return; } root.querySelector('[role=status]').textContent = 'Đã thu hồi phiên đăng nhập của tài khoản.'; }
    catch (error) { root.querySelector('[role=status]').textContent = error.message; }
    finally { button.disabled = false; }
  }; });
}
