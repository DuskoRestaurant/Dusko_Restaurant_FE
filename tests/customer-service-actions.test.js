import test from 'node:test';
import assert from 'node:assert/strict';
import {customerServiceActions} from '../customer-web/src/customer-service-actions.js';

test('pending assistance disables only its action and retains short labels',()=>{
  const html=customerServiceActions({sessionOpen:true,requests:[{kind:'ASSISTANCE'}]});
  const buttons=html.match(/<button[\s\S]*?<\/button>/g);
  assert.equal(buttons.length,2);
  assert.match(buttons[0],/disabled/);
  assert.doesNotMatch(buttons[1],/disabled/);
  assert.match(buttons[0],/<span>Gọi nhân viên<\/span>/);
  assert.match(buttons[1],/<span>Thanh toán<\/span>/);
  assert.ok(buttons.every(button=>!button.includes('đã gửi')));
  assert.match(html,/Đã gửi yêu cầu, đang chờ nhân viên/);
});
test('sending locks repeat actions, indicates the busy action and hides tools for closed sessions',()=>{
  const html=customerServiceActions({sessionOpen:true,busyKind:'BILL'});
  const buttons=html.match(/<button[\s\S]*?<\/button>/g);
  assert.ok(buttons.every(button=>button.includes('disabled')));
  assert.doesNotMatch(buttons[0],/aria-busy/);
  assert.match(buttons[1],/aria-busy="true"/);
  assert.equal(customerServiceActions({sessionOpen:false}),'');
});
