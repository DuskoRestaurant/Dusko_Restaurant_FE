import {hasRole} from '../../src/permissions.js';
export const shellLabels={service:'Phục vụ bàn',cashier:'Thu ngân',kitchen:'Nhà bếp'};
export function staffShellsFor(user) {
  return [
    ['service',['WAITER','MANAGER','ADMIN']],
    ['cashier',['CASHIER','MANAGER','ADMIN']],
    ['kitchen',['CHEF','MANAGER','ADMIN']],
  ].filter(([,roles])=>hasRole(user,roles)).map(([shell])=>shell);
}
