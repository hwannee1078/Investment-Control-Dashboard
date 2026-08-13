import { beforeEach, describe, expect, it } from 'vitest'

import type { InvestmentTransaction } from '../../../domain/investment'
import { createEmptySchedule, PROJECT_STAGES, type Project } from '../../../domain/project'
import {
  approveAgentDraft,
  cancelAgentDraft,
  prepareInvestmentImport,
  prepareScheduleUpdate,
} from './agentDraftService'

const staff = { userId: 'staff-user', employeeId: 'E-100', role: 'staff' as const, now: '2026-08-13T00:00:00.000Z' }
const viewer = { ...staff, role: 'viewer' as const }

const project = (): Project => ({
  id: 'project-1', name: 'Investment project', location: 'Pohang', material: '양극재',
  status: PROJECT_STAGES[0], schedule: createEmptySchedule(), approvalBudget: 1_000, orderIds: [],
})

const transaction = (row: number, amount: number): InvestmentTransaction => ({
  sourceId: 'report.xlsx', rowId: `report.xlsx:${row}`, orderId: 'ORDER-1', month: '2026-07', amount,
})

function seedProject(): void {
  localStorage.setItem('investment-dashboard.projects.v1', JSON.stringify([project()]))
  localStorage.setItem('investment-dashboard.transactions.v1', JSON.stringify([
    { sourceId: 'existing.xlsx', rowId: 'existing.xlsx:14', orderId: 'OLD-ORDER', month: '2026-06', amount: 10 },
  ]))
  localStorage.setItem('investment-dashboard.order-mappings.v1', JSON.stringify({ 'OLD-ORDER': 'project-1' }))
}

function auditRows(): Array<{ before_data: unknown; after_data: unknown; approved: boolean }> {
  return JSON.parse(localStorage.getItem('investment-dashboard.agent-audit-logs.v1') ?? '[]')
}

describe('agent draft service', () => {
  beforeEach(() => localStorage.clear())

  it('rejects viewer approval with FORBIDDEN without persisting changes', async () => {
    seedProject()
    const draft = await prepareScheduleUpdate(staff, { projectId: 'project-1', stage: PROJECT_STAGES[0], actual: '2026-08-01' })
    const before = localStorage.getItem('investment-dashboard.projects.v1')

    await expect(approveAgentDraft(viewer, draft)).rejects.toMatchObject({ code: 'FORBIDDEN' })

    expect(localStorage.getItem('investment-dashboard.projects.v1')).toBe(before)
    expect(auditRows()).toEqual([])
  })

  it('rejects viewer draft preparation without changing repositories', async () => {
    seedProject()
    const before = {
      projects: localStorage.getItem('investment-dashboard.projects.v1'),
      transactions: localStorage.getItem('investment-dashboard.transactions.v1'),
      mappings: localStorage.getItem('investment-dashboard.order-mappings.v1'),
    }

    await expect(prepareInvestmentImport(viewer, {
      sourceName: 'report.xlsx', projectId: 'project-1', transactions: [transaction(14, 500), transaction(15, 500)],
    })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(prepareScheduleUpdate(viewer, {
      projectId: 'project-1', stage: PROJECT_STAGES[0], actual: '2026-08-01',
    })).rejects.toMatchObject({ code: 'FORBIDDEN' })

    expect(localStorage.getItem('investment-dashboard.projects.v1')).toBe(before.projects)
    expect(localStorage.getItem('investment-dashboard.transactions.v1')).toBe(before.transactions)
    expect(localStorage.getItem('investment-dashboard.order-mappings.v1')).toBe(before.mappings)
  })

  it('allows staff to approve a reconciled investment import and records before and after data', async () => {
    seedProject()
    const draft = await prepareInvestmentImport(staff, {
      sourceName: 'report.xlsx', projectId: 'project-1', transactions: [transaction(14, 500), transaction(15, 200), transaction(16, 300)],
    })
    const before = localStorage.getItem('investment-dashboard.transactions.v1')

    const result = await approveAgentDraft(staff, draft)

    expect(result.saved).toBe(true)
    expect(result.auditId).not.toBe('')
    expect(localStorage.getItem('investment-dashboard.transactions.v1')).not.toBe(before)
    expect(auditRows()).toContainEqual(expect.objectContaining({
      approved: true,
      before_data: expect.anything(),
      after_data: expect.anything(),
    }))
  })

  it('blocks an investment import with failed C14 to C15:C108 reconciliation', async () => {
    seedProject()
    const draft = await prepareInvestmentImport(staff, {
      sourceName: 'report.xlsx', projectId: 'project-1', transactions: [transaction(14, 500), transaction(15, 300)],
    })
    const before = localStorage.getItem('investment-dashboard.transactions.v1')

    await expect(approveAgentDraft(staff, draft)).rejects.toMatchObject({ code: 'VALIDATION_FAILED' })

    expect(localStorage.getItem('investment-dashboard.transactions.v1')).toBe(before)
    expect(auditRows()).toEqual([])
  })

  it('cancels a pending schedule draft without changing a repository', async () => {
    seedProject()
    const draft = await prepareScheduleUpdate(staff, {
      projectId: 'project-1', stage: PROJECT_STAGES[0], actual: '2026-08-01', reason: 'Confirmed on site',
    })
    const before = localStorage.getItem('investment-dashboard.projects.v1')

    cancelAgentDraft(draft.id)

    expect(localStorage.getItem('investment-dashboard.projects.v1')).toBe(before)
    await expect(approveAgentDraft(staff, draft)).rejects.toMatchObject({ code: 'DRAFT_CANCELLED' })
  })

  it('saves a valid schedule draft through the project repository', async () => {
    seedProject()
    const draft = await prepareScheduleUpdate(staff, {
      projectId: 'project-1', stage: PROJECT_STAGES[0], actual: '2026-08-01', reason: 'Confirmed on site',
    })

    await approveAgentDraft(staff, draft)

    const saved = JSON.parse(localStorage.getItem('investment-dashboard.projects.v1') ?? '[]') as Project[]
    expect(saved[0].schedule[PROJECT_STAGES[0]]).toEqual({ plan: null, actual: '2026-08-01', actualReason: 'Confirmed on site' })
  })
})
