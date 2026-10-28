import {customerDishBadges} from './customer-dish-details.js';
export function customerMenuGroups(products, {search = '', tag = ''} = {}) {
  const query = search.trim().toLocaleLowerCase('vi');
  const groups = new Map();
  for (const product of products) {
    if (tag&&!customerDishBadges(product).some(badge=>badge.key===tag)) continue;
    if (!product.name.toLocaleLowerCase('vi').includes(query)) continue;
    const category = product.category?.name || 'Món khác';
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(product);
  }
  return [...groups].map(([name, products]) => ({name,total:products.length,items:products}));
}
