// Keep large catalogs bounded without changing the cart or backend API.
export function serviceMenuPage(products, {search = '', category = 'ALL', page = 1, pageSize = 8} = {}) {
  const query = search.trim().toLocaleLowerCase('vi');
  const matches = products.filter(product => product.isActive &&
    product.name.toLocaleLowerCase('vi').includes(query) &&
    (category === 'ALL' || product.category?.name === category));
  const pages = Math.max(1, Math.ceil(matches.length / pageSize));
  const current = Math.min(pages, Math.max(1, Math.trunc(page) || 1));
  const start = (current - 1) * pageSize;
  return {items: matches.slice(start, start + pageSize), total: matches.length,
    page: current, pages, start: matches.length ? start + 1 : 0,
    end: Math.min(start + pageSize, matches.length)};
}
