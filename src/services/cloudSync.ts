import type { UserRole } from '../features/auth/authStore'
import { ORDER_MAPPINGS_STORAGE_KEY, TRANSACTIONS_STORAGE_KEY } from '../data/investmentRepository'
import { PROJECTS_STORAGE_KEY } from '../data/projectRepository'
import { IMPORT_BATCHES_STORAGE_KEY } from '../data/importBatchRepository'
import { PROJECT_FINALIZED_KEY } from '../features/auth/workflowStore'
import { supabase } from './supabaseClient'
import { isOfflineMode, offlineApiBaseUrl, offlineAuthHeaders } from './runtimeConfig'

export const AGENT_AUDIT_LOGS_STORAGE_KEY = 'investment-dashboard.agent-audit-logs.v1'

export type AgentAuditLog = {
  id: string
  user_id: string
  employee_id: string
  role: UserRole
  question: string
  tool_name: string
  target_project_id: string
  before_data: unknown
  after_data: unknown
  approved: true
  result_code: string
  created_at: string
}

type CloudProjectRow = { id: string; data: unknown }
type CloudTransactionRow = { source_id: string; row_id: string; data: unknown }
type CloudMappingRow = { order_id: string; project_id: string }
type CloudFinalizationRow = { project_id: string; finalized: boolean }

function parseJson<T>(value: string | null, fallback: T): T {
  try { return value === null ? fallback : JSON.parse(value) as T } catch { return fallback }
}

export async function getCloudUserRole(userId: string): Promise<UserRole> {
  if (!supabase) return 'viewer'
  const { data } = await supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle()
  return data?.role === 'admin' || data?.role === 'staff' ? data.role : 'viewer'
}

export async function ensureCloudUserRole(userId: string, employeeId: string): Promise<void> {
  if (!supabase) return
  await supabase.from('user_roles').upsert(
    { user_id: userId, employee_id: employeeId, role: 'viewer' },
    { onConflict: 'user_id', ignoreDuplicates: true },
  )
}

/**
 * Client-side Agent audit writes are intentionally disabled. Agent mutations may only be
 * enabled with a server-owned transaction that derives identity and writes its audit row.
 */
export async function recordApprovedAgentAuditLog(
  _audit: AgentAuditLog,
  _storage: Storage = localStorage,
): Promise<never> {
  throw new Error('AGENT_WRITES_DISABLED')
}

export async function syncLocalDataToCloud(storage: Storage = localStorage): Promise<void> {
  if (isOfflineMode) {
    const projects = parseJson<unknown[]>(storage.getItem(PROJECTS_STORAGE_KEY), [])
    const transactions = parseJson<unknown[]>(storage.getItem(TRANSACTIONS_STORAGE_KEY), [])
    const mappings = parseJson<Record<string, string>>(storage.getItem(ORDER_MAPPINGS_STORAGE_KEY), {})
    const finalizations = parseJson<Record<string, boolean>>(storage.getItem(PROJECT_FINALIZED_KEY), {})
    const importBatches = parseJson<unknown[]>(storage.getItem(IMPORT_BATCHES_STORAGE_KEY), [])
    const response = await fetch(`${offlineApiBaseUrl}/sync`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...offlineAuthHeaders() },
      body: JSON.stringify({ projects, transactions, mappings, finalizations, importBatches }),
    })
    if (!response.ok) throw new Error('오프라인 데이터 저장에 실패했습니다.')
    return
  }
  if (!supabase) return
  const { data: sessionData } = await supabase.auth.getSession()
  if (!sessionData.session) return

  const projects = parseJson<unknown[]>(storage.getItem(PROJECTS_STORAGE_KEY), [])
  const transactions = parseJson<Array<{ sourceId: string; rowId: string; [key: string]: unknown }>>(
    storage.getItem(TRANSACTIONS_STORAGE_KEY),
    [],
  )
  const mappings = parseJson<Record<string, string>>(storage.getItem(ORDER_MAPPINGS_STORAGE_KEY), {})
  const finalizations = parseJson<Record<string, boolean>>(storage.getItem(PROJECT_FINALIZED_KEY), {})

  if (projects.length) {
    const { error } = await supabase.from('projects').upsert(projects.map((data) => ({ id: (data as { id: string }).id, data })))
    if (error) throw error
  }
  if (transactions.length) {
    const { error } = await supabase.from('investment_transactions').upsert(
      transactions.map((data) => ({ source_id: data.sourceId, row_id: data.rowId, data })),
      { onConflict: 'source_id,row_id' },
    )
    if (error) throw error
  }
  const mappingRows = Object.entries(mappings).map(([order_id, project_id]) => ({ order_id, project_id }))
  if (mappingRows.length) {
    const { error } = await supabase.from('order_mappings').upsert(mappingRows, { onConflict: 'order_id' })
    if (error) throw error
  }
  const finalizationRows = Object.entries(finalizations).filter(([, finalized]) => finalized).map(([project_id, finalized]) => ({ project_id, finalized }))
  if (finalizationRows.length) {
    const { error } = await supabase.from('project_finalizations').upsert(finalizationRows, { onConflict: 'project_id' })
    if (error) throw error
  }
}

