import type { Project } from '../../domain/project'

type ProjectHoverListProps = {
  material: Project['material']
  projects: Project[]
  onProjectSelect: (projectId: string) => void
}

export default function ProjectHoverList({
  material,
  projects,
  onProjectSelect,
}: ProjectHoverListProps) {
  return (
    <div
      className="project-hover-list"
      aria-live="polite"
      role="region"
      aria-label={`${material} 사업 목록`}
    >
      <p>{material} 사업</p>
      <ul>
        {projects.map((project) => (
          <li key={project.id}>
            <button
              type="button"
              aria-label={`${project.name} 상세 보기`}
              onClick={() => onProjectSelect(project.id)}
            >
              <span>{project.name}</span>
              <small>{project.location}</small>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
