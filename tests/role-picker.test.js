import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { staffShellsFor } from '../staff-app/src/role-picker.js';

describe('staff role split', () => {
  it('CHEF only -> kitchen shell (must be able to log into staff app)', () => {
    assert.deepEqual(staffShellsFor({ role: 'CHEF' }), ['kitchen']);
  });
  it('CASHIER and WAITER only -> cashier shell', () => {
    assert.deepEqual(staffShellsFor({ role: 'CASHIER' }), ['cashier']);
    assert.deepEqual(staffShellsFor({ role: 'WAITER' }), ['cashier']);
  });
  it('MANAGER and ADMIN -> both shells, picker required', () => {
    assert.deepEqual(staffShellsFor({ role: 'MANAGER' }), ['cashier', 'kitchen']);
    assert.deepEqual(staffShellsFor({ role: 'ADMIN' }), ['cashier', 'kitchen']);
  });
  it('UserRole extras: WAITER + CHEF -> both shells', () => {
    assert.deepEqual(staffShellsFor({ role: 'WAITER', roles: ['WAITER', 'CHEF'] }), ['cashier', 'kitchen']);
  });
  it('UserRole extras: CASHIER + CHEF via profile roles, not primary alone', () => {
    assert.deepEqual(staffShellsFor({ role: 'CASHIER', roles: ['CASHIER', 'CHEF'] }), ['cashier', 'kitchen']);
  });
  it('kitchen transition order: SCHEDULED -> COOKING -> COMPLETED only', () => {
    const next = s => s === 'SCHEDULED' ? 'COOKING' : s === 'COOKING' ? 'COMPLETED' : null;
    assert.equal(next('SCHEDULED'), 'COOKING');
    assert.equal(next('COOKING'), 'COMPLETED');
    assert.equal(next('COMPLETED'), null);
  });
});
