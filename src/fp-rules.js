/**
 * ============================================================================
 *  LOGIC THUẦN CHO MÀN HÌNH FP-GROWTH
 * ============================================================================
 *
 *  Tách riêng khỏi fp-pipeline.js (file này có import CSS nên không chạy được
 *  trong Node test). Giữ ở đây các hàm không đụng DOM để test được độc lập.
 *
 *  Đơn vị: form dùng PHẦN TRĂM (5 = 5%), engine dùng TỶ LỆ (0.05).
 *  Hàm parseThresholdForm() là nơi quy đổi giữa hai đơn vị.
 * ============================================================================
 */

/** Ngưỡng mặc định khi người dùng chưa chọn (trùng với FP_DEFAULT_THRESHOLDS của backend). */
export const DEFAULT_THRESHOLDS = { support: 0.05, confidence: 0.3, lift: 1.2, maxLength: 3 };

/** Các lựa chọn số món tối đa mỗi tập hiển thị trong select. */
export const MAX_LENGTH_OPTIONS = [2, 3, 4, 5, 6];

/**
 * Đọc form ngưỡng và trả về ngưỡng theo đơn vị của engine.
 *
 * @param values { support: '5', confidence: '30', lift: '1.2', maxLength: '3' }
 * @returns { support: 0.05, confidence: 0.3, lift: 1.2, maxLength: 3 }
 * @throws Error với thông báo tiếng Việt nếu giá trị không hợp lệ
 */
export function parseThresholdForm(values) {
  // Chia 100 để đổi phần trăm → tỷ lệ.
  const support = Number(values.support) / 100;
  const confidence = Number(values.confidence) / 100;
  const lift = Number(values.lift);
  const maxLength = Number(values.maxLength);

  // Number('') = 0 và Number('abc') = NaN → cả hai đều bị chặn ở đây.
  if (!Number.isFinite(support) || support <= 0 || support > 1) throw new Error('Support phải nằm trong khoảng 0,1% – 100%.');
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) throw new Error('Confidence phải nằm trong khoảng 0% – 100%.');
  if (!Number.isFinite(lift) || lift < 0) throw new Error('Lift phải là số không âm.');
  // maxLength phải là số nguyên; trần 20 khớp với giới hạn bitmask của engine.
  if (!Number.isInteger(maxLength) || maxLength < 1 || maxLength > 20) throw new Error('Số món tối đa mỗi tập phải là số nguyên từ 1 đến 20.');

  return { support, confidence, lift, maxLength };
}

/**
 * Gợi ý các ngưỡng "nới" khi không có luật nào đạt.
 * Chỉ đề xuất nới (làm ngưỡng dễ hơn), không bao giờ siết chặt hơn.
 *
 * @param thresholds ngưỡng hiện tại
 * @returns danh sách { key, value, label } — rỗng nếu ngưỡng đã ở mức lỏng nhất
 */
export function relaxOptions(thresholds) {
  const options = [];
  if (thresholds.confidence > 0.2) options.push({ key: 'confidence', value: 0.2, label: 'Hạ confidence xuống 20%' });
  if (thresholds.lift > 1) options.push({ key: 'lift', value: 1, label: 'Hạ lift xuống 1,0' });
  if (thresholds.support > 0.02) options.push({ key: 'support', value: 0.02, label: 'Hạ support xuống 2%' });
  return options;
}

/**
 * Áp dụng một đề xuất nới ngưỡng (hoặc tất cả) lên một BẢN SAO của ngưỡng.
 *
 * @param thresholds ngưỡng hiện tại
 * @param key        'confidence' | 'lift' | 'support' | 'all'
 * @param value      giá trị mới (bỏ qua khi key = 'all')
 */
export function withRelaxedThresholds(thresholds, key, value) {
  // 'all' → áp dụng lần lượt từng đề xuất có sẵn.
  if (key === 'all') {
    const options = relaxOptions(thresholds);
    return options.reduce((next, option) => ({ ...next, [option.key]: option.value }), { ...thresholds });
  }
  // Ngưỡng khác giữ nguyên, chỉ đổi một ngưỡng.
  return { ...thresholds, [key]: value };
}

/**
 * Sắp xếp danh sách luật theo một chỉ số, KHÔNG sửa mảng gốc.
 *
 * @param rules mảng luật từ server
 * @param sort  { key: 'lift'|'support'|'confidence', dir: 'asc'|'desc' }
 */
export function sortRules(rules, sort) {
  const copy = [...(rules || [])];
  // dir = 'asc' → tăng dần; còn lại (kể cả undefined) → giảm dần.
  const direction = sort?.dir === 'asc' ? 1 : -1;
  const key = sort?.key || 'lift';
  return copy.sort((a, b) => {
    const left = a[key], right = b[key];
    // Nếu giá trị là chuỗi thì so sánh theo thứ tự chữ cái.
    if (typeof left === 'string' || typeof right === 'string') return String(left).localeCompare(String(right)) * direction;
    // Giá trị thiếu được coi là 0 để không phá vỡ phép so sánh.
    return ((left ?? 0) - (right ?? 0)) * direction;
  });
}

/**
 * Bề rộng thanh chỉ số (theo %) cho một giá trị.
 * Clamp trong khoảng 2–100 để luôn nhìn thấy thanh, kể cả khi giá trị rất nhỏ.
 *
 * @param value giá trị chỉ số (0..1 cho support/confidence)
 * @param scale hệ số nhân (ví dụ lift dùng /3 để lift=3 hiển thị trọn thanh)
 */
export function barWidth(value, scale = 1) {
  const percent = Math.max(2, Math.min(100, (Number(value) || 0) * 100 * scale));
  return percent.toFixed(1);
}

/**
 * Chuyển ngưỡng (đơn vị engine) sang giá trị hiển thị trong form (phần trăm).
 * Ngược lại với parseThresholdForm().
 */
export function toFormValues(thresholds) {
  const merged = { ...DEFAULT_THRESHOLDS, ...(thresholds || {}) };
  return {
    support: (merged.support * 100).toFixed(1),
    confidence: String(Math.round(merged.confidence * 100)),
    lift: String(merged.lift),
    maxLength: String(merged.maxLength),
  };
}