export async function hydrateLocalDataFromCloud(storage: Storage = localStorage): Promise<'disabled' | 'not-authenticated' | 'seeded' | 'hydrated'> {
  if (isOfflineMode) {
    const response = await fetch(`${offlineApiBaseUrl}/bootstrap`, { headers: offlineAuthHeaders() })
    if (response.status === 401) return 'not-authenticated'
    if (!response.ok) throw new Error('오프라인 데이터를 불러오지 못했습니다.')
    const payload = await response.json() as {
      projects: unknown[]
      transactions: unknown[]
      mappings: Record<string, string>
      finalizations: Record<string, boolean>
      importBatches: unknown[]
    }
    storage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(payload.projects))
    storage.setItem(TRANSACTIONS_STORAGE_KEY, JSON.stringify(payload.transactions))
    storage.setItem(ORDER_MAPPINGS_STORAGE_KEY, JSON.stringify(payload.mappings))
    storage.setItem(PROJECT_FINALIZED_KEY, JSON.stringify(payload.finalizations))
    storage.setItem(IMPORT_BATCHES_STORAGE_KEY, JSON.stringify(payload.importBatches ?? []))
    return 'hydrated'
  }
  if (!supabase) return 'disabled'
  const { data: sessionData } = await supabase.auth.getSession()
  if (!sessionData.session) return 'not-authenticated'

  const [projectsResult, transactionsResult, mappingsResult, finalizationsResult] = await Promise.all([
    supabase.from('projects').select('id,data'),
    supabase.from('investment_transactions').select('source_id,row_id,data'),
    supabase.from('order_mappings').select('order_id,project_id'),
    supabase.from('project_finalizations').select('project_id,finalized'),
  ])
  const error = projectsResult.error ?? transactionsResult.error ?? mappingsResult.error ?? finalizationsResult.error
  if (error) throw error

  const projects = (projectsResult.data ?? []) as CloudProjectRow[]
  const transactions = (transactionsResult.data ?? []) as CloudTransactionRow[]
  const mappings = (mappingsResult.data ?? []) as CloudMappingRow[]
  const finalizations = (finalizationsResult.data ?? []) as CloudFinalizationRow[]
  const hasCloudData = projects.length > 0 || transactions.length > 0 || mappings.length > 0 || finalizations.length > 0

  if (!hasCloudData) {
    await syncLocalDataToCloud(storage)
    return 'seeded'
  }

  storage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects.map(({ data }) => data)))
  storage.setItem(TRANSACTIONS_STORAGE_KEY, JSON.stringify(transactions.map(({ data }) => data)))
  storage.setItem(ORDER_MAPPINGS_STORAGE_KEY, JSON.stringify(Object.fromEntries(mappings.map(({ order_id, project_id }) => [order_id, project_id]))))
  storage.setItem(PROJECT_FINALIZED_KEY, JSON.stringify(Object.fromEntries(finalizations.filter(({ finalized }) => finalized).map(({ project_id }) => [project_id, true]))))
  return 'hydrated'
}
