import type { InvestmentTransaction } from '../../../domain/investment'
import { aggregateInvestment } from '../../../services/investmentAggregation'
import type { AgentAnswer, AgentEvidence } from '../agentTypes'
import type { AgentToolContext, AgentToolResult } from '../agentToolTypes'
import { getAgentToolData } from './toolContext'

const SOURCE = '대시보드 저장 데이터'

function formatAmount(value: number): string {
  return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 }).format(value)
}

function answer(
  text: string,
  evidence: AgentEvidence[],
): AgentAnswer {
  return {
    answer: text,
    intent: 'investment-analysis',
    citations: [{ title: '투자비 대시보드', url: 'local://investment-dashboard' }],
    evidence,
    hasEvidence: evidence.length > 0,
  }
}

function noEvidence(message: string): AgentAnswer {
  return answer(`[NO_EVIDENCE] ${message}`, [])
}

export async function findInvestmentAnomalies(
  _context: AgentToolContext,
  options: { projectId?: string; month?: string } = {},
): Promise<AgentAnswer> {
  const data = getAgentToolData()
  const projects = data.projects.filter((project) =>
    (options.projectId === undefined || project.id === options.projectId),
  )
  const summaries = aggregateInvestment(data.transactions, data.orderToProject, projects)
  const findings: string[] = []
  const evidence: AgentEvidence[] = []

  for (const project of projects) {
    const summary = summaries.get(project.id)
    if (summary === undefined) continue

    if (
      project.approvalBudget !== null &&
      project.approvalBudget > 0 &&
      summary.cumulativeTotal > project.approvalBudget
    ) {
      findings.push(
        `[BUDGET_EXCEEDED] ${project.name}: 누적 실적 ${formatAmount(summary.cumulativeTotal)}원이 승인예산 ${formatAmount(project.approvalBudget)}원을 초과했습니다.`,
      )
      evidence.push({
        label: `${project.name} 누적 실적`,
        value: formatAmount(summary.cumulativeTotal),
        source: SOURCE,
      })
    }

    const entries = Object.entries(summary.monthly)
      .filter(([month]) => options.month === undefined || month === options.month)
      .sort(([left], [right]) => left.localeCompare(right))
    const allEntries = Object.entries(summary.monthly).sort(([left], [right]) =>
      left.localeCompare(right),
    )

    for (const [month, amount] of entries) {
      const index = allEntries.findIndex(([candidate]) => candidate === month)
      const previous = index <= 0 ? undefined : allEntries[index - 1]
      if (
        previous !== undefined &&
        previous[1] > 0 &&
        amount > previous[1] * 2
      ) {
        findings.push(
          `[MONTHLY_SPIKE] ${project.name}: ${month} 실적 ${formatAmount(amount)}원이 전월 ${formatAmount(previous[1])}원 대비 급증했습니다.`,
        )
        evidence.push({
          label: `${project.name} ${month} 월별 실적`,
          value: formatAmount(amount),
          source: SOURCE,
        })
      }
    }
  }

  return findings.length === 0
    ? noEvidence('선택한 범위에서 투자비 이상 징후를 찾지 못했습니다.')
    : answer(findings.join('\n'), evidence)
}

export async function explainVariance(
  _context: AgentToolContext,
  input: { projectId: string; month?: string },
): Promise<AgentAnswer> {
  const data = getAgentToolData()
  const project = data.projects.find(({ id }) => id === input.projectId)
  if (project === undefined) return noEvidence('요청한 사업을 찾지 못했습니다.')

  const summary = aggregateInvestment(
    data.transactions,
    data.orderToProject,
    [project],
  ).get(project.id)
  const months = [...new Set([
    ...Object.keys(project.rollingPlan ?? {}),
    ...Object.keys(summary?.monthly ?? {}),
  ])].sort()
  const month = input.month ?? months.at(-1)
  if (month === undefined) return noEvidence(`${project.name}의 비교 가능한 월별 데이터가 없습니다.`)

  const plan = project.rollingPlan?.[month]
  const actual = summary?.monthly[month]
  if (plan?.amount === null || plan?.amount === undefined || actual === undefined) {
    return noEvidence(`${project.name} ${month}의 계획 또는 실적 데이터가 없습니다.`)
  }

  const variance = actual - plan.amount
  const reason = plan.reason?.trim() || '입력된 차이 사유가 없습니다.'
  return answer(
    `${project.name} ${month} 계획 대비 실적 차이는 ${formatAmount(variance)}원입니다. 계획 ${formatAmount(plan.amount)}원, 실적 ${formatAmount(actual)}원입니다. 사유: ${reason}`,
    [
      { label: '계획', value: formatAmount(plan.amount), source: SOURCE },
      { label: '실적(C14)', value: formatAmount(actual), source: SOURCE },
      { label: '차이 사유', value: reason, source: SOURCE },
    ],
  )
}

