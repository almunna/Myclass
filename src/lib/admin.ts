// Admin configuration
export const ADMIN_EMAIL = 'admin@myclasslog.com';

// Check if user is admin based on email
export function isAdminUser(email: string | null | undefined): boolean {
  return email === ADMIN_EMAIL;
}

// Check if user has admin access (admin users bypass all restrictions)
export function hasAdminAccess(user: any): boolean {
  if (!user) return false;
  return isAdminUser(user.email);
}

// Admin user configuration for bypass
export const ADMIN_CONFIG = {
  email: ADMIN_EMAIL,
  password: 'AdminMyclassLog',
  bypassSubscription: true,
  role: 'admin'
}; 