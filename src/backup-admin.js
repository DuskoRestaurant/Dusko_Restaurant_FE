import { backupStatusHtml } from './backup-status.js';
import { sharedToast } from './toast.js';

export function mountBackupAdmin({ root, request, canCreate = true, pollMs = 4000, onAuthError = () => {} }) {
  let disposed = false, timer, loading = false, creating = false, dialog, refreshSeq = 0, failed = false;
  const toast = sharedToast();
  const schedule = () => { clearTimeout(timer); if (!disposed) timer = setTimeout(() => refresh().catch(() => {}), pollMs); };
  async function refresh() {
    if (disposed || loading || creating || dialog?.open) { schedule(); return; }
    const seq = ++refreshSeq; loading = true;
    try {
      const data = await request('/api/admin/backups', { cache: 'no-store' });
      if (disposed || seq !== refreshSeq) return;
      failed = false;
      if (!canCreate) data.capability = { ...data.capability, canCreate: false, reason: 'Cần đăng nhập bằng tài khoản ADMIN có Authenticator để tạo backup.' };
      // Keep focused controls focused after a background refresh.
      const focused = root.contains(document.activeElement) ? document.activeElement?.dataset?.backup : null;
      const scrolls = [...root.querySelectorAll('.table-scroll')].map(table => table.scrollLeft);
      root.innerHTML = backupStatusHtml(data);
      root.querySelectorAll('.table-scroll').forEach((table, index) => { table.scrollLeft = scrolls[index] || 0; });
      if (focused) root.querySelector(`[data-backup="${focused}"]`)?.focus({ preventScroll: true });
    } catch (error) {
      if (!disposed) {
        if ([401,403].includes(error.status)) { onAuthError(); return; }
        if (!root.querySelector('.backup-summary')) root.innerHTML = '<div class="error-panel" role="alert">Không tải được trạng thái backup. <button class="btn secondary" data-backup="refresh">Thử lại</button></div>';
        const create = root.querySelector('[data-backup=create]'); if (create) create.disabled = true;
        const notice = root.querySelector('.backup-capability'); if (notice) notice.textContent = 'Mất kết nối cập nhật trạng thái. Cần làm mới thành công trước khi tạo backup.';
        if (!failed) toast.error('Chưa cập nhật được trạng thái backup', error.message);
        failed = true;
      }
    } finally { loading = false; schedule(); }
  }
  function openCreate() {
    if (disposed || creating || dialog?.open || root.querySelector('[data-backup="create"]')?.disabled) return;
    clearTimeout(timer);
    dialog = document.createElement('dialog'); dialog.className = 'app-confirm backup-confirm';
    dialog.setAttribute('aria-labelledby', 'backup-confirm-title');
    dialog.innerHTML = '<form class="app-confirm__body"><h2 id="backup-confirm-title">Tạo bản sao lưu?</h2><p>Sao lưu PostgreSQL, MongoDB ứng dụng/AI và ảnh local vào kho riêng của máy chủ. Ảnh S3/Azure chưa được sao lưu. Dữ liệu giữa các nguồn được lấy tuần tự; thao tác này không khôi phục hoặc thay đổi dữ liệu đang bán hàng.</p><label class="field"><span>Mã Authenticator mới</span><input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required placeholder="6 chữ số"></label><p class="form-help">Nếu vừa dùng mã này để đăng nhập, chờ mã mới rồi xác nhận.</p><p class="backup-create-error" role="alert" hidden></p><div class="app-confirm__actions"><button class="app-confirm__button" type="button" data-cancel>Hủy</button><button class="app-confirm__button app-confirm__button--primary" type="submit">Xác nhận tạo backup</button></div></form>';
    const form = dialog.querySelector('form'), submit = form.querySelector('[type=submit]'), input = form.elements.code, errorBox = form.querySelector('.backup-create-error');
    const cancel = () => { if (!creating) dialog.close(); };
    dialog.querySelector('[data-cancel]').onclick = cancel;
    dialog.addEventListener('cancel', event => { if (creating) event.preventDefault(); });
    dialog.addEventListener('click', event => { if (event.target === dialog) cancel(); });
    const currentDialog = dialog;
    dialog.addEventListener('close', () => { currentDialog.remove(); if (dialog === currentDialog) dialog = null; if (!disposed) root.querySelector('[data-backup=create]')?.focus(); schedule(); }, { once: true });
    form.onsubmit = async event => {
      event.preventDefault(); if (creating || !form.reportValidity()) return;
      creating = true; submit.disabled = true; input.disabled = true; submit.textContent = 'Đang gửi…'; errorBox.hidden = true;
      try {
        await request('/api/admin/backups', { method: 'POST', body: { code: input.value.trim() } });
        if (disposed) return;
        input.value = ''; creating = false; dialog.close();
        toast.info('Đã tiếp nhận yêu cầu backup', 'Tác vụ đang chạy nền. Chỉ báo hoàn tất sau khi lưu bản sao và kiểm tra SHA-256.');
        await refresh();
      } catch (error) {
        if (disposed) return;
        errorBox.textContent = error.message; errorBox.hidden = false; input.value = '';
        if (error.status === 409) toast.info('Đã có tác vụ backup', 'Đóng hộp thoại và làm mới để theo dõi.');
      } finally { creating = false; if (dialog) { submit.disabled = false; input.disabled = false; submit.textContent = 'Xác nhận tạo backup'; input.focus(); } }
    };
    document.body.append(dialog); dialog.showModal(); input.focus();
  }
  const click = event => {
    const action = event.target.closest('[data-backup]')?.dataset.backup;
    if (action === 'refresh') void refresh();
    if (action === 'create') openCreate();
  };
  root.addEventListener('click', click);
  const ready = refresh();
  return { ready, destroy() { disposed = true; refreshSeq++; clearTimeout(timer); root.removeEventListener('click', click); if (dialog) { dialog.close(); dialog.remove(); dialog = null; } } };
}
