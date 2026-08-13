import type { InvestmentTransaction } from '../../../domain/investment'
import { PROJECT_STAGES, type Project } from '../../../domain/project'
import type { AgentToolContext } from '../agentToolTypes'
import {
  AgentToolDataUnavailableError,
  type AgentToolData,
  type AgentToolDataProvider,
} from './toolContext'

type QueryResult = { data: unknown; error: unknown }

export interface SupabaseAgentDataClient {
  from(table: string): {
    select(columns: string): PromiseLike<QueryResult>
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isProject(value: unknown): value is Project {
  if (!isRecord(value) || !isRecord(value.schedule) || !Array.isArray(value.orderIds)) return false
  const schedule = value.schedule
  return typeof value.id === 'string'
    && typeof value.name === 'string'
    && typeof value.location === 'string'
    && typeof value.material === 'string'
    && typeof value.status === 'string'
    && (value.approvalBudget === null || (typeof value.approvalBudget === 'number' && Number.isFinite(value.approvalBudget)))
    && value.orderIds.every((orderId) => typeof orderId === 'string')
    && PROJECT_STAGES.every((stage) => isRecord(schedule[stage]))
}

function isTransaction(value: unknown): value is InvestmentTransaction {
  if (!isRecord(value)) return false
  return typeof value.sourceId === 'string'
    && typeof value.rowId === 'string'
    && typeof value.orderId === 'string'
    && /^20\d{2}-(0[1-9]|1[0-2])$/.test(String(value.month))
    && typeof value.amount === 'number'
    && Number.isFinite(value.amount)
}

function rows(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value) || !value.every(isRecord)) throw new AgentToolDataUnavailableError()
  return value
}

export function createSupabaseAgentToolDataProvider(client: SupabaseAgentDataClient): AgentToolDataProvider {
  return {
    async load(_context: AgentToolContext): Promise<AgentToolData> {
      const [projectsResult, transactionsResult, mappingsResult] = await Promise.all([
        client.from('projects').select('id,data'),
        client.from('investment_transactions').select('source_id,row_id,data'),
        client.from('order_mappings').select('order_id,project_id'),
      ])
      if (projectsResult.error || transactionsResult.error || mappingsResult.error) {
        throw new AgentToolDataUnavailableError()
      }

      const projects = rows(projectsResult.data).map((row) => {
        if (typeof row.id !== 'string' || !isProject(row.data) || row.data.id !== row.id) {
          throw new AgentToolDataUnavailableError()
        }
        return row.data
      }).filter((project) => project.active !== false)

      const transactions = rows(transactionsResult.data).map((row) => {
        if (
          typeof row.source_id !== 'string'
          || typeof row.row_id !== 'string'
          || !isTransaction(row.data)
          || row.data.sourceId !== row.source_id
          || row.data.rowId !== row.row_id
        ) throw new AgentToolDataUnavailableError()
        return row.data
      })

      const orderToProject: Record<string, string> = {}
      for (const row of rows(mappingsResult.data)) {
        if (typeof row.order_id !== 'string' || typeof row.project_id !== 'string') {
          throw new AgentToolDataUnavailableError()
        }
        orderToProject[row.order_id] = row.project_id
      }

      return { projects, transactions, orderToProject }
    },
  }
}
