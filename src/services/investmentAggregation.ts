import type {
  InvestmentSummary,
  InvestmentTransaction,
} from '../domain/investment'
import type { Project } from '../domain/project'
import type { ImportError } from './investmentImport'

export function aggregateInvestment(
  rows: InvestmentTransaction[],
  orderToProject: Record<string, string>,
  projects: Project[],
): Map<string, InvestmentSummary> {
  const projectsById = new Map(projects.map((project) => [project.id, project]))
  const monthlyByProject = new Map<string, Map<string, number>>()
  const seenRows = new Set<string>()

  for (const row of rows) {
    const rowIdentity = `${row.sourceId}\u0000${row.rowId}`
    if (seenRows.has(rowIdentity)) {
      continue
    }
    seenRows.add(rowIdentity)

    const projectId = orderToProject[row.orderId]
    if (projectId === undefined || !projectsById.has(projectId)) {
      continue
    }

    const monthly = monthlyByProject.get(projectId) ?? new Map<string, number>()
    monthly.set(row.month, (monthly.get(row.month) ?? 0) + row.amount)
    monthlyByProject.set(projectId, monthly)
  }

  const summaries = new Map<string, InvestmentSummary>()

  for (const [projectId, monthlyAmounts] of monthlyByProject) {
    const sortedMonthlyEntries = [...monthlyAmounts.entries()].sort(([left], [right]) =>
      left.localeCompare(right),
    )
    const monthly: Record<string, number> = {}
    const cumulative: Record<string, number> = {}
    let cumulativeTotal = 0

    for (const [month, amount] of sortedMonthlyEntries) {
      monthly[month] = amount
      cumulativeTotal += amount
      cumulative[month] = cumulativeTotal
    }

    const approvalBudget = projectsById.get(projectId)?.approvalBudget
    summaries.set(projectId, {
      monthly,
      cumulative,
      cumulativeTotal,
      executionRate:
        approvalBudget === null || approvalBudget === undefined || approvalBudget <= 0
          ? null
          : (cumulativeTotal / approvalBudget) * 100,
    })
  }

  return summaries
}

export function findUnmappedOrderErrors(
  rows: InvestmentTransaction[],
  orderToProject: Record<string, string>,
  projects: Project[],
): ImportError[] {
  const projectIds = new Set(projects.map(({ id }) => id))

  return rows.flatMap((row) => {
    const projectId = orderToProject[row.orderId]
    if (projectId !== undefined && projectIds.has(projectId)) {
      return []
    }

    return [
      {
        sourceId: row.sourceId,
        rowId: row.rowId,
        code: 'UNMAPPED_ORDER' as const,
        message: `투자오더번호 ${row.orderId}에 연결된 사업이 없습니다.`,
      },
    ]
  })
}
