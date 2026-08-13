import type { AgentAnswer, AgentDraft, AgentRole } from './agentTypes'

export interface AgentToolContext {
  userId: string
  employeeId: string
  role: AgentRole
  now: string
}

export interface AgentToolResult {
  answer?: AgentAnswer
  draft?: AgentDraft
  errors: Array<{ code: string; message: string; recoverable: boolean }>
}
