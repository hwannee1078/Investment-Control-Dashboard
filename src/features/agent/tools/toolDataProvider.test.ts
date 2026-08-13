import { describe, expect, it, vi } from 'vitest'

import { createEmptySchedule, PROJECT_STAGES, type Project } from '../../../domain/project'
import { createSupabaseAgentToolDataProvider } from './supabaseToolDataProvider'

const context = {
  userId: 'user-1',
  employeeId: 'E-100',
  role: 'viewer' as const,
  now: '2026-08-13T00:00:00.000Z',
}

const project: Project = {
  id: 'project-1',
  name: 'Project 1',
  location: 'Pohang',
  material: '양극재',
  status: PROJECT_STAGES[0],
  schedule: createEmptySchedule(),
  approvalBudget: 1_000,
  orderIds: ['ORDER-1'],
}

describe('Supabase Agent tool data provider', () => {
  it('queries the authenticated dashboard tables and maps their rows into tool data', async () => {
    const select = vi.fn((table: string, columns: string) => {
      if (table === 'projects') return Promise.resolve({ data: [{ id: project.id, data: project }], error: null })
      if (table === 'investment_transactions') {
        return Promise.resolve({
          data: [{
            source_id: 'report.xlsx',
            row_id: 'report.xlsx:14',
            data: { sourceId: 'report.xlsx', rowId: 'report.xlsx:14', orderId: 'ORDER-1', month: '2026-07', amount: 300 },
          }],
          error: null,
        })
      }
      if (table === 'order_mappings') {
        return Promise.resolve({ data: [{ order_id: 'ORDER-1', project_id: project.id }], error: null })
      }
      throw new Error(`unexpected query ${table}.${columns}`)
    })
    const client = {
      from: (table: string) => ({ select: (columns: string) => select(table, columns) }),
    }

    const data = await createSupabaseAgentToolDataProvider(client).load(context)

    expect(select.mock.calls).toEqual([
      ['projects', 'id,data'],
      ['investment_transactions', 'source_id,row_id,data'],
      ['order_mappings', 'order_id,project_id'],
    ])
    expect(data.projects).toEqual([project])
    expect(data.transactions).toEqual([
      expect.objectContaining({ sourceId: 'report.xlsx', rowId: 'report.xlsx:14', amount: 300 }),
    ])
    expect(data.orderToProject).toEqual({ 'ORDER-1': 'project-1' })
  })

  it('fails closed when an authenticated table query is unavailable', async () => {
    const client = {
      from: (table: string) => ({
        select: async () => table === 'projects'
          ? { data: null, error: { message: 'RLS denied' } }
          : { data: [], error: null },
      }),
    }

    await expect(createSupabaseAgentToolDataProvider(client).load(context))
      .rejects.toMatchObject({ code: 'DATA_SOURCE_UNAVAILABLE' })
  })
})
