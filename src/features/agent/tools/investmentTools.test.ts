import * as XLSX from 'xlsx'
import { beforeEach, describe, expect, it } from 'vitest'

import type { InvestmentTransaction } from '../../../domain/investment'
import { createEmptySchedule, type Project } from '../../../domain/project'
import { parseWorkbookFiles } from '../../../services/investmentImport'
import {
  explainVariance,
  findInvestmentAnomalies,
  getExecutiveBriefing,
  reconcileInvestmentWorkbook,
} from './investmentTools'

const viewer = { userId: 'viewer-1', employeeId: 'E-001', role: 'viewer' as const, now: '2026-08-13T00:00:00.000Z' }

const project = (overrides: Partial<Project> = {}): Project => ({
  id: 'project-1', name: '양극재 증설', location: '포항', material: '양극재', status: '사업승인',
  schedule: createEmptySchedule(), approvalBudget: 1_000, orderIds: ['ORDER-1', 'ORDER-2'], ...overrides,
})

const transaction = (rowId: string, orderId: string, month: string, amount: number, sourceId = 'report.xlsx'): InvestmentTransaction => ({ sourceId, rowId, orderId, month, amount })

function seed({ projects, transactions, mappings }: { projects: Project[]; transactions: InvestmentTransaction[]; mappings: Record<string, string> }) {
  localStorage.setItem('investment-dashboard.projects.v1', JSON.stringify(projects))
  localStorage.setItem('investment-dashboard.transactions.v1', JSON.stringify(transactions))
  localStorage.setItem('investment-dashboard.order-mappings.v1', JSON.stringify(mappings))
}

function actualReportFile(name: string, monthlyActual: number, validationAmounts: number[]): File {
  const rows: unknown[][] = Array.from({ length: 110 }, () => [])
  rows[3] = [null, '오더 1006249 투자비 보고서']
  rows[4] = [null, '보고기간 2026-03']
  rows[13] = [null, '무시', monthlyActual]
  validationAmounts.forEach((amount, index) => { rows[14 + index][2] = amount })
  rows[108][1] = '* H,S'
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), '투자비')
  const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  return { name, arrayBuffer: async () => bytes } as File
}

describe('investment agent tools', () => {
  beforeEach(() => localStorage.clear())

  it('detects a month-over-month spike for a viewer without writing data', async () => {
    seed({ projects: [project()], transactions: [transaction('a.xlsx:14', 'ORDER-1', '2026-06', 100), transaction('b.xlsx:14', 'ORDER-2', '2026-07', 300)], mappings: { 'ORDER-1': 'project-1', 'ORDER-2': 'project-1' } })
    const before = JSON.stringify({ ...localStorage })
    const answer = await findInvestmentAnomalies(viewer)
    expect(answer.answer).toContain('MONTHLY_SPIKE')
    expect(answer.answer).toContain('양극재 증설')
    expect(JSON.stringify({ ...localStorage })).toBe(before)
  })

  it('detects an approval-budget overrun across multiple order IDs', async () => {
    seed({ projects: [project()], transactions: [transaction('a.xlsx:14', 'ORDER-1', '2026-06', 700), transaction('b.xlsx:14', 'ORDER-2', '2026-06', 600)], mappings: { 'ORDER-1': 'project-1', 'ORDER-2': 'project-1' } })
    const answer = await findInvestmentAnomalies(viewer, { projectId: 'project-1' })
    expect(answer.answer).toContain('BUDGET_EXCEEDED')
    expect(answer.evidence).toContainEqual(expect.objectContaining({ value: '1,300' }))
  })

  it('explains plan and actual variance with the stored reason', async () => {
    seed({ projects: [project({ rollingPlan: { '2026-07': { amount: 100, reason: '설비 납기 변경' } } })], transactions: [transaction('a.xlsx:14', 'ORDER-1', '2026-07', 150)], mappings: { 'ORDER-1': 'project-1' } })
    const answer = await explainVariance(viewer, { projectId: 'project-1', month: '2026-07' })
    expect(answer.answer).toContain('50')
    expect(answer.answer).toContain('설비 납기 변경')
  })

  it('builds a Korean executive briefing for a viewer', async () => {
    seed({ projects: [project()], transactions: [transaction('a.xlsx:14', 'ORDER-1', '2026-07', 100)], mappings: { 'ORDER-1': 'project-1' } })
    const answer = await getExecutiveBriefing(viewer, { year: 2026 })
    expect(answer.intent).toBe('investment-analysis')
    expect(answer.answer).toContain('경영진 투자비 브리핑')
    expect(answer.hasEvidence).toBe(true)
  })

  it('uses aggregated annual actuals and excludes duplicate and unmapped rows', async () => {
    seed({ projects: [project({ approvalBudget: null })], transactions: [transaction('same.xlsx:14', 'ORDER-1', '2026-07', 100), transaction('same.xlsx:14', 'ORDER-1', '2026-07', 100), transaction('unmapped.xlsx:14', 'UNMAPPED', '2026-07', 999)], mappings: { 'ORDER-1': 'project-1' } })
    const answer = await getExecutiveBriefing(viewer, { year: 2026 })
    expect(answer.answer).toContain('100')
    expect(answer.answer).not.toContain('1,199')
  })

  it('reports C14 detail-sum mismatch during workbook reconciliation', async () => {
    const result = await reconcileInvestmentWorkbook(viewer, { sourceName: 'report.xlsx', transactions: [transaction('report.xlsx:14', 'ORDER-1', '2026-07', 500), transaction('report.xlsx:15', 'ORDER-1', '2026-07', 200), transaction('report.xlsx:16', 'ORDER-1', '2026-07', 250)] })
    expect(result.errors).toContainEqual(expect.objectContaining({ code: 'DETAIL_SUM_MISMATCH' }))
  })

  it('accepts a negative adjustment when C14 equals C15:C108', async () => {
    const result = await reconcileInvestmentWorkbook(viewer, { sourceName: 'report.xlsx', transactions: [transaction('report.xlsx:14', 'ORDER-1', '2026-07', -100), transaction('report.xlsx:15', 'ORDER-1', '2026-07', -40), transaction('report.xlsx:16', 'ORDER-1', '2026-07', -60)] })
    expect(result.errors).toEqual([])
    expect(result.answer?.answer).toContain('일치')
  })

  it('reconciles production parser output with its C15:C108 detail total', async () => {
    const parsed = await parseWorkbookFiles([actualReportFile('valid-report.xlsx', 450, [200, 250])])
    const result = await reconcileInvestmentWorkbook(viewer, { sourceName: 'valid-report.xlsx', transactions: parsed.rows })
    expect(result.errors).toEqual([])
  })

  it('reports a real mismatch from production parser output', async () => {
    const parsed = await parseWorkbookFiles([actualReportFile('mismatch-report.xlsx', 500, [200, 250])])
    const result = await reconcileInvestmentWorkbook(viewer, { sourceName: 'mismatch-report.xlsx', transactions: parsed.rows })
    expect(result.errors).toContainEqual(expect.objectContaining({ code: 'DETAIL_SUM_MISMATCH' }))
  })
})
