import { Fragment, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { InvestmentRepository } from '../../data/investmentRepository'
import { ProjectRepository } from '../../data/projectRepository'
import type { Project } from '../../domain/project'
import type { InvestmentSummary } from '../../domain/investment'
import { SAMPLE_INVESTMENT_TRANSACTIONS } from '../../domain/sampleData'
import { PROJECT_STAGES } from '../../domain/project'
import { aggregateInvestment } from '../../services/investmentAggregation'
import MaterialDonut from './MaterialDonut'
import ExecutiveTour, { ExecutiveTourRestart } from './ExecutiveTour'
import { getSessionRole } from '../auth/authStore'

type Material = Project['material']

export default function DashboardPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [hoveredMaterial, setHoveredMaterial] = useState<Material | null>(null)
  const executiveView = getSessionRole() === 'viewer'
  const sampleMode = new URLSearchParams(location.search).get('sample') === '1'
  const dashboard = useMemo(() => {
    const projects = new ProjectRepository().list().filter((project) => project.active !== false)
    const rows = sampleMode
      ? [...SAMPLE_INVESTMENT_TRANSACTIONS]
      : new InvestmentRepository().listTransactions()
    const orderToProject = Object.fromEntries(
      projects.flatMap((project) => project.orderIds.map((orderId) => [orderId, project.id])),
    )
    const summaries = aggregateInvestment(rows, orderToProject, projects)
    const projectsByMaterial: Record<Material, Project[]> = {
      양극재: projects.filter((project) => project.material === '양극재'),
      음극재: projects.filter((project) => project.material === '음극재'),
    }

    return { projects, projectsByMaterial, summaries }
  }, [sampleMode])

  const counts = {
    양극재: dashboard.projectsByMaterial.양극재.length,
    음극재: dashboard.projectsByMaterial.음극재.length,
  }

  return (
    <>
    <main className="page-shell">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Executive Overview</p>
          <h1 id="dashboard-title">투자비 대시보드</h1>
        </div>
        <div className="page-heading-actions"><p>전체 사업의 일정과 투자 현황을 한눈에 확인합니다.</p><ExecutiveTourRestart enabled={executiveView} /></div>
      </header>

      <section className="dashboard-panel" data-tour-target="materials" aria-labelledby="material-title">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Portfolio Mix</p>
            <h2 id="material-title">소재별 사업현황 <DashboardHelp text="양극재·음극재 사업 수를 보여줍니다. 소재에 마우스를 올리면 해당 사업 목록이 나타납니다." /></h2>
          </div>
          <p>
            {hoveredMaterial
              ? `${hoveredMaterial} 사업 목록`
              : '소재에 마우스를 올려 사업을 확인하세요.'}
          </p>
        </div>
        <div className="portfolio-overview">
          <MaterialDonut
            counts={counts}
            projectsByMaterial={dashboard.projectsByMaterial}
            onMaterialHover={setHoveredMaterial}
            onProjectSelect={(projectId) => navigate(`/projects/${projectId}`)}
          />
          <InvestmentBarChart projects={dashboard.projects} summaries={dashboard.summaries} />
        </div>
      </section>

      <section className="dashboard-panel business-list-panel" data-tour-target="business-list" aria-labelledby="business-list-title">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Business Portfolio</p>
            <h2 id="business-list-title">사업목록</h2>
          </div>
          <p>사업관리에서 입력한 일정과 투자비 현황을 확인합니다. <DashboardHelp text="계획과 실적 날짜를 비교하고, 실적 날짜에 마우스를 올리면 작성된 지연·단축 사유를 확인할 수 있습니다." /></p>
        </div>
        <div className="table-scroll">
          <table className="business-list-table">
            <thead>
              <tr>
                <th scope="col" rowSpan={2}>사업명</th>
                <th scope="col" rowSpan={2}>구분</th>
                {PROJECT_STAGES.map((stage) => (
                  <th key={stage} scope="col">{stage}</th>
                ))}
                <th scope="col" rowSpan={2}>투자비 현황<br /><small>(억원)</small></th>
              </tr>
            </thead>
            <tbody>
              {dashboard.projects.map((project) => (
                <Fragment key={project.id}>
                <tr key={`${project.id}-plan`}>
                  <th scope="row" rowSpan={2}>
                    <button
                      className="project-link"
                      data-tour-target="project-link"
                      type="button"
                      onClick={() => navigate(`/projects/${project.id}`)}
                    >
                      {project.name}
                    </button>
                  </th>
                  <th scope="row">계획</th>
                  {PROJECT_STAGES.map((stage) => (
                    <td key={stage}>{project.schedule[stage].plan ?? '-'}</td>
                  ))}
                  <InvestmentSummaryCell project={project} summary={dashboard.summaries.get(project.id)} />
                </tr>
                <tr key={`${project.id}-actual`}>
                  <th scope="row">실적</th>
                  {PROJECT_STAGES.map((stage) => {
                    const schedule = project.schedule[stage]
                    const reason = schedule.actualReason?.trim()
                    return (
                      <td key={stage}>
                        {schedule.actual ? (
                          reason ? (
                            <span
                              className="actual-date-with-reason"
                              data-tour-target="schedule-reason"
                              tabIndex={0}
                              data-tooltip={reason}
                              aria-label={`${schedule.actual}, 실적 사유: ${reason}`}
                            >
                              {schedule.actual}
                            </span>
                          ) : (
                            schedule.actual
                          )
                        ) : '-'}
                      </td>
                    )
                  })}
                </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
    <ExecutiveTour enabled={executiveView} />
    </>
  )
}

function InvestmentBarChart({ projects, summaries }: { projects: Project[]; summaries: Map<string, InvestmentSummary> }) {
  return <section className="investment-bar-chart" data-tour-target="investment" aria-labelledby="investment-bar-chart-title"><div className="panel-heading"><div><p className="eyebrow">Investment Overview</p><h3 id="investment-bar-chart-title">사업별 투자비 현황 <DashboardHelp text="승인투자비를 100% 기준으로 두고 누적투자비가 얼마나 집행됐는지 비교합니다. 오른쪽 수치는 누적률입니다." /></h3></div><small>단위: 억원</small></div><div className="investment-bar-list">{projects.map((project) => { const approval = project.approvalBudget ?? 0; const cumulative = summaries.get(project.id)?.cumulativeTotal ?? 0; const rate = approval > 0 ? cumulative / approval * 100 : null; const cumulativeWidth = approval > 0 ? Math.min(100, Math.abs(cumulative) / approval * 100) : 0; return <div className="investment-bar-row" key={project.id}><div className="investment-bar-label">{project.name}<span>{rate === null ? '-' : `${rate.toFixed(1)}%`}</span></div><div className="investment-bar-track"><i className="investment-bar investment-bar--cumulative" style={{ width: `${cumulativeWidth}%` }} /><i className="investment-bar investment-bar--approval" style={{ width: approval > 0 ? '100%' : '0%' }} /></div><div className="investment-bar-values"><span>누적 {Math.round(cumulative / 100000000).toLocaleString()}</span><span>승인 {Math.round(approval / 100000000).toLocaleString()}</span></div></div>})}</div><div className="investment-bar-legend"><span><i className="legend-dot legend-dot--cumulative" />누적투자비</span><span><i className="legend-dot legend-dot--approval" />승인투자비</span><strong>누적률</strong></div></section>
}

function DashboardHelp({ text }: { text: string }) {
  return <span className="dashboard-help" tabIndex={0} aria-label={`설명: ${text}`}><span className="dashboard-help__icon" aria-hidden="true">?</span><span className="dashboard-help__box" role="tooltip">{text}</span></span>
}

function InvestmentSummaryCell({
  project,
  summary,
}: {
  project: Project
  summary: InvestmentSummary | undefined
}) {
  const approvalBudget = project.approvalBudget ?? 0
  const cumulative = summary?.cumulativeTotal ?? 0
  const remaining = approvalBudget - cumulative
  const rate = approvalBudget > 0 ? (cumulative / approvalBudget) * 100 : null
  const toBillionWon = (value: number) => (value / 100_000_000).toFixed(1)

  return (
    <td className="investment-summary-cell" rowSpan={2}>
      <div className="investment-summary-list" role="group" aria-label="투자비 현황">
        <div><span>승인투자비</span><strong>{toBillionWon(approvalBudget)}</strong></div>
        <div><span>누적투자비</span><strong>{toBillionWon(cumulative)}</strong></div>
        <div><span>잔여투자비</span><strong>{toBillionWon(remaining)}</strong></div>
        <div><span>누적률</span><strong>{rate === null ? '-' : `${rate.toFixed(1)}%`}</strong></div>
      </div>
    </td>
  )
}
