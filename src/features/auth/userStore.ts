import type { UserRole } from './authStore'

export const USER_DIRECTORY_KEY = 'investment-dashboard.user-directory.v1'
export type UserAccount = { employeeId: string; role: UserRole }
const DEFAULT_USERS: UserAccount[] = [{ employeeId: 'admin', role: 'admin' }]

export function listUsers(storage: Storage = localStorage): UserAccount[] {
  const raw = storage.getItem(USER_DIRECTORY_KEY)
  if (!raw) return DEFAULT_USERS
  try { const parsed = JSON.parse(raw) as unknown; return Array.isArray(parsed) ? parsed as UserAccount[] : DEFAULT_USERS } catch { return DEFAULT_USERS }
}
export function getUserRole(employeeId: string, storage: Storage = localStorage): UserRole { return listUsers(storage).find((user) => user.employeeId === employeeId)?.role ?? 'viewer' }
export function saveUserRole(employeeId: string, role: UserRole, storage: Storage = localStorage): void {
  const users = listUsers(storage).filter((user) => user.employeeId !== employeeId)
  storage.setItem(USER_DIRECTORY_KEY, JSON.stringify([...users, { employeeId, role }]))
}
