import type { InvestmentTransaction } from '../../../domain/investment'
import { type ProjectStage } from '../../../domain/project'
import type { AgentDraft } from '../agentTypes'
import type { AgentToolContext } from '../agentToolTypes'
import { reconcileInvestmentWorkbook } from '../tools/investmentTools'
import { getAgentToolData } from '../tools/toolContext'

const cancelledDraftIds = new Set<string>()

export class AgentDraftError extends Error {
  constructor(readonly code: 'FORBIDDEN' | 'VALIDATION_FAILED' | 'DRAFT_CANCELLED' | 'INVALID_DRAFT' | 'UNSUPPORTED_ACTION') {
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

function assertPendingAndAllowed(context: AgentToolContext, draft: AgentDraft): void {
  if (context.role === 'viewer') throw new AgentDraftError('FORBIDDEN')
  if (draft.status !== 'pending' || cancelledDraftIds.has(draft.id)) {
    throw new AgentDraftError('DRAFT_CANCELLED')
  }
  if (!draft.validations.every((item) => item.passed)) {
    throw new AgentDraftError('VALIDATION_FAILED')
  }
}

function assertCanPrepareDraft(context: AgentToolContext): void {
  if (context.role === 'viewer') throw new AgentDraftError('FORBIDDEN')
}

export async function prepareInvestmentImport(
  context: AgentToolContext,
  input: { sourceName: string; transactions: InvestmentTransaction[]; projectId: string },
): Promise<AgentDraft> {
  assertCanPrepareDraft(context)
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
  context: AgentToolContext,
  input: { projectId: string; stage: ProjectStage; actual: string; reason?: string | null },
): Promise<AgentDraft> {
  assertCanPrepareDraft(context)
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

export async function approveAgentDraft(
  context: AgentToolContext,
  draft: AgentDraft,
): Promise<{ auditId: string; saved: true }> {
  assertPendingAndAllowed(context, draft)
  throw new AgentDraftError('UNSUPPORTED_ACTION')
}

export function cancelAgentDraft(draftId: string): void {
  cancelledDraftIds.add(draftId)
}
