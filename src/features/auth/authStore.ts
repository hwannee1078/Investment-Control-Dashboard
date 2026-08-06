export const AUTH_SESSION_KEY = 'investment-dashboard.authenticated'
export const AUTH_ROLE_KEY = 'investment-dashboard.role'
export type UserRole = 'viewer' | 'staff' | 'admin'

export function hasAuthenticatedSession(): boolean {
  return sessionStorage.getItem(AUTH_SESSION_KEY) === 'true'
}

export function getSessionRole(): UserRole {
  const role = sessionStorage.getItem(AUTH_ROLE_KEY)
  if (role === 'staff' || role === 'admin') return role
  // Existing prototype sessions predate role storage; keep them usable as staff.
  return hasAuthenticatedSession() ? 'staff' : 'viewer'
}

export function createAuthenticatedSession(role: UserRole = 'viewer'): void {
  sessionStorage.setItem(AUTH_SESSION_KEY, 'true')
  sessionStorage.setItem(AUTH_ROLE_KEY, role)
}

export function clearAuthenticatedSession(): void {
  sessionStorage.removeItem(AUTH_SESSION_KEY)
  sessionStorage.removeItem(AUTH_ROLE_KEY)
}

export function canManage(role: UserRole = getSessionRole()): boolean {
  return role === 'staff' || role === 'admin'
}

export function canAdminEdit(role: UserRole = getSessionRole()): boolean {
  return role === 'admin'
}
