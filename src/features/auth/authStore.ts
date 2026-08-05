export const AUTH_SESSION_KEY = 'investment-dashboard.authenticated'

export function hasAuthenticatedSession(): boolean {
  return sessionStorage.getItem(AUTH_SESSION_KEY) === 'true'
}

export function createAuthenticatedSession(): void {
  sessionStorage.setItem(AUTH_SESSION_KEY, 'true')
}

export function clearAuthenticatedSession(): void {
  sessionStorage.removeItem(AUTH_SESSION_KEY)
}
