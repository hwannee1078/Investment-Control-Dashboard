import { describe, expect, it } from 'vitest'

import type { InvestmentTransaction } from '../domain/investment'
import { createEmptySchedule, type Project } from '../domain/project'
import {
  aggregateInvestment,
  findUnmappedOrderErrors,
} from './investmentAggregation'

const project = (approvalBudget: number | null = 1_000): Project => ({
  id: 'project-1',
  name: '양극재 증설',
  location: '포항',
  material: '양극재',
  status: '사업승인',
  schedule: createEmptySchedule(),
  approvalBudget,
  orderIds: ['ORDER-1', 'ORDER-2', 'ORDER-3'],
})

const row = (
  rowId: string,
  orderId: string,
  month: string,
  amount: number,
  sourceId = 'source-a',
): InvestmentTransaction => ({ sourceId, rowId, orderId, month, amount })

describe('aggregateInvestment', () => {
  it('한 사업에 매핑된 세 투자오더의 같은 달 금액을 합산한다', () => {
    const result = aggregateInvestment(
      [
        row('2', 'ORDER-1', '2026-03', 100),
        row('3', 'ORDER-2', '2026-03', 200),
        row('4', 'ORDER-3', '2026-03', 300),
      ],
      {
        'ORDER-1': 'project-1',
        'ORDER-2': 'project-1',
        'ORDER-3': 'project-1',
      },
      [project()],
    )

    expect(result.get('project-1')?.monthly).toEqual({ '2026-03': 600 })
  })

  it('월을 시간순으로 정렬해 누계와 승인투자비 대비 집행률을 계산한다', () => {
    const result = aggregateInvestment(
      [
        row('2', 'ORDER-1', '2026-12', 250),
        row('3', 'ORDER-1', '2026-01', 100),
        row('4', 'ORDER-1', '2026-03', 150),
      ],
      { 'ORDER-1': 'project-1' },
      [project(2_000)],
    ).get('project-1')

    expect(result?.monthly).toEqual({
      '2026-01': 100,
      '2026-03': 150,
      '2026-12': 250,
    })
    expect(result?.cumulative).toEqual({
      '2026-01': 100,
      '2026-03': 250,
      '2026-12': 500,
    })
    expect(result?.cumulativeTotal).toBe(500)
    expect(result?.executionRate).toBe(25)
  })

  it.each([0, null])('승인투자비가 %s이면 집행률을 null로 반환한다', (budget) => {
    const result = aggregateInvestment(
      [row('2', 'ORDER-1', '2026-01', 100)],
      { 'ORDER-1': 'project-1' },
      [project(budget)],
    )

    expect(result.get('project-1')?.executionRate).toBeNull()
  })

  it('미매핑 오더와 존재하지 않는 사업에 매핑된 오더를 합계에서 제외하고 오류로 보고한다', () => {
    const rows = [
      row('2', 'ORDER-1', '2026-01', 100),
      row('3', 'UNMAPPED', '2026-01', 900),
      row('4', 'ORPHANED', '2026-01', 800),
    ]
    const mapping = {
      'ORDER-1': 'project-1',
      ORPHANED: 'missing-project',
    }

    const result = aggregateInvestment(rows, mapping, [project()])
    const errors = findUnmappedOrderErrors(rows, mapping, [project()])

    expect(result.get('project-1')?.cumulativeTotal).toBe(100)
    expect(result.has('missing-project')).toBe(false)
    expect(errors.map(({ rowId, code }) => ({ rowId, code }))).toEqual([
      { rowId: '3', code: 'UNMAPPED_ORDER' },
      { rowId: '4', code: 'UNMAPPED_ORDER' },
    ])
  })

  it('같은 원본과 행 식별자가 반복되면 한 번만 집계한다', () => {
    const duplicate = row('orders.xlsx:2', 'ORDER-1', '2026-01', 125, 'orders.xlsx')
    const result = aggregateInvestment(
      [duplicate, { ...duplicate }],
      { 'ORDER-1': 'project-1' },
      [project()],
    )

    expect(result.get('project-1')?.cumulativeTotal).toBe(125)
  })
})
