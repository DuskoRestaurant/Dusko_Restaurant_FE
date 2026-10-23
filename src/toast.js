import './toast.css';

const ICONS = { success: '✓', error: '×', warning: '!', info: 'i' };
const DEFAULT_DURATION = 5000;

/**
 * Lightweight toast notifications.
 *
 * The same component is mounted by the customer menu, the staff app and the
 * management console so a "staff called" notice looks the same everywhere.
 * Class names are namespaced because the console already ships its own `.toast`.
 */
export function createToast({ container } = {}) {
  const host = container || (() => {
    const element = document.createElement('div');
    element.className = 'dusko-toast-stack';
    element.setAttribute('role', 'region');
    element.setAttribute('aria-label', 'Thông báo');
    document.body.appendChild(element);
    return element;
  })();

  const timers = new WeakMap();

  function dismiss(element) {
    const timer = timers.get(element);
    if (timer) { clearTimeout(timer); timers.delete(element); }
    element.classList.add('dusko-toast--leaving');
    const remove = () => element.remove();
    element.addEventListener('animationend', remove, { once: true });
    // Fallback for browsers that skip the animation.
    setTimeout(remove, 400);
  }

  function show({ title, message, type = 'info', duration = DEFAULT_DURATION, onClick } = {}) {
    if (!title && !message) return null;
    const element = document.createElement('div');
    element.className = `dusko-toast dusko-toast--${type}`;
    element.setAttribute('role', type === 'error' ? 'alert' : 'status');
    element.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
    element.innerHTML = `<span class="dusko-toast__icon" aria-hidden="true">${ICONS[type] || ICONS.info}</span>`
      + `<div class="dusko-toast__body">${title ? '<strong class="dusko-toast__title"></strong>' : ''}${message ? '<p class="dusko-toast__message"></p>' : ''}</div>`
      + `<button type="button" class="dusko-toast__close" aria-label="Đóng thông báo">×</button>`;
    // Text is assigned as text content so menu or table names can never inject markup.
    if (title) element.querySelector('.dusko-toast__title').textContent = title;
    if (message) element.querySelector('.dusko-toast__message').textContent = message;
    element.querySelector('.dusko-toast__close').onclick = () => dismiss(element);
    if (onClick) {
      element.classList.add('dusko-toast--actionable');
      element.onclick = event => {
        if (event.target.closest('.dusko-toast__close')) return;
        onClick();
        dismiss(element);
      };
    }
    host.appendChild(element);
    // Keep the stack short so a busy table cannot bury the screen in notices.
    while (host.children.length > 4) host.firstElementChild?.remove();
    if (duration > 0) timers.set(element, setTimeout(() => dismiss(element), duration));
    return element;
  }

  return {
    show,
    success: (title, message, options) => show({ title, message, type: 'success', ...options }),
    error: (title, message, options) => show({ title, message, type: 'error', ...options }),
    warning: (title, message, options) => show({ title, message, type: 'warning', ...options }),
    info: (title, message, options) => show({ title, message, type: 'info', ...options }),
    dismiss: () => { [...host.children].forEach(dismiss); },
  };
}

let shared = null;

/**
 * The console runs several surfaces at once (shell actions, the service
 * workspace, live notices). They used to each build their own stack, which put
 * three independent notification regions on one page — inconsistent ordering
 * and no single live region for a screen reader to follow. This hands out one
 * instance so every surface announces through the same region.
 */
export function sharedToast() {
  if (!shared) shared = createToast();
  return shared;
}
