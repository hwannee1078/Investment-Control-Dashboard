import { useMemo, useState } from 'react'
import { ProjectRepository } from '../../data/projectRepository'
import { createEmptySchedule, type Project } from '../../domain/project'
import { SAMPLE_PROJECTS } from '../../domain/sampleData'
import { canAdminEdit, getSessionRole } from '../auth/authStore'
import { isProjectFinalized } from '../auth/workflowStore'
import ProjectForm from './ProjectForm'
import UserRoleManagement from './UserRoleManagement'

export default function ProjectManagePage() {
  const repository = useMemo(() => new ProjectRepository(), [])
  const [projects, setProjects] = useState(() => repository.list())
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const role = getSessionRole()
  function saveProject(project: Project) { repository.save({ ...project, active: project.active !== false }); setProjects(repository.list()); setEditingProject(null) }
  function addProject() { setEditingProject({ id: `project-${Date.now()}`, name: '신규 투자사업', location: '', material: SAMPLE_PROJECTS[0].material, status: SAMPLE_PROJECTS[0].status, schedule: createEmptySchedule(), approvalBudget: null, orderIds: [], active: true }) }
  function archiveProject(project: Project) { if (role === 'admin') { repository.save({ ...project, active: false }); setProjects(repository.list()) } }
  return <main className="page-shell">
    {role === 'admin' ? <UserRoleManagement /> : null}
    <header className="page-heading"><div><p className="eyebrow">Project Administration</p><h1>사업 관리</h1></div><p>사업 기본정보와 일정을 등록·수정합니다.</p></header>
    {editingProject === null ? <section className="management-panel" aria-labelledby="project-list-title"><div className="panel-heading"><div><h2 id="project-list-title">사업 목록</h2><p>활성 사업 {projects.filter((project) => project.active !== false).length}개</p></div><button className="primary-button" type="button" onClick={addProject}>사업 추가</button></div><div className="table-scroll"><table aria-label="관리 사업 목록"><thead><tr><th>사업명</th><th>소재지</th><th>소재</th><th>사업상태</th><th>관리</th></tr></thead><tbody>{projects.map((project) => <tr key={project.id}><th scope="row">{project.name}</th><td>{project.location || '-'}</td><td>{project.material}</td><td>{project.active === false ? '비활성' : project.status}</td><td>{project.active === false ? <span className="muted">비활성</span> : isProjectFinalized(project.id) && !canAdminEdit(role) ? <span className="muted">잠금</span> : <><button className="text-button" type="button" onClick={() => setEditingProject(project)}>수정</button>{role === 'admin' ? <button className="text-button" type="button" onClick={() => archiveProject(project)}>비활성화</button> : null}</>}</td></tr>)}</tbody></table></div></section> : <section className="management-panel" aria-labelledby="project-edit-title"><div className="panel-heading"><div><h2 id="project-edit-title">사업 입력·수정</h2><p>{editingProject.name}</p></div></div><ProjectForm initialProject={editingProject} onSave={saveProject} onCancel={() => setEditingProject(null)} /></section>}
  </main>
}
