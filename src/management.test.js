import test from 'node:test';
import assert from 'node:assert/strict';
import { locationsHtml, catalogHtml, recipeEntries } from './management.js';

test('management views escape server text and expose role-specific controls', () => {
  const html = catalogHtml({ categories: [{ id: 1, code: 'A', name: '<script>' }], products: [], admin: false, chef: true });
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /new-category/);
  assert.match(locationsHtml({ branches: [], tables: [], branchId: 1, admin: false }), /new-table/);
});

test('recipe validation rejects duplicates and invalid waste', () => {
  assert.deepEqual(recipeEntries([{ ingredientId: '2', quantity: '0.5', wasteRate: '0.05' }]), [{ ingredientId: 2, quantity: 0.5, wasteRate: 0.05 }]);
  assert.throws(() => recipeEntries([{ ingredientId: 2, quantity: 1, wasteRate: 0 }, { ingredientId: 2, quantity: 1, wasteRate: 0 }]));
  assert.throws(() => recipeEntries([{ ingredientId: 2, quantity: 1, wasteRate: 1 }]));
});
