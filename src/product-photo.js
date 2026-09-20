import { escapeHtml as e } from './api.js';
import { API_BASE } from './api.js';

export function productPhoto(product, className = 'product-photo') {
  if (/^\/dishes\/[a-z0-9-]+\.(?:png|jpg|webp)$/.test(product.imageUrl || ''))
    return `<img class="${className}" src="${e(product.imageUrl)}" alt="${e(product.name)}" loading="lazy">`;
  if (/^\/api\/uploads\/dishes\/[a-f0-9-]+\.(?:png|jpg|webp)$/.test(product.imageUrl || ''))
    return `<img class="${className}" src="${e(API_BASE + product.imageUrl)}" alt="${e(product.name)}" loading="lazy">`;
  let url;
  try {
    url = new URL(product.imageUrl);
    if (!['https:', 'http:'].includes(url.protocol)) throw new Error();
  } catch { return `<div class="${className} no-photo" aria-label="Chưa có ảnh món">Chưa có ảnh</div>`; }
  return `<img class="${className}" src="${e(url.href)}" alt="${e(product.name)}" loading="lazy" referrerpolicy="no-referrer">`;
}
