export const WORKFLOW_FINALIZED_KEY = 'investment-dashboard.workflow-finalized.v1'

export function isWorkflowFinalized(storage: Storage = localStorage): boolean {
  return storage.getItem(WORKFLOW_FINALIZED_KEY) === 'true'
}

export function finalizeWorkflow(storage: Storage = localStorage): void {
  storage.setItem(WORKFLOW_FINALIZED_KEY, 'true')
}

export function resetWorkflowFinalization(storage: Storage = localStorage): void {
  storage.removeItem(WORKFLOW_FINALIZED_KEY)
}
