import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { buildInventoryTemplate, parseInventoryWorkbook } from '../src/inventory-excel.js';
const ingredients = [{ id: 1, code: 'NL-001', name: 'Gạo', unit: 'kg' }];
test('inventory Excel export/import preserves quantities and rejects formula input', async () => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await buildInventoryTemplate(ingredients));
  const sheet = workbook.getWorksheet('Nhap hang'); sheet.getCell('D2').value = 12.5;
  let result = await parseInventoryWorkbook(new File([await workbook.xlsx.writeBuffer()], 'inventory.xlsx'), 'RECEIVE', ingredients);
  assert.equal(result.rows[0].quantity, 12.5); assert.deepEqual(result.errors, []);
  sheet.getCell('D2').value = { formula: '1+1', result: 2 };
  result = await parseInventoryWorkbook(new File([await workbook.xlsx.writeBuffer()], 'inventory.xlsx'), 'RECEIVE', ingredients);
  assert.equal(result.rows.length, 0); assert.match(result.errors[0], /công thức/);
});
