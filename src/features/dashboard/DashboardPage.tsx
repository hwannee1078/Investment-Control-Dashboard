import { Fragment, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { InvestmentRepository } from '../../data/investmentRepository'
import { ProjectRepository } from '../../data/projectRepository'
import type { Project } from '../../domain/project'
import type { InvestmentSummary } from '../../domain/investment'
import { PROJECT_STAGES } from '../../domain/project'
import { aggregateInvestment } from '../../services/investmentAggregation'
import MaterialDonut from './MaterialDonut'

type Material = Project['material']

export default function DashboardPage() {
  const navigate = useNavigate()
  const [hoveredMaterial, setHoveredMaterial] = useState<Material | null>(null)
  const dashboard = useMemo(() => {
    const projects = new ProjectRepository().list()
    const rows = new InvestmentRepository().listTransactions()
    const orderToProject = Object.fromEntries(
      projects.flatMap((project) => project.orderIds.map((orderId) => [orderId, project.id])),
    )
    const summaries = aggregateInvestment(rows, orderToProject, projects)
    const projectsByMaterial: Record<Material, Project[]> = {
      양극재: projects.filter((project) => project.material === '양극재'),
      음극재: projects.filter((project) => project.material === '음극재'),
    }

    return { projects, projectsByMaterial, summaries }
  }, [])

  const counts = {
    양극재: dashboard.projectsByMaterial.양극재.length,
    음극재: dashboard.projectsByMaterial.음극재.length,
  }

  return (
    <main className="page-shell">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Executive Overview</p>
          <h1 id="dashboard-title">투자비 대시보드</h1>
        </div>
        <p>전체 사업의 일정과 투자 현황을 한눈에 확인합니다.</p>
      </header>

      <section className="dashboard-panel" aria-labelledby="material-title">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Portfolio Mix</p>
            <h2 id="material-title">소재별 사업현황</h2>
          </div>
          <p>
            {hoveredMaterial
              ? `${hoveredMaterial} 사업 목록`
              : '소재에 마우스를 올려 사업을 확인하세요.'}
          </p>
        </div>
        <MaterialDonut
          counts={counts}
          projectsByMaterial={dashboard.projectsByMaterial}
          onMaterialHover={setHoveredMaterial}
          onProjectSelect={(projectId) => navigate(`/projects/${projectId}`)}
        />
      </section>

      <section className="dashboard-panel business-list-panel" aria-labelledby="business-list-title">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Business Portfolio</p>
            <h2 id="business-list-title">사업목록</h2>
          </div>
          <p>사업관리에서 입력한 일정과 투자비 현황을 확인합니다.</p>
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
                  {PROJECT_STAGES.map((stage) => (
                    <td key={stage}>{project.schedule[stage].actual ?? '-'}</td>
                  ))}
                </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
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
  const toBillionWon = (value: number) => `${(value / 100_000_000).toFixed(1)}억원`

  return (
    <td className="investment-summary-cell" rowSpan={2}>
      <dl className="investment-summary-table">
        <div><dt>승인투자비</dt><dd>{toBillionWon(approvalBudget)}</dd></div>
        <div><dt>누적투자비</dt><dd>{toBillionWon(cumulative)}</dd></div>
        <div><dt>잔여투자비</dt><dd>{toBillionWon(remaining)}</dd></div>
        <div><dt>누적률</dt><dd>{rate === null ? '-' : `${rate.toFixed(1)}%`}</dd></div>
      </dl>
    </td>
  )
}
