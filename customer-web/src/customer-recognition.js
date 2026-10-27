// Phase 3 — Customer recognition after QR scan.
// Guest is the default: browsing and ordering always work without identity.
// Returning/new customers are identified only by a masked lookup; full
// benefits apply only after staff verifies the customer at the table
// (server-authoritative: checkout uses the session's verified customer).
export function createRecognition({ token, request, onVerified }) {
  let mode = localStorage.getItem(`dusko-customer-mode:${token}`) || 'guest';
  let verified = null;
  let pollTimer = null;
  const esc = v => String(v ?? '').replace(/[&<>\"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  function html() {
    if (verified) return `<section class="customer-recognition verified"><h2>Xin chào, ${esc(verified.maskedName)}</h2><p>Hạng: <b>${esc(verified.tierName || 'Khách quen')}</b> · Đã được nhân viên xác nhận tại bàn.</p>${verified.promotions?.length ? `<p>Ưu đãi áp dụng cho đơn này:</p><ul>${verified.promotions.map(p => `<li>${esc(p.name)} (${esc(p.code)})</li>`).join('')}</ul><p><small>Giảm giá và quà tặng được tính ở máy chủ khi gửi đơn, không áp dụng cho giỏ chung của bàn khác.</small></p>` : '<p>Chưa có ưu đãi riêng cho hạng của bạn.</p>'}</section>`;
    return `<section class="customer-recognition"><h2>Bạn đã từng đến Dusko chưa?</h2><div class="recognition-choices">
      <button type="button" data-rec-mode="returning">Tôi là khách quen</button>
      <button type="button" data-rec-mode="new">Tôi là khách mới</button>
      <button type="button" data-rec-mode="guest">Tiếp tục với tư cách khách</button></div>
      <div id="recognition-form"></div><p id="recognition-message" class="message" role="status"></p></section>`;
  }
  function formHtml() {
    if (mode === 'returning') return `<label>Số điện thoại <input id="rec-phone" inputmode="tel" placeholder="09xx xxx xxx"></label><button type="button" id="rec-lookup">Tìm tài khoản</button><div id="rec-lookup-result"></div>`;
    if (mode === 'new') return `<label>Họ tên <input id="rec-name" placeholder="Họ tên"></label><label>Số điện thoại <input id="rec-phone" inputmode="tel" placeholder="09xx xxx xxx"></label><button type="button" id="rec-register">Đăng ký nhanh</button>`;
    return `<p>Bạn đang gọi món với tư cách khách. Không cần đăng ký.</p>`;
  }
  async function pollVerified() {
    try {
      const data = await request(`/api/public/tables/${token}/customer`);
      if (data?.verified) { verified = data; onVerified?.(data); render(); }
    } catch {}
  }
  function startPoll() { if (!pollTimer) pollTimer = setInterval(pollVerified, 8000); }
  function render() {
    const holder = document.querySelector('#customer-recognition');
    if (!holder) return;
    holder.innerHTML = html();
    holder.querySelectorAll('[data-rec-mode]').forEach(b => b.onclick = () => { mode = b.dataset.recMode; localStorage.setItem(`dusko-customer-mode:${token}`, mode); render(); });
    const form = holder.querySelector('#recognition-form');
    if (form) form.innerHTML = formHtml();
    const msg = holder.querySelector('#recognition-message');
    const lookup = holder.querySelector('#rec-lookup');
    if (lookup) lookup.onclick = async () => {
      const phone = holder.querySelector('#rec-phone').value;
      try {
        const data = await request(`/api/public/tables/${token}/customer/lookup`, { method: 'POST', body: JSON.stringify({ phone }) });
        const result = holder.querySelector('#rec-lookup-result');
        if (!data.exists) { result.innerHTML = '<p>Chưa tìm thấy tài khoản với số này. Bạn có thể đăng ký mới hoặc gọi món với tư cách khách.</p>'; return; }
        result.innerHTML = `<p>Tìm thấy: ${esc(data.maskedName)} · Số: ${esc(data.phone)}${data.tierName ? ` · Hạng: ${esc(data.tierName)}` : ''}</p><p>Vui lòng nhờ nhân viên xác nhận tại bàn để nhận ưu đãi. Hệ thống sẽ tự cập nhật khi nhân viên xác nhận.</p>`;
        startPoll(); pollVerified();
      } catch (e) { if (msg) msg.textContent = e.message; }
    };
    const reg = holder.querySelector('#rec-register');
    if (reg) reg.onclick = async () => {
      try {
        await request(`/api/public/tables/${token}/customer/register`, { method: 'POST', body: JSON.stringify({ fullName: holder.querySelector('#rec-name').value, phone: holder.querySelector('#rec-phone').value }) });
        if (msg) msg.textContent = 'Đã đăng ký. Vui lòng nhờ nhân viên xác nhận tại bàn để nhận ưu đãi.';
        startPoll(); pollVerified();
      } catch (e) { if (msg) msg.textContent = e.message; }
    };
  }
  return { render, pollVerified, startPoll, get verified() { return verified; } };
}
