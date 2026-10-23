// Authenticated WebSocket invalidation; REST APIs retain business authorization.
// The socket carries scoped change notifications only: the client decides what to
// refetch and every read still goes through the authorized REST API.

// Consumers signal control flow by throwing. `login` means this watcher belongs
// to a session that has been superseded, so retrying would refetch under a stale
// token; `busy` and `retry` mean "a request is already running, try again soon".
// Neither is a defect, so neither is retried as one or reported as an error.
const TERMINAL = new Set(['login']);
const TRANSIENT = new Set(['busy', 'retry']);
// A consumer that keeps failing must not turn into a permanent 1 Hz loop.
const MAX_EVENT_RETRIES = 5;

export function watchChanges(request, onChange, path = '/api/live', options = {}) {
  const { onEvent, onStatus } = options;
  let stopped = false, socket, reconnectTimer, retryTimer, eventRetryTimer, controller;
  let pending = false, refreshing = false, retries = 0, eventRetries = 0, lastMessage, connected = false;
  const report = value => { if (connected !== value) { connected = value; try { onStatus?.(value); } catch { /* ignore */ } } };
  async function refresh() {
    if (stopped || refreshing || !pending) return;
    refreshing = true; pending = false;
    try { await onChange(lastMessage); }
    catch (error) {
      if (stopped || TERMINAL.has(error?.message)) return;
      pending = true;
      if (!TRANSIENT.has(error?.message)) console.error('[live] refresh failed, retrying:', error);
      retryTimer = setTimeout(() => { retryTimer = null; refresh(); }, 1000);
    }
    finally { refreshing = false; }
    if (pending && !retryTimer && !stopped) queueMicrotask(refresh);
  }
  function changed(message) { lastMessage = message; pending = true; clearTimeout(retryTimer); retryTimer = null; refresh(); }
  function handleMessage(message) {
    if (message.type === 'event') {
      // A scoped event already says what changed, so the client can react
      // precisely instead of refetching everything.
      if (onEvent) {
        // onEvent is async. The previous sync try/catch could not observe its
        // rejection, so every failure escaped as an unhandled rejection and the
        // refresh was dropped silently. Settle it explicitly instead, and retry
        // transient failures with the same bounded backoff the socket uses.
        Promise.resolve()
          .then(() => onEvent(message))
          .then(() => { eventRetries = 0; })
          .catch(error => {
            if (stopped || TERMINAL.has(error?.message)) return;
            if (eventRetries === 0 && !TRANSIENT.has(error?.message)) console.error('[live event]', error);
            if (eventRetries >= MAX_EVENT_RETRIES) { eventRetries = 0; return; }
            const delay = Math.min(1000 * 2 ** eventRetries++, 15000);
            clearTimeout(eventRetryTimer);
            eventRetryTimer = setTimeout(() => { eventRetryTimer = null; handleMessage(message); }, delay);
          });
        return;
      }
      changed(message);
      return;
    }
    if (message.type === 'change') { clearTimeout(handshakeTimer); retries = 0; report(true); changed(message); }
  }
  let handshakeTimer;
  async function connect() {
    if (stopped) return;
    controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const ticket = await request(path, { signal: controller.signal });
      if (stopped) return;
      const base = import.meta.env?.VITE_API_URL || import.meta.env?.VITE_API_BASE_URL || location.origin;
      const url = new URL(ticket.path, base); url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = socket = new WebSocket(url);
      handshakeTimer = setTimeout(() => ws.close(), 10000);
      ws.onopen = () => ws.send(JSON.stringify({ type: 'authenticate', ticket: ticket.ticket }));
      ws.onmessage = event => { try { handleMessage(JSON.parse(event.data)); } catch { ws.close(); } };
      ws.onerror = () => ws.close();
      ws.onclose = () => { clearTimeout(handshakeTimer); report(false); if (!stopped) schedule(); };
    } catch { report(false); if (!stopped) schedule(); }
    finally { clearTimeout(timeout); }
  }
  function schedule() { clearTimeout(reconnectTimer); reconnectTimer = setTimeout(connect, Math.min(1000 * 2 ** retries++, 15000) + Math.random() * 300); }
  connect();
  return () => { stopped = true; clearTimeout(reconnectTimer); clearTimeout(retryTimer); clearTimeout(eventRetryTimer); clearTimeout(handshakeTimer); controller?.abort(); socket?.close(); };
}
