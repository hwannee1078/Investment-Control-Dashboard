export const WORKFLOW_FINALIZED_KEY = 'investment-dashboard.workflow-finalized.v1'
export const PROJECT_FINALIZED_KEY = 'investment-dashboard.project-finalized.v1'

export function isWorkflowFinalized(storage: Storage = localStorage): boolean {
  return storage.getItem(WORKFLOW_FINALIZED_KEY) === 'true'
}

export function finalizeWorkflow(storage: Storage = localStorage): void {
  storage.setItem(WORKFLOW_FINALIZED_KEY, 'true')
}

export function resetWorkflowFinalization(storage: Storage = localStorage): void {
  storage.removeItem(WORKFLOW_FINALIZED_KEY)
}

function readProjectFinalized(storage: Storage): Record<string, boolean> {
  try { return JSON.parse(storage.getItem(PROJECT_FINALIZED_KEY) ?? '{}') as Record<string, boolean> } catch { return {} }
}
export function isProjectFinalized(projectId: string, storage: Storage = localStorage): boolean { return readProjectFinalized(storage)[projectId] === true }
export function finalizeProject(projectId: string, storage: Storage = localStorage): void { storage.setItem(PROJECT_FINALIZED_KEY, JSON.stringify({ ...readProjectFinalized(storage), [projectId]: true })) }
