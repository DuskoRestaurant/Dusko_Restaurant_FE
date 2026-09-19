export const QUEUE_KEY = 'dusko_pending_orders';

export function readQueue(storage) {
  try { const value = JSON.parse(storage.getItem(QUEUE_KEY) || '[]'); return Array.isArray(value) ? value : []; }
  catch { return []; }
}

export function saveQueue(storage, queue) { storage.setItem(QUEUE_KEY, JSON.stringify(queue)); }

export function pendingFor(queue, userId, branchId) {
  return queue.filter(order => order.userId === userId && order.branchId === branchId);
}

export function applySyncResults(queue, results) {
  const byId = new Map(results.map(result => [result.id, result]));
  return queue.flatMap(order => {
    const result = byId.get(order.id);
    if (result?.status === 'synced' || result?.status === 'duplicate') return [];
    return [{ ...order, error: result?.status === 'failed' ? result.error || 'Không thể đồng bộ' : order.error }];
  });
}
