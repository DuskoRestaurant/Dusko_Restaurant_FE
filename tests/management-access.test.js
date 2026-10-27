import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canAccessManagement } from '../src/management-access.js';

describe('management lock: ADMIN/MANAGER only', () => {
  it('ADMIN and MANAGER pass', () => {
    assert.equal(canAccessManagement({ role: 'ADMIN' }), true);
    assert.equal(canAccessManagement({ role: 'MANAGER' }), true);
  });
  it('CASHIER, WAITER, CHEF are locked out', () => {
    assert.equal(canAccessManagement({ role: 'CASHIER' }), false);
    assert.equal(canAccessManagement({ role: 'WAITER' }), false);
    assert.equal(canAccessManagement({ role: 'CHEF' }), false);
  });
  it('UserRole extra MANAGER unlocks a WAITER-primary account', () => {
    assert.equal(canAccessManagement({ role: 'WAITER', roles: ['WAITER', 'MANAGER'] }), true);
  });
  it('UserRole extra CHEF does not unlock a WAITER', () => {
    assert.equal(canAccessManagement({ role: 'WAITER', roles: ['WAITER', 'CHEF'] }), false);
  });
  it('no user is locked out', () => {
    assert.equal(canAccessManagement(null), false);
    assert.equal(canAccessManagement(undefined), false);
  });
});
