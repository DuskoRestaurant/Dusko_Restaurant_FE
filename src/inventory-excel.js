import ExcelJS from 'exceljs';

const normalise = value => String(value ?? '').trim().toLocaleLowerCase('vi').replace(/[đĐ]/g, 'd').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');

const textValue = value => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    if ('formula' in value || 'sharedFormula' in value) throw new Error('Không dùng công thức Excel trong cột dữ liệu; hãy dán kết quả thành giá trị.');
    if (Array.isArray(value.richText)) return value.richText.map(part => part.text || '').join('').trim();
    if ('text' in value) return String(value.text || '').trim();
  }
  return String(value).trim();
};

function formatWorksheet(sheet, headers, rows) {
  sheet.addRow(headers);
  for (const row of rows) sheet.addRow(row);
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).alignment = { vertical: 'middle', wrapText: true };
  sheet.getRow(1).height = 34;
  sheet.columns.forEach((column, index) => { column.width = [24, 30, 14, 29, 38][index] || 18; });
}

export async function buildInventoryTemplate(ingredients) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Dusko Restaurant';
  workbook.subject = 'Mẫu nhập hàng và đếm kho';
  const guide = workbook.addWorksheet('Huong dan');
  guide.addRows([
    ['DUSKO · MẪU KHO'],
    ['Chỉ nhập dữ liệu vào một trong hai sheet tương ứng với thao tác.'],
    ['Sheet Nhap hang: điền số hàng vừa nhận. Hệ thống cộng số này vào tồn hiện có.'],
    ['Sheet Dem kho: đếm toàn bộ hàng đang có rồi điền tổng. Hệ thống thay số tồn cũ bằng số đếm.'],
    ['Dòng để trống ở cột số lượng sẽ được bỏ qua. Không xóa hoặc sửa mã nguyên liệu.'],
    ['Không thêm nguyên liệu mới trong file. Tạo nguyên liệu trong trang Kho hiện tại trước.'],
    ['Lưu file dưới định dạng .xlsx rồi tải lên Dusko. Tối đa 500 dòng mỗi lần.'],
  ]);
  guide.getColumn(1).width = 112;
  guide.getColumn(1).alignment = { wrapText: true, vertical: 'middle' };
  guide.getRow(1).font = { bold: true, size: 16 };

  const common = ingredients.slice().sort((a, b) => a.name.localeCompare(b.name, 'vi')).map(item => [item.code, item.name, item.unit, null, null]);
  const receive = workbook.addWorksheet('Nhap hang');
  formatWorksheet(receive, ['Mã nguyên liệu', 'Tên nguyên liệu', 'Đơn vị', 'Số lượng nhập thêm', 'Ghi chú / mã phiếu'], common);
  const count = workbook.addWorksheet('Dem kho');
  formatWorksheet(count, ['Mã nguyên liệu', 'Tên nguyên liệu', 'Đơn vị', 'Tổng số đếm được', 'Ghi chú kiểm đếm'], common);
  return workbook.xlsx.writeBuffer();
}

export async function parseInventoryWorkbook(file, mode, ingredients) {
  if (!file || !/\.xlsx$/i.test(file.name || '')) throw new Error('Chọn file Excel .xlsx.');
  if (file.size > 10 * 1024 * 1024) throw new Error('File vượt quá 10 MB.');
  if (!['RECEIVE', 'COUNT'].includes(mode)) throw new Error('Chọn Nhập hàng hoặc Đếm kho trước.');

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const worksheetName = mode === 'RECEIVE' ? 'Nhap hang' : 'Dem kho';
  const sheet = workbook.getWorksheet(worksheetName);
  if (!sheet) throw new Error(`File thiếu sheet “${worksheetName}”. Tải mẫu Dusko rồi chọn đúng thao tác.`);

  const headerRow = sheet.getRow(1);
  const headers = new Map();
  headerRow.eachCell((cell, column) => headers.set(normalise(textValue(cell.value)), column));
  const codeColumn = headers.get('manguyenlieu') ?? headers.get('ingredientcode') ?? headers.get('code');
  const nameColumn = headers.get('tennguyenlieu') ?? headers.get('ingredientname') ?? headers.get('name');
  const quantityColumn = mode === 'RECEIVE'
    ? (headers.get('soluongnhapthem') ?? headers.get('soluongnhan') ?? headers.get('quantity'))
    : (headers.get('tongsodemduoc') ?? headers.get('tongsothucte') ?? headers.get('quantity'));
  const noteColumn = headers.get('ghichu') ?? headers.get('ghichumaphieu') ?? headers.get('note');
  if ((!codeColumn && !nameColumn) || !quantityColumn) throw new Error('Không nhận ra tiêu đề cột. Dùng mẫu Dusko và không đổi tên cột số lượng.');

  const byCode = new Map(ingredients.map(item => [normalise(item.code), item]));
  const byName = new Map();
  for (const item of ingredients) {
    const key = normalise(item.name);
    byName.set(key, [...(byName.get(key) || []), item]);
  }
  const rows = [];
  const errors = [];
  let blankRows = 0;
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    try {
      const code = codeColumn ? textValue(row.getCell(codeColumn).value) : '';
      const name = nameColumn ? textValue(row.getCell(nameColumn).value) : '';
      const rawQuantity = row.getCell(quantityColumn).value;
      if (rawQuantity === null || rawQuantity === undefined || rawQuantity === '') { blankRows++; return; }
      const match = code ? byCode.get(normalise(code)) : null;
      const named = name ? byName.get(normalise(name)) : null;
      if (code && !match) throw new Error(`không tìm thấy mã “${code}”`);
      if (!code && (!named || named.length !== 1)) throw new Error(named?.length ? `tên “${name}” trùng nhiều nguyên liệu` : `không tìm thấy nguyên liệu “${name}”`);
      if (match && named?.length === 1 && named[0].id !== match.id) throw new Error('mã và tên chỉ đến hai nguyên liệu khác nhau');
      const ingredient = match || named[0];
      let quantity;
      if (typeof rawQuantity === 'number') quantity = rawQuantity;
      else {
        let value = textValue(rawQuantity).replace(/\s/g, '');
        if (value.includes(',') && value.includes('.')) value = value.replace(/\./g, '').replace(',', '.');
        else value = value.replace(',', '.');
        quantity = Number(value);
      }
      if (!Number.isFinite(quantity) || quantity < 0 || quantity > 1000000) throw new Error('số lượng phải từ 0 đến 1.000.000');
      if (mode === 'RECEIVE' && quantity <= 0) throw new Error('số nhập phải lớn hơn 0');
      const note = noteColumn ? textValue(row.getCell(noteColumn).value) : '';
      if (note.length > 300) throw new Error('ghi chú vượt quá 300 ký tự');
      rows.push({ code: ingredient.code, name: ingredient.name, unit: ingredient.unit, quantity, note, rowNumber });
    } catch (error) { errors.push(`Dòng ${rowNumber}: ${error.message}`); }
  });
  if (!rows.length && !errors.length) errors.push('Sheet không có số lượng nào để nhập.');
  if (rows.length > 500) errors.push('Mỗi lần chỉ nhập tối đa 500 dòng.');
  const seen = new Set();
  for (const row of rows) {
    const key = normalise(row.code);
    if (seen.has(key)) errors.push(`Dòng ${row.rowNumber}: mã nguyên liệu bị lặp.`);
    seen.add(key);
  }
  return { rows, blankRows, errors };
}
