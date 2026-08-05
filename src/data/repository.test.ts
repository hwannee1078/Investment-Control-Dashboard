import { beforeEach, describe, expect, it } from 'vitest'

import type { InvestmentTransaction } from '../domain/investment'
import { SAMPLE_PROJECTS } from '../domain/sampleData'
import { InvestmentRepository } from './investmentRepository'
import { ProjectRepository } from './projectRepository'

describe('ProjectRepository', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('preserves a saved project edit through localStorage', () => {
    const repository = new ProjectRepository(localStorage)
    const project = repository.list()[0]
    const editedProject = {
      ...project,
      name: '포항 양극재 1단계 증설',
      approvalBudget: 850_000_000_000,
    }

    repository.save(editedProject)

    const reloadedRepository = new ProjectRepository(localStorage)
    expect(reloadedRepository.get(project.id)).toEqual(editedProject)
  })

  it('seeds samples only when the projects key is absent', () => {
    expect(new ProjectRepository(localStorage).list()).toEqual(SAMPLE_PROJECTS)

    localStorage.setItem('investment-dashboard.projects.v1', '[]')

    expect(new ProjectRepository(localStorage).list()).toEqual([])
  })
})

describe('InvestmentRepository', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('replaces and reloads transactions from localStorage', () => {
    const rows: InvestmentTransaction[] = [
      {
        sourceId: 'erp-2026-08',
        rowId: '17',
        orderId: 'PO-2026-0017',
        month: '2026-08',
        amount: 125_000_000,
      },
    ]
    const repository = new InvestmentRepository(localStorage)

    repository.replaceTransactions(rows)

    expect(new InvestmentRepository(localStorage).listTransactions()).toEqual(rows)
  })

  it('replaces order mappings under the versioned storage key', () => {
    const repository = new InvestmentRepository(localStorage)

    repository.replaceOrderMappings({ 'PO-2026-0017': 'project-pohang-cathode-1' })

    expect(localStorage.getItem('investment-dashboard.order-mappings.v1')).toBe(
      '{"PO-2026-0017":"project-pohang-cathode-1"}',
    )
  })
})