export async function getExecutiveBriefing(
  _context: AgentToolContext,
  input: { year?: number } = {},
): Promise<AgentAnswer> {
  const data = getAgentToolData()
  const summaries = aggregateInvestment(data.transactions, data.orderToProject, data.projects)
  const selectedMonths = [...summaries.values()].flatMap((summary) =>
    Object.keys(summary.monthly).filter((month) =>
      input.year === undefined || month.startsWith(`${input.year}-`),
    ),
  )
  const totalActual = [...summaries.values()].reduce(
    (total, summary) => total + summary.cumulativeTotal,
    0,
  )
  const totalBudget = data.projects.reduce(
    (total, project) => total + (project.approvalBudget ?? 0),
    0,
  )
  const yearLabel = input.year === undefined ? '전체' : `${input.year}년`
  const inYearActual = input.year === undefined
    ? totalActual
    : [...summaries.values()].reduce(
        (total, summary) =>
          total + Object.entries(summary.monthly)
            .filter(([month]) => month.startsWith(`${input.year}-`))
            .reduce((annual, [, amount]) => annual + amount, 0),
        0,
      )

  if (data.projects.length === 0 || selectedMonths.length === 0) {
    return noEvidence('경영진 브리핑을 만들 투자비 데이터가 없습니다.')
  }

  return answer(
    `${yearLabel} 경영진 투자비 브리핑: ${data.projects.length}개 사업의 누적 실적은 ${formatAmount(totalActual)}원이며, 승인예산 ${formatAmount(totalBudget)}원 대비 ${totalBudget > 0 ? ((totalActual / totalBudget) * 100).toFixed(1) : '산정 불가'}%입니다. ${yearLabel} 실적은 ${formatAmount(inYearActual)}원입니다.`,
    [
      { label: '사업 수', value: String(data.projects.length), source: SOURCE },
      { label: '누적 실적', value: formatAmount(totalActual), source: SOURCE },
      { label: '승인예산', value: formatAmount(totalBudget), source: SOURCE },
    ],
  )
}

function rowNumber(row: InvestmentTransaction): number | undefined {
  const match = /(?:^|:)(\d+)$/.exec(row.rowId)
  return match === null ? undefined : Number(match[1])
}

export async function reconcileInvestmentWorkbook(
  _context: AgentToolContext,
  input: { transactions: InvestmentTransaction[]; sourceName: string },
): Promise<AgentToolResult> {
  const rows = input.transactions.filter(({ sourceId }) => sourceId === input.sourceName)
  const actualRows = rows.filter((row) => rowNumber(row) === 14)
  if (actualRows.length === 0) {
    return {
      answer: noEvidence(`${input.sourceName}에서 월별 실적(C14)을 찾지 못했습니다.`),
      errors: [{ code: 'NO_EVIDENCE', message: '월별 실적(C14) 행이 없습니다.', recoverable: true }],
    }
  }

  const actual = actualRows.reduce((total, row) => total + row.amount, 0)
  const detailRows = rows
    .filter((row) => {
      const number = rowNumber(row)
      return number !== undefined && number >= 15 && number <= 108
    })
  const detail = detailRows.length > 0
    ? detailRows.reduce((total, row) => total + row.amount, 0)
    : actualRows.reduce(
        (total, row) => total + (row.reconciliationDetailTotal ?? 0),
        0,
      )
  const difference = actual - detail
  const consistent = difference === 0

  return {
    answer: answer(
      consistent
        ? `${input.sourceName}의 월별 실적(C14)과 검증 합계(C15:C108)가 일치합니다.`
        : `${input.sourceName}의 월별 실적(C14)과 검증 합계(C15:C108)가 일치하지 않습니다. 차이: ${formatAmount(difference)}원`,
      [
        { label: '월별 실적(C14)', value: formatAmount(actual), source: input.sourceName },
        { label: '검증 합계(C15:C108)', value: formatAmount(detail), source: input.sourceName },
      ],
    ),
    errors: consistent
      ? []
      : [{
          code: 'DETAIL_SUM_MISMATCH',
          message: '월별 실적(C14)과 검증 합계(C15:C108)가 일치하지 않습니다.',
          recoverable: true,
        }],
  }
}
