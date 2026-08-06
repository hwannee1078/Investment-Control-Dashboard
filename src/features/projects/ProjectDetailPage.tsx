import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import MetricCard from '../../components/MetricCard'
import { InvestmentRepository } from '../../data/investmentRepository'
import { ProjectRepository } from '../../data/projectRepository'
import type { InvestmentSummary as InvestmentSummaryValue } from '../../domain/investment'
import { aggregateInvestment } from '../../services/investmentAggregation'
import InvestmentSummary from './InvestmentSummary'
import ScheduleMatrix from './ScheduleMatrix'

const currency = new Intl.NumberFormat('ko-KR')

const EMPTY_SUMMARY: InvestmentSummaryValue = {
  monthly: {},
  cumulative: {},
  cumulativeTotal: 0,
  executionRate: null,
}

export default function ProjectDetailPage() {
  const { projectId = '' } = useParams()
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
  const detail = useMemo(() => {
    const projects = new ProjectRepository().list()
    const project = projects.find(({ id }) => id === projectId)
    if (!project) {
      return null
    }

    const orderToProject = Object.fromEntries(
      project.orderIds.map((orderId) => [orderId, project.id]),
    )
    const summary = aggregateInvestment(
      new InvestmentRepository().listTransactions(),
      orderToProject,
      [project],
    ).get(project.id)

    return { project, summary: summary ?? EMPTY_SUMMARY }
  }, [projectId])

  if (!detail) {
    return (
      <main className="page-shell empty-page">
        <h1>사업을 찾을 수 없습니다.</h1>
        <Link to="/dashboard">대시보드로 돌아가기</Link>
      </main>
    )
  }

  const { project, summary } = detail
  const rollingMonths = Object.keys(project.rollingPlan ?? {}).sort()
  const chartMonths = [...new Set([...Object.keys(summary.monthly), ...rollingMonths])].sort()

  return (
    <main className="page-shell">
      <Link className="back-link" to="/dashboard">
        ← 대시보드
      </Link>
      <header className="project-heading">
        <div>
          <p className="eyebrow">Project Detail</p>
          <h1>{project.name}</h1>
        </div>
        <span className="status-badge">{project.status}</span>
      </header>

      <section className="detail-panel" aria-labelledby="basic-info-title">
        <h2 id="basic-info-title">사업 기본 정보</h2>
        <dl className="project-facts">
          <div>
            <dt>소재</dt>
            <dd>{project.material}</dd>
          </div>
          <div>
            <dt>지역</dt>
            <dd>{project.location}</dd>
          </div>
          <div>
            <dt>현재 단계</dt>
          <dd>{project.status}</dd>
          <div><dt>승인투자비</dt><dd>{project.approvalBudget === null ? '-' : `${currency.format(project.approvalBudget)}원`}</dd></div>
          </div>
        </dl>
      </section>

      <section className="detail-panel" aria-labelledby="schedule-title">
        <h2 id="schedule-title">주요 일정</h2>
        <ScheduleMatrix project={project} editable={false} />
      </section>

      <section className="detail-panel investment-section">
        <MetricCard
          label="승인투자비"
          value={
            project.approvalBudget === null
              ? '-'
              : `${currency.format(project.approvalBudget)}원`
          }
        />
        <p className="metric-subtext">누적투자비 {currency.format(summary.cumulativeTotal)}원 · 집행률 {summary.executionRate === null ? '-' : `${summary.executionRate.toFixed(1)}%`}</p>
        <InvestmentSummary summary={summary} />
      </section>

      <section className="detail-panel rolling-chart-panel" aria-labelledby="rolling-chart-title">
        <h2 id="rolling-chart-title">분기별 Rolling Plan 비교</h2>
        {chartMonths.length === 0 ? <p className="empty-state">등록된 월별 계획 또는 실적이 없습니다.</p> : (
          <div className="rolling-chart" role="img" aria-label="월별 계획·실적 투자비 비교 그래프">
            {chartMonths.map((month) => {
              const plan = project.rollingPlan?.[month]?.amount ?? 0
              const actual = summary.monthly[month] ?? 0
              const max = Math.max(1, ...chartMonths.map((item) => Math.max(Math.abs(project.rollingPlan?.[item]?.amount ?? 0), Math.abs(summary.monthly[item] ?? 0))))
              const reason = project.rollingPlan?.[month]?.reason
              return <button key={month} type="button" className="rolling-bar-group" title="클릭하여 차이 사유 확인" onClick={() => setSelectedMonth(month)}>
                <span className="rolling-month">{month}</span>
                <span className="rolling-bars"><i className="rolling-bar rolling-bar--plan" style={{ height: `${Math.max(2, Math.abs(plan) / max * 100)}%` }} /><i className="rolling-bar rolling-bar--actual" style={{ height: `${Math.max(2, Math.abs(actual) / max * 100)}%` }} /></span>
                <small>계획 {Math.round(plan / 100000000)} / 실적 {Math.round(actual / 100000000)}억원</small>
              </button>
            })}
          </div>
        )}
        {selectedMonth !== null && (
          <p className="rolling-reason"><strong>{selectedMonth} 차이 사유:</strong> {project.rollingPlan?.[selectedMonth]?.reason ?? '입력된 사유가 없습니다.'}</p>
        )}
      </section>
    </main>
  )
}
