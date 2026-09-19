import test from 'node:test';
import assert from 'node:assert/strict';
import { readQueue, pendingFor, applySyncResults } from './offline.js';

test('pending orders stay isolated by employee and branch', () => {
  const queue = [{ id: 'a', userId: 1, branchId: 2 }, { id: 'b', userId: 2, branchId: 2 }, { id: 'c', userId: 1, branchId: 3 }];
  assert.deepEqual(pendingFor(queue, 1, 2).map(x => x.id), ['a']);
  assert.deepEqual(readQueue({ getItem: () => '{broken' }), []);
});

test('sync removes successful and duplicate orders while retaining failures', () => {
  const queue = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
  assert.deepEqual(applySyncResults(queue, [{ id: 'a', status: 'synced' }, { id: 'b', status: 'duplicate' }, { id: 'c', status: 'failed', error: 'Bàn bận' }]), [{ id: 'c', error: 'Bàn bận' }, { id: 'd', error: undefined }]);
});
