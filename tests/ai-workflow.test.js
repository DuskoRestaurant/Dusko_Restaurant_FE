import test from 'node:test';
import assert from 'node:assert/strict';
import {forecastSummary,ingredientPlanMarkup,reviewDayMarkup} from '../src/ai-workflow.js';
test('forecast summary separates learned predictions from historical fallback',()=>{
 assert.deepEqual(forecastSummary([{modelType:'LSTM',predictedQuantity:12},{modelType:'BASELINE_MA',predictedQuantity:8.5}]),{dishes:2,portions:20.5,learned:1,historical:1});
});
test('action outputs show actual purchase suggestions and net daily money safely',()=>{
 const plan=ingredientPlanMarkup([{ingredient:{name:'<script>bad</script>',unit:'kg'},grossDemand:12,suggestedOrderQty:3,approvedByUser:false}]);
 assert.match(plan,/1 nguyên liệu cần bổ sung/);assert.match(plan,/Chờ xem xét/);assert.doesNotMatch(plan,/<script>/);
 const report=reviewDayMarkup({orderCount:1,netRevenue:80000,discountTotal:20000,orders:[{orderCode:'HD1',createdAt:'2026-10-18T10:00:00Z',discountAmount:20000,finalAmount:80000,dataOrigin:'REAL'}]});
 assert.match(report,/80\.000/);assert.match(report,/Đơn thật/);assert.match(report,/17:00/);
});
