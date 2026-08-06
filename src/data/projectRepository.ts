import type { Project } from '../domain/project'
import { SAMPLE_PROJECTS } from '../domain/sampleData'

export const PROJECTS_STORAGE_KEY = 'investment-dashboard.projects.v1'

export class ProjectRepository {
  constructor(private readonly storage: Storage = localStorage) {
    if (this.storage.getItem(PROJECTS_STORAGE_KEY) === null) {
      this.write(import.meta.env.PROD ? [] : SAMPLE_PROJECTS)
    }
  }

  list(): Project[] {
    const storedProjects = this.storage.getItem(PROJECTS_STORAGE_KEY)
    return storedProjects === null ? [] : (JSON.parse(storedProjects) as Project[])
  }

  get(id: string): Project | undefined {
    return this.list().find((project) => project.id === id)
  }

  save(project: Project): void {
    const projects = this.list()
    const existingIndex = projects.findIndex(({ id }) => id === project.id)

    if (existingIndex === -1) {
      projects.push(project)
    } else {
      projects[existingIndex] = project
    }

    this.write(projects)
  }

  private write(projects: Project[]): void {
    this.storage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects))
  }
}
