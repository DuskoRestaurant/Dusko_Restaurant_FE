import test from 'node:test';
import assert from 'node:assert/strict';
import {forecastSummary,ingredientPlanMarkup} from '../src/ai-workflow.js';
import {forecastEvidenceMarkup,ruleEvidenceMarkup,algorithmGuideMarkup} from '../src/ai-explanations.js';
test('forecast summary separates learned predictions from historical fallback',()=>{
 assert.deepEqual(forecastSummary([{modelType:'LSTM',predictedQuantity:12},{modelType:'BASELINE_MA',predictedQuantity:8.5}]),{dishes:2,portions:20.5,learned:1,historical:1});
});
test('purchase calculation shows saved quantities and escapes ingredient names',()=>{
 const plan=ingredientPlanMarkup([{ingredient:{name:'<script>bad</script>',unit:'kg'},grossDemand:12,currentStock:11,safetyStock:2,suggestedOrderQty:3,approvedByUser:false}]);
 assert.match(plan,/1 nguyên liệu cần bổ sung/);assert.match(plan,/Chờ xem xét/);assert.doesNotMatch(plan,/<script>/);
 assert.match(plan,/12 nhu cầu \+ 2 tồn an toàn − 11 tồn khả dụng/);
});
test('forecast identifies actual fallback formula and does not present hour totals as predictions',()=>{
 const result=forecastEvidenceMarkup({modelType:'BASELINE_MA',predictedQuantity:30,explanation:{fallbackReason:'Chưa có mô hình',source:{totalQuantity:60,observedDays:2,orderCount:3,realOrders:2,syntheticOrders:1,from:'2026-10-01',to:'2026-10-30',daily:[{date:'2026-10-02',quantity:60}],historicalHours:[{hour:11,quantity:60}]}}});
 assert.match(result,/60 suất ÷ 2 ngày có bán/);assert.match(result,/không phải dự báo theo giờ/);assert.match(result,/2 thật, 1 mô phỏng/);
 assert.match(forecastEvidenceMarkup({}),/Chạy lại dự báo/);
 assert.doesNotMatch(algorithmGuideMarkup(),/Autoencoder/);
});
test('basket explanation shows denominators rather than unsupported causal claims',()=>{
 const result=ruleEvidenceMarkup({support:.2,confidence:.5,lift:2,evidence:{total:100,together:20,antecedent:40,consequent:25}});
 assert.match(result,/20 ÷ 100 = 20%/);assert.match(result,/20 ÷ 40 = 50%/);assert.match(result,/25 ÷ 100/);
});
