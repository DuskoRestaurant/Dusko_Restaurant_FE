import './confirm-dialog.css';

let activeDialog = null;

export function confirmDialog({
  title = 'Xác nhận thao tác',
  message = 'Bạn có chắc muốn tiếp tục?',
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Hủy',
  danger = false,
} = {}) {
  if (activeDialog) return Promise.resolve(false);

  return new Promise(resolve => {
    const dialog = document.createElement('dialog');
    dialog.className = 'app-confirm';
    dialog.setAttribute('aria-labelledby', 'app-confirm-title');
    dialog.innerHTML = '<div class="app-confirm__body"><h2 class="app-confirm__title" id="app-confirm-title"></h2><p class="app-confirm__message"></p><div class="app-confirm__actions"><button type="button" class="app-confirm__button" data-confirm="cancel"></button><button type="button" class="app-confirm__button" data-confirm="accept"></button></div></div>';
    dialog.querySelector('.app-confirm__title').textContent = title;
    dialog.querySelector('.app-confirm__message').textContent = message;
    dialog.querySelector('[data-confirm="cancel"]').textContent = cancelLabel;
    const accept = dialog.querySelector('[data-confirm="accept"]');
    accept.textContent = confirmLabel;
    accept.classList.add(danger ? 'app-confirm__button--danger' : 'app-confirm__button--primary');

    let result = false;
    const finish = value => {
      if (!dialog.open) return;
      result = value;
      dialog.close();
    };
    dialog.querySelector('[data-confirm="cancel"]').addEventListener('click', () => finish(false));
    accept.addEventListener('click', () => finish(true));
    dialog.addEventListener('click', event => { if (event.target === dialog) finish(false); });
    dialog.addEventListener('close', () => {
      activeDialog = null;
      dialog.remove();
      resolve(result);
    }, { once: true });

    activeDialog = dialog;
    document.body.append(dialog);
    dialog.showModal();
    dialog.querySelector('[data-confirm="cancel"]').focus();
  });
}
