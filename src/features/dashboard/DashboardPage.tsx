import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { ProjectRepository } from '../../data/projectRepository'
import type { Project } from '../../domain/project'
import ScheduleMatrix from '../projects/ScheduleMatrix'
import MaterialDonut from './MaterialDonut'

type Material = Project['material']

export default function DashboardPage() {
  const navigate = useNavigate()
  const [hoveredMaterial, setHoveredMaterial] = useState<Material | null>(null)
  const dashboard = useMemo(() => {
    const projects = new ProjectRepository().list()
    const projectsByMaterial: Record<Material, Project[]> = {
      양극재: projects.filter((project) => project.material === '양극재'),
      음극재: projects.filter((project) => project.material === '음극재'),
    }

    return { projects, projectsByMaterial }
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
          <p>사업관리에서 입력한 기본정보와 계획·실적 일정을 확인합니다.</p>
        </div>
        <div className="table-scroll">
          <table className="business-list-table">
            <thead>
              <tr>
                <th scope="col">사업명</th>
                <th scope="col">소재지</th>
                <th scope="col">사업일정</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.projects.map((project) => (
                <tr key={project.id}>
                  <th scope="row">
                    <button
                      className="project-link"
                      type="button"
                      onClick={() => navigate(`/projects/${project.id}`)}
                    >
                      {project.name}
                    </button>
                  </th>
                  <td>{project.location}</td>
                  <td>
                    <ScheduleMatrix project={project} editable={false} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
