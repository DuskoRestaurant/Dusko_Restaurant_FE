export const effectiveRoles = user => [...new Set([user?.role,...(user?.roles || [])].filter(Boolean))];
export const hasRole = (user, roles) => effectiveRoles(user).some(role => roles.includes(role));
export const canTakePayment = user => hasRole(user,['ADMIN','MANAGER','CASHIER']);
export const canManage = user => hasRole(user,['ADMIN','MANAGER']);
export const canAdminister = user => hasRole(user,['ADMIN']);
