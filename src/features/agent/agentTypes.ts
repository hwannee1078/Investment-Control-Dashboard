export type AgentIntent =
  | 'investment-analysis'
  | 'schedule-analysis'
  | 'workbook-validation'
  | 'safety-search'
  | 'unknown'

export type AgentRole = 'viewer' | 'staff' | 'admin'

export interface AgentCitation {
  title: string
  section?: string
  page?: number
  sourceDate?: string
  url: string
}

export interface AgentEvidence {
  label: string
  value: string
  source: string
}

export interface AgentAnswer {
  answer: string
  intent: AgentIntent
  citations: AgentCitation[]
  evidence: AgentEvidence[]
  hasEvidence: boolean
}

export interface AgentDraft {
  id: string
  kind: 'investment-import' | 'schedule-update'
  projectId: string
  summary: string
  changes: Array<{ field: string; before: unknown; after: unknown }>
  validations: Array<{ code: string; passed: boolean; message: string }>
  status: 'pending' | 'approved' | 'cancelled'
}
