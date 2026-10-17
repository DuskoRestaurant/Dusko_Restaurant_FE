// Memory only: entries never survive sign-out, mutations, or a live invalidation.
export function createReadCache({ now = Date.now, onRefresh = () => {}, onError = () => {}, maxEntries = 100 } = {}) {
  const entries = new Map(), pending = new Map();
  let generation = 0;
  function clear() { generation++; entries.clear(); pending.clear(); }
  function read(key, fetchFresh, { ttl = 15000, maxAge = 60000 } = {}) {
    const entry = entries.get(key), age = entry ? now() - entry.at : Infinity;
    function fetchEntry(background) {
      if (pending.has(key)) return pending.get(key);
      const revision = generation;
      const promise = Promise.resolve().then(fetchFresh).then(value => {
        if (generation === revision) {
          entries.delete(key); entries.set(key, { value, at: now() });
          if (entries.size > maxEntries) entries.delete(entries.keys().next().value);
          if (background) onRefresh(key);
        }
        return value;
      }).catch(error => {
        if (generation === revision) { entries.delete(key); if (background) onError(error, key); }
        throw error;
      }).finally(() => { if (pending.get(key) === promise) pending.delete(key); });
      pending.set(key, promise);
      return promise;
    }
    if (age < ttl) return Promise.resolve(entry.value);
    if (age < maxAge) { fetchEntry(true).catch(() => {}); return Promise.resolve(entry.value); }
    return fetchEntry(false);
  }
  return { read, clear };
}
