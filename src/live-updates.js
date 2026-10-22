// Authenticated WebSocket invalidation; REST APIs retain business authorization.
// The socket carries scoped change notifications only: the client decides what to
// refetch and every read still goes through the authorized REST API.
export function watchChanges(request, onChange, path = '/api/live', options = {}) {
  const { onEvent, onStatus } = options;
  let stopped = false, socket, reconnectTimer, retryTimer, controller;
  let pending = false, refreshing = false, retries = 0, lastMessage, connected = false;
  const report = value => { if (connected !== value) { connected = value; try { onStatus?.(value); } catch { /* ignore */ } } };
  async function refresh() {
    if (stopped || refreshing || !pending) return;
    refreshing = true; pending = false;
    try { await onChange(lastMessage); }
    catch { pending = true; retryTimer = setTimeout(() => { retryTimer = null; refresh(); }, 1000); }
    finally { refreshing = false; }
    if (pending && !retryTimer && !stopped) queueMicrotask(refresh);
  }
  function changed(message) { lastMessage = message; pending = true; clearTimeout(retryTimer); retryTimer = null; refresh(); }
  function handleMessage(message) {
    if (message.type === 'event') {
      // A scoped event already says what changed, so the client can react
      // precisely instead of refetching everything.
      if (onEvent) { try { onEvent(message); } catch (error) { console.error('[live event]', error); } return; }
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
  return () => { stopped = true; clearTimeout(reconnectTimer); clearTimeout(retryTimer); controller?.abort(); socket?.close(); };
}
