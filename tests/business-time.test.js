import test from 'node:test';
import assert from 'node:assert/strict';
import {businessExcelDate} from '../src/business-time.js';
test('Excel wall clock is UTC+7, including midnight and year rollover',()=>{
 assert.equal(businessExcelDate('2026-12-31T17:00:00Z').toISOString(),'2027-01-01T00:00:00.000Z');
 assert.equal(businessExcelDate('2026-10-28T01:15:00Z').toISOString(),'2026-10-28T08:15:00.000Z');
});
