import { beforeEach, describe, expect, it } from 'vitest'

import { createEmptySchedule, type Project } from '../../../domain/project'
import { findMissingData } from './scheduleTools'

const viewer = {
  userId: 'viewer-1',
  employeeId: 'E-001',
  role: 'viewer' as const,
  now: '2026-08-13T00:00:00.000Z',
}

const project = (schedule = createEmptySchedule()): Project => ({
  id: 'project-1',
  name: '양극재 증설',
  location: '포항',
  material: '양극재',
  status: '사업승인',
  schedule,
  approvalBudget: 1_000,
  orderIds: ['ORDER-1'],
})

describe('schedule agent tools', () => {
  beforeEach(() => localStorage.clear())

  it('reports missing schedule and order mapping without mutation for a viewer', async () => {
    localStorage.setItem('investment-dashboard.projects.v1', JSON.stringify([project()]))
    localStorage.setItem('investment-dashboard.transactions.v1', JSON.stringify([
      { sourceId: 'report.xlsx', rowId: 'report.xlsx:14', orderId: 'UNMAPPED-ORDER', month: '2026-07', amount: 100 },
    ]))
    localStorage.setItem('investment-dashboard.order-mappings.v1', JSON.stringify({}))
    const before = JSON.stringify({ ...localStorage })

    const answer = await findMissingData(viewer)

    expect(answer.answer).toContain('MISSING_SCHEDULE')
    expect(answer.answer).toContain('MISSING_MAPPING')
    expect(JSON.stringify({ ...localStorage })).toBe(before)
  })

  it('returns NO_EVIDENCE when the requested project has no data', async () => {
    localStorage.setItem('investment-dashboard.projects.v1', JSON.stringify([]))
    localStorage.setItem('investment-dashboard.transactions.v1', JSON.stringify([]))
    localStorage.setItem('investment-dashboard.order-mappings.v1', JSON.stringify({}))

    const answer = await findMissingData(viewer, { projectId: 'not-found' })

    expect(answer.answer).toContain('NO_EVIDENCE')
  })
})
