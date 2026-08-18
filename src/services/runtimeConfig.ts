export const isOfflineMode = import.meta.env.VITE_DATA_BACKEND === 'offline'
export const offlineApiBaseUrl = (import.meta.env.VITE_OFFLINE_API_URL as string | undefined) ?? '/api/offline'

export function offlineAuthHeaders(): Record<string, string> {
  const token = sessionStorage.getItem('investment-dashboard.offline-token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}
