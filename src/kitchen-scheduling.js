import { escapeHtml as e } from './api.js';
import './kitchen-scheduling.css';

export const kitchenStations = {
  WOK_STATION: 'Bếp xào',
  STEAM_STATION: 'Bếp hấp',
  FRY_STATION: 'Bếp chiên',
  BAR_STATION: 'Quầy pha chế',
  COLD_DISH: 'Món nguội',
};

const time = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' });
const clock = value => time.format(new Date(value));

export async function readKitchenSchedule(request, branchId, signal) {
  try {
    const timeout = AbortSignal.timeout(2500);
    const scheduleSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
    return await request(`/api/kds/branches/${branchId}/schedules/current`, { signal: scheduleSignal, cache: 'no-store' });
  } catch (error) {
    if (error.status === 404 || signal?.aborted) return null;
    return { status: 'FALLBACK', reason: 'Chưa cập nhật được lịch đề xuất. Bếp hiển thị theo thứ tự tiếp nhận.' };
  }
}

export function kitchenAssignments(schedule, batches) {
  if (schedule?.mode !== 'ADVISORY' || schedule.status !== 'READY' || schedule.validUntil <= Date.now()) {
    return new Map();
  }
  const assignments = new Map(schedule.assignments?.map(item => [item.batchId, item]));
  const byId = new Map(batches.map(batch => [batch.id, batch]));
  for (const item of assignments.values()) {
    const batch = byId.get(item.batchId);
    if (!batch || batch.status !== item.status || batch.totalQuantity !== item.quantity) return new Map();
  }
  if (batches.some(batch => batch.status === 'SCHEDULED' &&
      batch.orderItems?.some(item => item.order?.status === 'PENDING') && !assignments.has(batch.id))) return new Map();
  return assignments;
}

export function sortKitchenBatches(batches, assignments) {
  return [...batches].sort((a, b) => {
    const start = batch => batch.status === 'SCHEDULED'
      ? Date.parse(assignments.get(batch.id)?.startAt ?? '') : NaN;
    return (Number.isFinite(start(a)) ? start(a) : Infinity) -
      (Number.isFinite(start(b)) ? start(b) : Infinity) ||
      Date.parse(a.scheduledTime) - Date.parse(b.scheduledTime) || a.id - b.id;
  });
}

export function kitchenTiming(assignment, cooking) {
  if (!assignment) return '';
  return `<p class="ks-timing">${cooking ? '' : `Nấu lúc <strong>${clock(assignment.startAt)}</strong> · `}Dự kiến xong <strong>${clock(assignment.endAt)}</strong></p>`;
}

export function kitchenScheduleNotice(schedule, assignments) {
  if (!schedule || ['OFF', 'EMPTY'].includes(schedule.status)) return '';
  let message;
  if (schedule.status === 'FALLBACK') message = schedule.reason;
  else if (schedule.mode === 'SHADOW') message = 'Đang chạy thử điều phối. Danh sách bếp giữ thứ tự tiếp nhận.';
  else if (!assignments.size) message = 'Đang cập nhật lịch đề xuất. Bếp vẫn có thể bắt đầu mẻ.';
  else {
    message = schedule.lateOrders
      ? `Theo lịch đề xuất, ${schedule.lateOrders} lượt có thể vượt mục tiêu thời gian.`
      : 'Lịch đề xuất đã sắp các mẻ chờ theo giờ nấu dự kiến.';
  }
  return `<p class="ks-notice">${e(message)}</p>`;
}

const policyOptions = {
  mode: { OFF: 'Tắt đề xuất', SHADOW: 'Chạy thử', ADVISORY: 'Hiển thị đề xuất cho bếp' },
  priority: { BALANCED: 'Cân bằng', SPEED: 'Giảm thời gian chờ', STABLE: 'Hạn chế đổi lịch' },
};
const options = (choices, value) => Object.entries(choices).map(([key, label]) =>
  `<option value="${key}" ${key === value ? 'selected' : ''}>${label}</option>`,
).join('');

