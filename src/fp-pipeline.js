import { escapeHtml as e, number } from './api.js';
import { DEFAULT_THRESHOLDS, MAX_LENGTH_OPTIONS, parseThresholdForm, relaxOptions, withRelaxedThresholds, sortRules, barWidth, toFormValues } from './fp-rules.js';
import './fp-pipeline.css';

/** Số hàng hóa đơn hiển thị trên mỗi trang của cả hai bảng (dữ liệu gốc + ma trận). */
const PAGE_SIZE = 20;

/**
 * ============================================================================
 *  MÀN HÌNH LUỒNG FP-GROWTH
 * ============================================================================
 *
 *  Luồng minh họa: PostgreSQL → Node.js tinh chế → MongoDB lưu ma trận 0/1 → FP-Growth.
 *  Ngưỡng khai phá do người dùng chọn (không còn cố định).
 *
 *  @param root     phần tử DOM để gắn màn hình
 *  @param api      hàm gọi REST của ứng dụng
 *  @param branchId chi nhánh đang làm việc
 *  @param retained trạng thái giữ lại khi rời rồi quay lại trang (datasetId, kết quả, ngưỡng)
 *  @param options  { canApproveCombos, goToCombos } — quyền ADMIN và hàm chuyển sang mục Duyệt combo
 */
