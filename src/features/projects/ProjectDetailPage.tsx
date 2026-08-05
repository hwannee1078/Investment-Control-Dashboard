import { useMemo } from 'react'
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
        <InvestmentSummary summary={summary} />
      </section>
    </main>
  )
}