export function mountKitchenPolicy({ root, request, branchId, getBatches, onSaved }) {
  const base = `/api/kds/branches/${branchId}`;
  const controller = new AbortController();
  const call = (path, config) => request(base + path, { ...config, signal: controller.signal });
  let policy;
  let busy = false;
  root.innerHTML = `<details class="ks-policy"><summary>Mục tiêu và năng lực bếp</summary>
    <div data-ks-form></div><p class="ks-status" role="status"></p><div data-ks-preview></div>
  </details>`;
  const details = root.querySelector('details');
  const panel = root.querySelector('[data-ks-form]');
  const status = root.querySelector('[role="status"]');
  const preview = root.querySelector('[data-ks-preview]');
  const say = message => { if (!controller.signal.aborted) status.textContent = message; };

  function showForm() {
    panel.innerHTML = `<form class="ks-form">
      <div class="ks-fields">
        <label>Muốn đủ món trong bao lâu?<input name="target" type="number" required min="5" max="90" value="${policy.targetCompletionMinutes}"><small>Phút từ lúc bếp nhận một lượt gọi.</small></label>
        <label>Các món nên ra cách nhau bao lâu?<input name="gap" type="number" required min="0" max="30" value="${policy.targetDishGapMinutes}"><small>Phút giữa món đầu và món cuối cùng lượt.</small></label>
        <label>Ưu tiên khi đông khách<select name="priority">${options(policyOptions.priority, policy.priority)}</select></label>
        <label>Chế độ<select name="mode">${options(policyOptions.mode, policy.mode)}</select><small>Chạy thử tính lịch để đánh giá. Chế độ đề xuất đưa giờ nấu lên KDS.</small></label>
      </div>
      <fieldset><legend>Số mẻ nấu đồng thời ở mỗi trạm</legend><div class="ks-fields">${Object.entries(kitchenStations).map(([key, label]) =>
        `<label>${label}<input name="${key}" type="number" required min="0" max="8" value="${policy.stationSlots[key]}"></label>`,
      ).join('')}</div><small>Nhập 0 để loại trạm khỏi lập lịch. Nếu trạm đó còn mẻ, bếp dùng thứ tự tiếp nhận. Thời lượng lấy từ thực đơn.</small></fieldset>
      <p class="ks-help">Nhập mục tiêu phục vụ, khai báo khả năng thực tế của bếp, rồi xem thử lịch trước khi lưu. Khi quá tải, hệ thống báo số lượt có thể trễ.</p>
      ${policy.solverConfigured ? '' : '<p class="ks-notice">Chi nhánh sẽ dùng thứ tự tiếp nhận khi dịch vụ lập lịch chưa được kết nối.</p>'}
      <div class="ks-actions"><button class="btn secondary" type="submit" value="preview">Xem thử lịch</button><button class="btn primary" type="submit" value="save">Lưu cấu hình</button><button class="btn secondary" type="button" data-ks-reload>Tải cấu hình</button></div>
    </form>`;
  }

  async function load() {
    if (busy) return;
    busy = true;
    say('Đang tải cấu hình bếp…');
    try {
      policy = await call('/operating-policy');
      if (controller.signal.aborted) return;
      showForm();
      preview.replaceChildren();
      say('');
    } catch (error) { say(error.message); }
    finally { busy = false; }
  }

  details.addEventListener('toggle', () => { if (details.open && !policy) void load(); });
  panel.addEventListener('click', event => { if (event.target.closest('[data-ks-reload]')) void load(); });
  panel.addEventListener('input', () => preview.replaceChildren());
  panel.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !policy) return;
    const form = event.target;
    const fields = new FormData(form);
    const body = {
      expectedVersion: policy.version, mode: fields.get('mode'), priority: fields.get('priority'),
      targetCompletionMinutes: Number(fields.get('target')), targetDishGapMinutes: Number(fields.get('gap')),
      stationSlots: Object.fromEntries(Object.keys(kitchenStations).map(key => [key, Number(fields.get(key))])),
    };
    busy = true;
    const buttons = [...form.querySelectorAll('button')];
    const controls = [...form.querySelectorAll('input, select'), ...buttons];
    controls.forEach(control => { control.disabled = true; });
    preview.replaceChildren();
    const saving = event.submitter?.value === 'save';
    say(saving ? 'Đang lưu cấu hình…' : 'Đang tính lịch xem thử…');
    try {
      if (saving) {
        policy = await call('/operating-policy', { method: 'PUT', body });
        say('Đã lưu cấu hình cho chi nhánh.');
        if (!controller.signal.aborted) onSaved();
      } else {
        const result = await call('/schedules/preview', { method: 'POST', body });
        if (controller.signal.aborted) return;
        if (result.status !== 'READY') {
          say(result.reason || 'Hiện không có mẻ chờ để xếp lịch.');
          return;
        }
        const batches = new Map(getBatches().map(batch => [batch.id, batch]));
        const items = [...result.assignments].sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
        say(`Lịch xem thử có ${result.lateOrders} lượt dự kiến vượt mục tiêu.`);
        preview.innerHTML = `<ol class="ks-preview">${items.map(item => {
          const batch = batches.get(item.batchId);
          const name = batch?.product?.name ?? `Mẻ #${item.batchId}`;
          return `<li>${e(name)} · ${e(kitchenStations[batch?.stationType] || '')} · ${clock(item.startAt)}–${clock(item.endAt)}</li>`;
        }).join('')}</ol>`;
      }
    } catch (error) { say(error.message); }
    finally {
      busy = false;
      controls.forEach(control => { control.disabled = false; });
    }
  });
  return { destroy() { controller.abort(); } };
}
