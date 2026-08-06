import { useMemo, useState } from 'react'

import { ProjectRepository } from '../../data/projectRepository'
import type { Project } from '../../domain/project'
import ProjectForm from './ProjectForm'
import { canAdminEdit, getSessionRole } from '../auth/authStore'
import { isWorkflowFinalized } from '../auth/workflowStore'

export default function ProjectManagePage() {
  const repository = useMemo(() => new ProjectRepository(), [])
  const [projects, setProjects] = useState(() => repository.list())
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const role = getSessionRole()
  const isLocked = isWorkflowFinalized() && !canAdminEdit(role)

  function saveProject(project: Project) {
    repository.save(project)
    setProjects(repository.list())
    setEditingProject(null)
  }

  return (
    <main className="page-shell">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Project Administration</p>
          <h1>사업 관리</h1>
        </div>
        <p>사업 기본 정보와 주요 일정을 수정합니다.</p>
      </header>

      {editingProject === null ? (
        <section className="management-panel" aria-labelledby="project-list-title">
          <div className="panel-heading">
            <h2 id="project-list-title">사업 목록</h2>
            <p>총 {projects.length}개 사업</p>
          </div>
          <div className="table-scroll">
            <table aria-label="관리 사업 목록">
              <thead>
                <tr>
                  <th scope="col">사업명</th>
                  <th scope="col">소재지</th>
                  <th scope="col">소재</th>
                  <th scope="col">사업상태</th>
                  <th scope="col">관리</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr key={project.id}>
                    <th scope="row">{project.name}</th>
                    <td>{project.location}</td>
                    <td>{project.material}</td>
                    <td>{project.status}</td>
                    <td>
                      {isLocked ? <span className="muted">잠금</span> : <a
                        className="text-button"
                        href={`/manage#${project.id}`}
                        aria-label={`${project.name} 수정`}
                        onClick={(event) => {
                          event.preventDefault()
                          setEditingProject(project)
                        }}
                      >
                        수정
                      </a>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="management-panel" aria-labelledby="project-edit-title">
          <div className="panel-heading">
            <h2 id="project-edit-title">사업 수정</h2>
            <p>{editingProject.name}</p>
          </div>
          <ProjectForm
            initialProject={editingProject}
            onSave={saveProject}
            onCancel={() => setEditingProject(null)}
          />
        </section>
      )}
    </main>
  )
}
