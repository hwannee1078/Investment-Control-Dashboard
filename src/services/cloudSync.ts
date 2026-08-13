import type { UserRole } from '../features/auth/authStore'
import { ORDER_MAPPINGS_STORAGE_KEY, TRANSACTIONS_STORAGE_KEY } from '../data/investmentRepository'
import { PROJECTS_STORAGE_KEY } from '../data/projectRepository'
import { PROJECT_FINALIZED_KEY } from '../features/auth/workflowStore'
import { supabase } from './supabaseClient'

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

/** Persists audit data only after an approved Agent action, then asks cloud sync to upload it. */
export async function recordApprovedAgentAuditLog(
  audit: AgentAuditLog,
  storage: Storage = localStorage,
): Promise<void> {
  if (!audit.approved) throw new Error('Only approved Agent actions can be audited')
  const audits = parseJson<AgentAuditLog[]>(storage.getItem(AGENT_AUDIT_LOGS_STORAGE_KEY), [])
  storage.setItem(AGENT_AUDIT_LOGS_STORAGE_KEY, JSON.stringify([...audits, audit]))
  await syncLocalDataToCloud(storage)
}

export async function syncLocalDataToCloud(storage: Storage = localStorage): Promise<void> {
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
  const agentAuditLogs = parseJson<AgentAuditLog[]>(storage.getItem(AGENT_AUDIT_LOGS_STORAGE_KEY), [])

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
  if (agentAuditLogs.length) {
    const { error } = await supabase.from('agent_audit_logs').upsert(agentAuditLogs, { onConflict: 'id' })
    if (error) throw error
  }
}

export async function hydrateLocalDataFromCloud(storage: Storage = localStorage): Promise<'disabled' | 'not-authenticated' | 'seeded' | 'hydrated'> {
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
