import { InvestmentRepository } from '../../../data/investmentRepository'
import { ProjectRepository } from '../../../data/projectRepository'
import type { InvestmentTransaction } from '../../../domain/investment'
import { PROJECT_STAGES, type ProjectSchedule, type ProjectStage } from '../../../domain/project'
import {
  recordApprovedAgentAuditLog,
  type AgentAuditLog,
} from '../../../services/cloudSync'
import type { AgentDraft } from '../agentTypes'
import type { AgentToolContext } from '../agentToolTypes'
import { reconcileInvestmentWorkbook } from '../tools/investmentTools'
import { getAgentToolData } from '../tools/toolContext'

const cancelledDraftIds = new Set<string>()

export class AgentDraftError extends Error {
  constructor(readonly code: 'FORBIDDEN' | 'VALIDATION_FAILED' | 'DRAFT_CANCELLED' | 'INVALID_DRAFT') {
    super(code)
    this.name = 'AgentDraftError'
  }
}

function newDraftId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `agent-draft-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function validation(code: string, passed: boolean, message: string) {
  return { code, passed, message }
}

function distinctTransactions(rows: InvestmentTransaction[]): InvestmentTransaction[] {
  const distinct = new Map<string, InvestmentTransaction>()
  for (const row of rows) {
    const key = `${row.sourceId}\u0000${row.rowId}`
    if (!distinct.has(key)) distinct.set(key, row)
  }
  return [...distinct.values()]
}

function isProjectStage(value: string): value is ProjectStage {
  return (PROJECT_STAGES as readonly string[]).includes(value)
}

function isTransaction(value: unknown): value is InvestmentTransaction {
  if (typeof value !== 'object' || value === null) return false
  const row = value as Record<string, unknown>
  return typeof row.sourceId === 'string'
    && typeof row.rowId === 'string'
    && typeof row.orderId === 'string'
    && typeof row.month === 'string'
    && typeof row.amount === 'number'
}

function isOrderMappings(value: unknown): value is Record<string, string> {
  return typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
    && Object.values(value).every((projectId) => typeof projectId === 'string')
}

function changeAfter(draft: AgentDraft, field: string): unknown {
  return draft.changes.find((change) => change.field === field)?.after
}

function assertPendingAndAllowed(context: AgentToolContext, draft: AgentDraft): void {
  if (context.role === 'viewer') throw new AgentDraftError('FORBIDDEN')
  if (draft.status !== 'pending' || cancelledDraftIds.has(draft.id)) {
    throw new AgentDraftError('DRAFT_CANCELLED')
  }
  if (!draft.validations.every((item) => item.passed)) {
    throw new AgentDraftError('VALIDATION_FAILED')
  }
}

export async function prepareInvestmentImport(
  context: AgentToolContext,
  input: { sourceName: string; transactions: InvestmentTransaction[]; projectId: string },
): Promise<AgentDraft> {
  const data = getAgentToolData()
  const project = data.projects.find(({ id }) => id === input.projectId)
  const reconciliation = await reconcileInvestmentWorkbook(context, {
    sourceName: input.sourceName,
    transactions: input.transactions,
  })
  const newOrderIds = [...new Set(input.transactions.map(({ orderId }) => orderId))]
  const nextTransactions = distinctTransactions([...data.transactions, ...input.transactions])
  const nextMappings = Object.fromEntries([
    ...Object.entries(data.orderToProject),
    ...newOrderIds.map((orderId) => [orderId, input.projectId]),
  ])
  const nextOrderIds = project === undefined
    ? newOrderIds
    : [...new Set([...project.orderIds, ...newOrderIds])]

  return {
    id: newDraftId(),
    kind: 'investment-import',
    projectId: input.projectId,
    summary: `${input.sourceName} investment import`,
    changes: [
      { field: 'transactions', before: data.transactions, after: nextTransactions },
      { field: 'orderMappings', before: data.orderToProject, after: nextMappings },
      { field: 'project.orderIds', before: project?.orderIds ?? [], after: nextOrderIds },
    ],
    validations: [
      validation('PROJECT_FOUND', project !== undefined, 'Target project must exist.'),
      validation(
        'RECONCILIATION',
        reconciliation.errors.length === 0,
        reconciliation.errors.length === 0 ? 'C14 matches C15:C108.' : reconciliation.errors.map(({ code }) => code).join(', '),
      ),
    ],
    status: 'pending',
  }
}

export async function prepareScheduleUpdate(
  _context: AgentToolContext,
  input: { projectId: string; stage: ProjectStage; actual: string; reason?: string | null },
): Promise<AgentDraft> {
  const project = getAgentToolData().projects.find(({ id }) => id === input.projectId)
  const before = project?.schedule[input.stage]
  const actualIsValid = /^\d{4}-\d{2}-\d{2}$/.test(input.actual)
  const after = {
    plan: before?.plan ?? null,
    actual: actualIsValid ? input.actual : null,
    actualReason: input.reason ?? null,
  }

  return {
    id: newDraftId(),
    kind: 'schedule-update',
    projectId: input.projectId,
    summary: `Schedule actual update for ${input.stage}`,
    changes: [{ field: `schedule.${input.stage}`, before: before ?? null, after }],
    validations: [
      validation('PROJECT_FOUND', project !== undefined, 'Target project must exist.'),
      validation('VALID_ACTUAL_DATE', actualIsValid, 'Actual date must be YYYY-MM-DD.'),
    ],
    status: 'pending',
  }
}

function applyInvestmentDraft(draft: AgentDraft): void {
  const transactions = changeAfter(draft, 'transactions')
  const mappings = changeAfter(draft, 'orderMappings')
  const orderIds = changeAfter(draft, 'project.orderIds')
  const project = new ProjectRepository().get(draft.projectId)
  if (!Array.isArray(transactions) || !transactions.every(isTransaction) || !isOrderMappings(mappings) || !Array.isArray(orderIds) || !orderIds.every((id) => typeof id === 'string') || project === undefined) {
    throw new AgentDraftError('INVALID_DRAFT')
  }

  const investments = new InvestmentRepository()
  investments.replaceTransactions(transactions)
  investments.replaceOrderMappings(mappings)
  new ProjectRepository().save({ ...project, orderIds })
}

function applyScheduleDraft(draft: AgentDraft): void {
  const scheduleChange = draft.changes.find(({ field }) => field.startsWith('schedule.'))
  const stage = scheduleChange?.field.slice('schedule.'.length)
  const project = new ProjectRepository().get(draft.projectId)
  const after = scheduleChange?.after
  if (
    scheduleChange === undefined
    || stage === undefined
    || !isProjectStage(stage)
    || project === undefined
    || typeof after !== 'object'
    || after === null
    || Array.isArray(after)
  ) throw new AgentDraftError('INVALID_DRAFT')

  const item = after as Record<string, unknown>
  if (
    (item.plan !== null && typeof item.plan !== 'string')
    || typeof item.actual !== 'string'
    || (item.actualReason !== null && typeof item.actualReason !== 'string' && item.actualReason !== undefined)
  ) throw new AgentDraftError('INVALID_DRAFT')

  const schedule: ProjectSchedule = {
    ...project.schedule,
    [stage]: {
      plan: item.plan as string | null,
      actual: item.actual,
      actualReason: (item.actualReason ?? null) as string | null,
    },
  }
  new ProjectRepository().save({ ...project, schedule })
}

export async function approveAgentDraft(
  context: AgentToolContext,
  draft: AgentDraft,
): Promise<{ auditId: string; saved: true }> {
  assertPendingAndAllowed(context, draft)
  const auditId = newDraftId()
  const audit: AgentAuditLog = {
    id: auditId,
    user_id: context.userId,
    employee_id: context.employeeId,
    role: context.role,
    question: draft.summary,
    tool_name: draft.kind,
    target_project_id: draft.projectId,
    before_data: Object.fromEntries(draft.changes.map(({ field, before }) => [field, before])),
    after_data: Object.fromEntries(draft.changes.map(({ field, after }) => [field, after])),
    approved: true,
    result_code: 'APPROVED',
    created_at: context.now,
  }

  if (draft.kind === 'investment-import') applyInvestmentDraft(draft)
  else applyScheduleDraft(draft)

  await recordApprovedAgentAuditLog(audit)
  return { auditId, saved: true }
}

export function cancelAgentDraft(draftId: string): void {
  cancelledDraftIds.add(draftId)
}
