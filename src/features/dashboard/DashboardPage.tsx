import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import MetricCard from '../../components/MetricCard'
import { InvestmentRepository } from '../../data/investmentRepository'
import { ProjectRepository } from '../../data/projectRepository'
import type { Project } from '../../domain/project'
import { aggregateInvestment } from '../../services/investmentAggregation'
import MaterialDonut from './MaterialDonut'

type Material = Project['material']

const currency = new Intl.NumberFormat('ko-KR')

export default function DashboardPage() {
  const navigate = useNavigate()
  const [hoveredMaterial, setHoveredMaterial] = useState<Material | null>(null)
  const dashboard = useMemo(() => {
    const projects = new ProjectRepository().list()
    const rows = new InvestmentRepository().listTransactions()
    const orderToProject = Object.fromEntries(
      projects.flatMap((project) =>
        project.orderIds.map((orderId) => [orderId, project.id]),
      ),
    )
    const summaries = aggregateInvestment(rows, orderToProject, projects)
    const approvalBudget = projects.reduce(
      (total, project) => total + (project.approvalBudget ?? 0),
      0,
    )
    const cumulativeInvestment = [...summaries.values()].reduce(
      (total, summary) => total + summary.cumulativeTotal,
      0,
    )
    const projectsByMaterial: Record<Material, Project[]> = {
      양극재: projects.filter((project) => project.material === '양극재'),
      음극재: projects.filter((project) => project.material === '음극재'),
    }

    return {
      approvalBudget,
      cumulativeInvestment,
      executionRate:
        approvalBudget > 0 ? (cumulativeInvestment / approvalBudget) * 100 : null,
      projectsByMaterial,
    }
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
          <h1>투자비 대시보드</h1>
        </div>
        <p>전체 사업의 투자 규모와 집행 현황을 확인합니다.</p>
      </header>

      <section className="metric-grid" aria-label="주요 투자 지표">
        <MetricCard
          label="승인투자비"
          value={`${currency.format(dashboard.approvalBudget)}원`}
        />
        <MetricCard
          label="누적투자비"
          value={`${currency.format(dashboard.cumulativeInvestment)}원`}
          tone="blue"
        />
        <MetricCard
          label="집행률(%)"
          value={
            dashboard.executionRate === null
              ? '-'
              : `${dashboard.executionRate.toFixed(1)}%`
          }
          tone="mint"
        />
      </section>

      <section className="dashboard-panel" aria-labelledby="material-title">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Portfolio Mix</p>
            <h2 id="material-title">소재별 사업 현황</h2>
          </div>
          <p>{hoveredMaterial ? `${hoveredMaterial} 사업 목록` : '소재에 마우스를 올려 사업을 확인하세요.'}</p>
        </div>
        <MaterialDonut
          counts={counts}
          projectsByMaterial={dashboard.projectsByMaterial}
          onMaterialHover={setHoveredMaterial}
          onProjectSelect={(projectId) => navigate(`/projects/${projectId}`)}
        />
      </section>
    </main>
  )
}
