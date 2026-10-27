// Management lock: ADMIN/MANAGER only. Mirrors the guard in src/main.js
// (canAccessManagement) so it can be unit-tested without DOM.
export function canAccessManagement(user) {
  if (!user) return false;
  if (['ADMIN', 'MANAGER'].includes(user.role)) return true;
  return (user.roles || []).some(r => ['ADMIN', 'MANAGER'].includes(r));
}
