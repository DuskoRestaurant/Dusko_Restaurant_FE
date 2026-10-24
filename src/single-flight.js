/**
 * Collapse concurrent calls that share a key onto a single in-flight promise.
 *
 * Use it around mutating requests that a user can trigger more than once
 * (double click, repeated Enter, a retry button held down). The entry is
 * released when the work settles, on success and on failure alike, so a
 * genuine retry after an error still runs while a still-pending request is
 * never duplicated.
 *
 * @returns {(key: string, work: () => Promise<any>) => Promise<any>}
 */
export function createSingleFlight() {
  const inFlight = new Map();

  function run(key, work) {
    const active = inFlight.get(key);
    if (active) return active;

    const pending = (async () => work())();
    inFlight.set(key, pending);

    // Release on both paths. Comparing identity keeps a newer entry (queued by
    // an explicit retry) from being dropped by an older settling promise.
    const release = () => { if (inFlight.get(key) === pending) inFlight.delete(key); };
    pending.then(release, release);

    return pending;
  }

  /** True while a call for `key` is still running. */
  run.pending = key => inFlight.has(key);
  /** Number of distinct calls currently in flight. */
  run.size = () => inFlight.size;

  return run;
}