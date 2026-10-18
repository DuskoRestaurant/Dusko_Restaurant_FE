export function readStoredJson(storage, key, fallback, valid = () => true) {
  try {
    const value = JSON.parse(storage.getItem(key) ?? 'null');
    return value !== null && valid(value) ? value : fallback;
  } catch { return fallback; }
}
export function storeJson(storage, key, value) {
  storage.setItem(key, JSON.stringify(value));
}
export function tryStoreJson(storage, key, value) {
  try { storeJson(storage, key, value); return true; } catch { return false; }
}

export function preparePendingOrder(storage, key, sessionId, items, createId = () => crypto.randomUUID(), combos = []) {
  let pending;
  try { pending = JSON.parse(storage.getItem(key) ?? 'null'); }
  catch { throw Error('Không đọc được bản nháp trên thiết bị. Nhờ nhân viên kiểm tra lượt gọi trước khi gửi lại'); }
  if (pending !== null && (typeof pending !== 'object' || typeof pending.id !== 'string' || !Array.isArray(pending.items))) {
    throw Error('Bản nháp trên thiết bị bị hỏng. Nhờ nhân viên kiểm tra lượt gọi trước khi gửi lại');
  }
  if (pending && pending.sessionId === sessionId && JSON.stringify(pending.items) === JSON.stringify(items) && JSON.stringify(pending.combos || []) === JSON.stringify(combos)) return pending;
  pending = { id: createId(), sessionId, items, ...(combos.length ? {combos} : {}) };
  try { storeJson(storage, key, pending); }
  catch { throw Error('Không lưu được mã yêu cầu trên thiết bị. Hãy cho phép lưu trữ hoặc nhờ nhân viên gọi món'); }
  return pending;
}
