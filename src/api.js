export const API_BASE = (import.meta.env?.VITE_API_URL || '').replace(/\/$/, '');

export async function uploadProductImage(productId, file, token, fetcher = fetch) {
  const response = await fetcher(`${API_BASE}/api/catalog/products/${productId}/image`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': file.type }, body: file,
  });
  const payload = await response.json();
  if (!response.ok || payload.success === false) throw new ApiError(payload.error || 'Không thể tải ảnh lên', response.status);
  return payload.data;
}

export class ApiError extends Error {
  constructor(message, status) { super(message); this.name = 'ApiError'; this.status = status; }
}

export async function request(path, { method = 'GET', body, token, signal, headers = {}, responseType, fetcher = fetch } = {}) {
  const response = await fetcher(`${API_BASE}${path}`, {
    method, signal,
    headers: { ...headers, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if(response.ok && responseType==='blob') return response.blob();
  let payload;
  try { payload = await response.json(); } catch { throw new Error(`Máy chủ trả về dữ liệu không hợp lệ (${response.status})`); }
  if (!response.ok || payload.success === false) throw new ApiError(payload.error || payload.message || `Yêu cầu thất bại (${response.status})`, response.status);
  return payload.data ?? payload;
}

export const money = value => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value) || 0);
export const number = value => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(Number(value) || 0);
export const dateTime = value => value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—';
export const tomorrow = () => { const d = new Date(); d.setDate(d.getDate() + 1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