export async function mountFpPipeline(root, api, branchId, retained = {}, options = {}) {
  // ---- TRẠNG THÁI CỦA MÀN HÌNH ----
  let dataset = null;      // snapshot ma trận hiện đang mở (từ MongoDB)
  let result = null;       // kết quả khai phá (tập phổ biến + luật)
  let page = 0;            // trang hiện tại (đánh số từ 0)
  let busy = false;        // đang gọi API → khóa nút bấm để tránh gọi trùng
  let thresholds = { ...DEFAULT_THRESHOLDS, ...(retained.thresholds || {}) };  // ngưỡng khai phá
  let sort = { key: 'lift', dir: 'desc' };  // cột đang sắp xếp của bảng luật
  let snapshots = [];      // danh sách snapshot của chi nhánh (lịch sử)
  let message = '';        // thông báo trạng thái hiển thị cho người dùng
  const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);   // hôm nay theo UTC+7
  let from = new Date(Date.parse(today) - 59 * 86400000).toISOString().slice(0, 10), to = today;  // mặc định 60 ngày

  // ---- HÀM HIỂN THỊ ----
  // Định dạng tỷ lệ thành phần trăm (0.25 → "25.00%").
  const pct = value => `${(Number(value || 0) * 100).toFixed(2)}%`;
  // Đổi danh sách MÃ MÓN trong luật thành tên món để hiển thị (tra cùng dataset.columns).
  const names = ids => (ids || []).map(id => e(dataset?.columns.find(c => String(c.id) === String(id))?.name || id)).join(' + ');
  // Thanh chỉ số trực quan dưới mỗi con số phần trăm.
  const bar = (value, scale = 1) => `<span class="fp-bar"><i style="width:${barWidth(value, scale)}%"></i></span>`;
  // Bảng cuộn ngang, dùng chung cho mọi bảng trên màn hình.
  const table = (headers, rows) => `<div class="fp-scroll"><table><thead><tr>${headers.map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.map(c => `<tr>${c.map(x => `<td>${x}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;

  // Danh sách luật đã sắp xếp theo cột người dùng đang chọn (không sửa mảng gốc).
  const sortedRules = () => sortRules(result?.rules, sort);
  // Ô tiêu đề có nút bấm để sắp xếp; mũi tên ▼/▲ cho biết hướng hiện tại.
  const sortHeader = (key, label) => `<button type="button" class="fp-sort" data-sort="${key}">${label}${sort.key === key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}</button>`;
  // Tổng số hàng của dataset (ưu tiên giá trị từ server, fallback về độ dài mảng).
  const totalRowsOf = ds => ds?.pagination?.totalRows ?? ds?.rows.length ?? 0;

  /**
   * Khối nhập ngưỡng khai phá (mục 3).
   * Giá trị hiển thị lấy từ `thresholds` hiện tại nên người dùng luôn thấy đúng
   * ngưỡng đang chạy.
   */
  function thresholdFields() {
    const values = toFormValues(thresholds);
    return `<div class="fp-thresholds">
      <label>Support tối thiểu (%)<input type="number" name="support" min="0.1" max="100" step="0.1" value="${values.support}" ${busy ? 'disabled' : ''}></label>
      <label>Confidence tối thiểu (%)<input type="number" name="confidence" min="0" max="100" step="1" value="${values.confidence}" ${busy ? 'disabled' : ''}></label>
      <label>Lift tối thiểu<input type="number" name="lift" min="0" max="100" step="0.1" value="${values.lift}" ${busy ? 'disabled' : ''}></label>
      <label>Số món tối đa mỗi tập<select name="maxLength" ${busy ? 'disabled' : ''}>${MAX_LENGTH_OPTIONS.map(v => `<option value="${v}" ${String(v) === values.maxLength ? 'selected' : ''}>${v} món</option>`).join('')}</select></label>
    </div>`;
  }

  /**
   * Hộp gợi ý khi không có luật nào đạt ngưỡng.
   * Đây là điểm quan trọng: trước đây người dùng chỉ thấy dòng "Không có luật đạt ngưỡng"
   * và không có cách nào thoát ra. Giờ màn hình đề xuất nút nới ngưỡng cụ thể.
   */
  function relaxHint() {
    // Có luật rồi thì không hiện hộp gợi ý.
    if (!result || result.ruleCount) return '';
    const suggestions = relaxOptions(thresholds);
    // Đã ở mức lỏng nhất thì chỉ báo, không có gì để đề xuất.
    if (!suggestions.length) return '<p class="fp-warn">Không có luật nào đạt ngưỡng hiện tại.</p>';
    return `<div class="fp-empty"><p><b>Không có luật nào đạt ngưỡng.</b> Đã tìm ${number(result.patternCount)} tập phổ biến nhưng chưa tập nào sinh ra luật đủ tin cậy.</p>
      <p>Thử nới ngưỡng:</p><div class="fp-actions">${suggestions.map(s => `<button type="button" class="btn secondary" data-relax="${s.key}" data-value="${s.value}">${s.label}</button>`).join('')}
      <button type="button" class="btn secondary" data-relax="all" data-value="0">Nới tất cả</button></div></div>`;
  }

  /**
   * Vẽ lại toàn bộ màn hình từ trạng thái hiện tại.
   * Cách làm: dựng chuỗi HTML rồi gán vào innerHTML, sau đó gắn lại sự kiện.
   * Vì innerHTML thay thế toàn bộ cây DOM nên sự kiện phải gắn lại sau MỖI lần vẽ.
   */
  function draw() {
    // Màn hình đã bị tháo khỏi DOM (người dùng chuyển trang) → không vẽ nữa.
    if (!root.isConnected) return;
    // Dữ liệu hiển thị của TRANG hiện tại.
    //   • có pagination → server đã cắt sẵn, dùng luôn dataset.rows
    //   • không có      → cắt trong bộ nhớ
    const rows = dataset ? (dataset.pagination ? dataset.rows : dataset.rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)) : [];
    const totalRows = dataset?.pagination?.totalRows ?? dataset?.rows.length ?? 0;
    const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
    const rules = sortedRules();
    // Ngưỡng support TUYỆT ĐỐI của lần khai phá (ví dụ "ít nhất 18 giỏ") —
    // giúp người dùng thấy ngưỡng thật thay vì chỉ nhìn phần trăm.
    const minCount = result?.minCount ?? 0;
    const transactions = result?.transactions ?? dataset?.pagination?.totalRows ?? 0;

    root.innerHTML = `<div class="fp-pipeline"><header><span>THỰC HÀNH DỮ LIỆU · NODE.JS</span><h1>Từ hóa đơn đến gợi ý món</h1><p>PostgreSQL → Node.js tinh chế → MongoDB lưu ma trận 0/1 → FP-Growth</p></header>
      <section class="panel"><form id="fp-form"><label>Từ ngày<input type="date" name="from" required value="${e(from)}" ${busy ? 'disabled' : ''}></label><label>Đến ngày<input type="date" name="to" required value="${e(to)}" ${busy ? 'disabled' : ''}></label><button class="btn primary" ${busy ? 'disabled' : ''}>1. Đọc SQL và lưu ma trận</button><button type="button" class="btn secondary" id="fp-mine" ${busy || !dataset ? 'disabled' : ''}>2. Đọc MongoDB và chạy FP-Growth</button></form><p role="status" aria-live="polite">${e(message)}</p><p>Không giới hạn khoảng ngày. Tối đa 50.000 hóa đơn và 2.000.000 ô ma trận mỗi lần; bộ dữ liệu phải vừa giới hạn lưu MongoDB. Chỉ lấy đơn đã thanh toán, ngày theo UTC+7. Số lượng nhiều suất vẫn được mã hóa thành 1. Thao tác tạo bộ dữ liệu mới, không sửa hóa đơn.</p></section>
      ${dataset ? `<div class="fp-summary"><strong>${number(totalRows)} hóa đơn</strong><strong>${number(dataset.columns.length)} cột món</strong>${minCount ? `<strong>Ngưỡng thực tế: ít nhất ${number(minCount)} giỏ</strong>` : ''}</div><p>Bộ dữ liệu MongoDB: <code>${e(dataset._id)}</code> · Ngày bán ${e(dataset.from)} → ${e(dataset.to)} · Bỏ ${number(dataset.emptyOrders)} hóa đơn rỗng</p>` : ''}

      <section class="panel"><h2>1. Dữ liệu gốc từ PostgreSQL</h2><p>Mỗi hóa đơn có các dòng món và số lượng; đây là bản chụp tại lúc tinh chế.</p>${dataset ? table(['Hóa đơn', 'Nguồn', 'Món × số lượng'], rows.map(r => [e(r.orderCode || r.orderId), e(r.origin), r.raw.map(i => `${names([i.productId])} × ${i.quantity}`).join('<br>')])) : '<p>Chọn khoảng ngày rồi nhấn “Đọc SQL và lưu ma trận”.</p>'}</section>
      <section class="panel"><h2>2. Dữ liệu tinh chế đã đọc từ MongoDB</h2><p>Mỗi dòng là một hóa đơn, mỗi cột là một mã món. <b>1 = có món</b>, 0 = không có. Kéo ngang để xem các cột.</p>${dataset ? table(['Hóa đơn', ...dataset.columns.map(c => `${e(c.name)}<br><small>ID ${c.id}</small>`)], rows.map(r => [e(r.orderCode || r.orderId), ...r.bits.map(b => `<span class="fp-bit ${b ? 'one' : ''}">${b}</span>`)])) : '<p>Chưa có bộ dữ liệu.</p>'}
        ${dataset ? `<div class="fp-pager"><button id="fp-prev" class="btn secondary" ${page === 0 || busy ? 'disabled' : ''}>Trang trước</button><span>Trang ${page + 1}/${totalPages} · ${PAGE_SIZE} hóa đơn/trang cho cả hai bảng</span><button id="fp-next" class="btn secondary" ${(page + 1) * PAGE_SIZE >= totalRows || busy ? 'disabled' : ''}>Trang sau</button></div>` : ''}</section>

      <section class="panel"><h2>3. Ngưỡng khai phá</h2><p>Chọn ngưỡng rồi chạy lại. Nâng ngưỡng giúp loại luật yếu; hạ ngưỡng giúp thấy thêm liên hệ yếu nhưng cần nhiều dữ liệu hơn để tin.</p>
        <form id="fp-threshold-form">${thresholdFields()}<button type="submit" class="btn primary" ${busy || !dataset ? 'disabled' : ''}>Chạy FP-Growth với ngưỡng này</button></form>
        <p class="fp-hint">Support là tỷ lệ giỏ hàng có chứa cả nhóm món. Confidence là tỷ lệ khách đã có nhóm món đầu thì cũng gọi nhóm món sau. Lift đo mức liên hệ so với hai nhóm độc lập; lift = 1 nghĩa là không liên quan.</p></section>

      <section class="panel"><h2>4. Kết quả FP-Growth</h2>${result ? `<p><b>${number(result.patternCount)} tập phổ biến · ${number(result.ruleCount)} luật</b> · ${Number(result.elapsedMs).toFixed(1)} ms khai phá, chưa tính thời gian đọc MongoDB.</p>
        <p>Nguồn: ${e(result.source)} · Bộ dữ liệu ${e(result.datasetId)} · ${number(result.transactions)} giỏ hàng · Ngưỡng: support ${pct(result.thresholds.support)} · confidence ${pct(result.thresholds.confidence)} · lift ${result.thresholds.lift} · tối đa ${result.thresholds.maxLength} món/tập.</p>
        <p class="fp-hint">Hiển thị tối đa ${number(result.returnedPatternCount ?? result.patterns.length)}/${number(result.patternCount)} tập và ${number(result.returnedRuleCount ?? result.rules.length)}/${number(result.ruleCount)} luật.</p>
        <h3>Nhóm món phổ biến</h3>${result.patterns.length ? table(['Nhóm món', 'Số giỏ', 'Support', ''], result.patterns.map(p => [names(p.items), number(p.supportCount), pct(p.support), bar(p.support)])) : '<p>Không có tập phổ biến nào đạt ngưỡng.</p>'}
        <h3>Luật gợi ý</h3>${rules.length ? table([sortHeader('support', 'Support'), sortHeader('confidence', 'Confidence'), sortHeader('lift', 'Lift'), 'Nhóm món'], rules.map(r => [`${pct(r.support)}${bar(r.support)}`, `${pct(r.confidence)}${bar(r.confidence)}`, `${Number(r.lift).toFixed(3)}${bar(Math.min(1, r.lift / 3))}`, `${names(r.antecedents)} <span class="fp-arrow">→</span> ${names(r.consequents)}`])) : (relaxHint() || '<p>Không có luật nào đạt ngưỡng.</p>')}
        ${options.canApproveCombos && options.goToCombos ? '<div class="fp-actions"><button type="button" class="btn primary" id="fp-go-combos">Duyệt combo từ các luật này</button></div><p class="fp-hint">Combo lấy từ bộ dữ liệu đang mở. Sang mục <b>Duyệt combo</b> để đặt giá ưu đãi và duyệt trước khi hiển thị cho khách.</p>' : ''}
        ` : '<p>Chọn ngưỡng rồi nhấn “Chạy FP-Growth với ngưỡng này”.</p>'}
        <p>Confidence là tỷ lệ trong lịch sử, không phải độ chính xác dự đoán khách sẽ mua. Nhãn nguồn giữ nguyên như database.</p></section>

      <section class="panel"><h2>5. Lịch sử bộ dữ liệu</h2><p>Giữ tối đa 5 snapshot mới nhất cho mỗi chi nhánh; snapshot cũ tự động bị dọn khi tạo bản mới.</p>
        ${snapshots.length ? table(['Ngày bán', 'Số hóa đơn', 'Số món', 'Đã lưu lúc', ''], snapshots.map(s => [`${e(s.from)} → ${e(s.to)}`, number(s.transactionCount), number(s.columnCount), new Date(s.createdAt).toLocaleString('vi-VN'), `<button type="button" class="btn secondary fp-delete" data-dataset="${e(s.id)}" ${busy ? 'disabled' : ''}>Xóa</button>`])) : '<p>Chưa có snapshot nào.</p>'}</section></div>`;

    // ---- GẮN SỰ KIỆN (phải làm sau mỗi lần vẽ lại vì innerHTML thay thế toàn bộ) ----
    // Nút "1. Đọc SQL và lưu ma trận": chọn khoảng ngày → POST /fp-pipeline/refine.
    root.querySelector('#fp-form').onsubmit = event => { event.preventDefault(); const form = new FormData(event.target); from = form.get('from'); to = form.get('to'); run('refine'); };
    // Nút "2. Đọc MongoDB và chạy FP-Growth": dùng ngưỡng ĐANG CHỌN.
    root.querySelector('#fp-mine').onclick = () => run('mine');
    // Nút phân trang (dùng chung cho cả hai bảng).
    root.querySelector('#fp-prev')?.addEventListener('click', () => changePage(page - 1));
    root.querySelector('#fp-next')?.addEventListener('click', () => changePage(page + 1));
    // Form ngưỡng: đọc 4 giá trị → đơn vị engine → chạy lại khai phá.
    root.querySelector('#fp-threshold-form')?.addEventListener('submit', event => { event.preventDefault(); applyThresholds(Object.fromEntries(new FormData(event.target))); });
    // Bấm tiêu đề cột → đảo chiều sắp xếp nếu đang sắp theo cột đó, mặc định giảm dần.
    root.querySelectorAll('[data-sort]').forEach(button => button.onclick = () => {
      const key = button.dataset.sort;
      sort = { key, dir: sort.key === key && sort.dir === 'desc' ? 'asc' : 'desc' };
      draw();
    });
    // Bấm nút "nới ngưỡng" → áp dụng ngưỡng mới rồi khai phá lại ngay.
    root.querySelectorAll('[data-relax]').forEach(button => button.onclick = () => {
      thresholds = withRelaxedThresholds(thresholds, button.dataset.relax, Number(button.dataset.value));
      run('mine');
    });
    // Bấm "Xóa" trong lịch sử snapshot.
    root.querySelectorAll('.fp-delete').forEach(button => button.onclick = () => removeSnapshot(button.dataset.dataset));
    // Chuyển sang mục "Duyệt combo" (chỉ hiện với ADMIN).
    root.querySelector('#fp-go-combos')?.addEventListener('click', () => options.goToCombos());
  }

  /**
   * Áp dụng ngưỡng mới từ form rồi chạy lại khai phá.
   * Sai định dạng → hiện thông báo, KHÔNG gọi API.
   */
  function applyThresholds(form) {
    try { thresholds = parseThresholdForm(form); }
    catch (error) { message = error.message; draw(); return; }
    run('mine');
  }

  /**
   * Xóa một snapshot. Nếu đang xóa chính snapshot đang mở thì đóng luôn màn hình kết quả.
   */
  async function removeSnapshot(id) {
    if (busy) return;
    busy = true; message = 'Đang xóa bộ dữ liệu…'; draw();
    try {
      await api(`/api/fp-pipeline/dataset?branchId=${branchId}&datasetId=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (dataset && String(dataset._id) === String(id)) { dataset = null; result = null; page = 0; }
      snapshots = snapshots.filter(s => String(s.id) !== String(id));
      message = 'Đã xóa bộ dữ liệu.';
    } catch (err) { message = `Không hoàn tất: ${err.message}`; }
    finally { busy = false; draw(); }
  }

  /**
   * Chuyển trang ma trận.
   * Nếu dataset không có phân trang (đọc toàn bộ) thì cắt trong bộ nhớ.
   * Nếu có phân trang thì hỏi server (dùng $slice nên không tải toàn bộ document).
   */
  async function changePage(next) {
    if (busy || !dataset) return;
    if (!dataset.pagination) { page = Math.max(0, next); draw(); return; }
    if (next < 0 || (next + 1) * PAGE_SIZE > totalRowsOf(dataset)) return;
    busy = true; message = 'Đang đọc trang hóa đơn từ MongoDB…'; draw();
    try {
      // `page` của API bắt đầu từ 1, biến `page` nội bộ bắt đầu từ 0.
      const data = await api(`/api/fp-pipeline?branchId=${branchId}&page=${next + 1}&datasetId=${encodeURIComponent(dataset._id)}`);
      // Server có thể đã bị dọn snapshot → báo lỗi rõ ràng thay vì hiện dữ liệu cũ.
      if (!data.dataset || String(data.dataset._id) !== String(dataset._id)) throw new Error('Bộ dữ liệu không còn tồn tại. Mở lại Luồng FP-Growth để tải dữ liệu mới.');
      dataset = data.dataset; page = next; message = 'Đã tải trang hóa đơn từ MongoDB.';
    } catch (err) { message = `Không hoàn tất: ${err.message}`; }
    finally { busy = false; draw(); }
  }

  /** Tải danh sách snapshot cho mục "Lịch sử bộ dữ liệu". Lỗi thì để danh sách rỗng. */
  async function loadSnapshots() {
    try { const data = await api(`/api/fp-pipeline/datasets?branchId=${branchId}`); snapshots = data.datasets || []; }
    catch { snapshots = []; }
  }

  /**
   * Hàm chạy chung cho hai hành động:
   *   • 'refine' → POST /fp-pipeline/refine : hóa đơn PostgreSQL → tinh chế → lưu ma trận MongoDB.
   *   • 'mine'   → POST /fp-pipeline/mine   : đọc ma trận MongoDB → chạy FP-Growth.
   *
   * Trong cả hai trường hợp, ngưỡng đang chọn luôn được gửi kèm để backend
   * dùng đúng thứ người dùng nhìn thấy trên form.
   */
  async function run(action) {
    // Đang gọi API thì bỏ qua thao tác mới để tránh gọi trùng.
    if (busy) return;
    // Chưa có ma trận thì không thể khai phá.
    if (action === 'mine' && !dataset) { message = 'Chưa có bộ dữ liệu. Hãy tạo ma trận trước.'; draw(); return; }
    busy = true; message = action === 'refine' ? 'Đang đọc PostgreSQL và lưu MongoDB…' : 'Đang đọc ma trận từ MongoDB và khai phá…'; draw();
    try {
      // Body: refine không cần ngưỡng; mine thì BẮT BUỘC gửi ngưỡng.
      const body = action === 'refine' ? { branchId, from, to } : { branchId, datasetId: dataset._id, thresholds };
      // `?page=1` khiến refine trả về luôn trang đầu + thông tin phân trang để vẽ ngay.
      const data = await api(`/api/fp-pipeline/${action}${action === 'refine' ? '?page=1' : ''}`, { method: 'POST', body });
      // refine trả về snapshot mới (kết quả cũ không còn đúng) → xoá kết quả và về trang đầu.
      if (action === 'refine') { dataset = data.dataset; page = 0; result = null; }
      // mine trả về kết quả khai phá.
      else result = data;
      // Lưu vào `retained` để khi rời rồi quay lại trang vẫn thấy kết quả cũ.
      retained.result = result; retained.datasetId = dataset._id; retained.thresholds = thresholds;
      message = action === 'refine' ? 'Đã lưu và đọc lại bộ dữ liệu từ MongoDB.' : 'Đã khai phá xong từ bộ dữ liệu MongoDB.';
      // Làm mới danh sách lịch sử snapshot (vừa tạo mới hoặc vừa xoá).
      await loadSnapshots();
    } catch (err) { message = `Không hoàn tất: ${err.message}`; }
    finally { busy = false; draw(); }
  }

  // ---- KHỞI TẠO: tải snapshot đã lưu gần nhất của chi nhánh ----
  busy = true; message = 'Đang tìm bộ dữ liệu đã lưu của chi nhánh…'; draw();
  try {
    const data = await api(`/api/fp-pipeline?branchId=${branchId}&page=1`);
    dataset = data.dataset;
    // Nếu có snapshot: đồng bộ khoảng ngày theo snapshot và khôi phục kết quả cũ
    // (chỉ khôi phục khi snapshot đó ĐÚNG là snapshot đang mở).
    if (dataset) { from = dataset.from; to = dataset.to; if (String(retained.datasetId) === String(dataset._id)) result = retained.result || null; }
    await loadSnapshots();
    message = dataset ? 'Đã tải bộ dữ liệu gần nhất từ MongoDB.' : 'Chưa có dữ liệu tinh chế. Hãy chọn ngày và tạo bộ dữ liệu.';
  } catch (err) { message = `Không kết nối được: ${err.message}`; }
  finally { busy = false; draw(); }
}
