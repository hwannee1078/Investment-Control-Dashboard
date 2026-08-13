import {
  ORDER_MAPPINGS_STORAGE_KEY,
  TRANSACTIONS_STORAGE_KEY,
} from '../../../data/investmentRepository'
import { PROJECTS_STORAGE_KEY } from '../../../data/projectRepository'
import type { InvestmentTransaction } from '../../../domain/investment'
import type { Project } from '../../../domain/project'
import {
  SAMPLE_INVESTMENT_TRANSACTIONS,
  SAMPLE_PROJECTS,
} from '../../../domain/sampleData'
import type { AgentToolContext } from '../agentToolTypes'

export type AgentToolData = {
  projects: Project[]
  transactions: InvestmentTransaction[]
  orderToProject: Record<string, string>
}

export interface AgentToolDataProvider {
  load(context: AgentToolContext): Promise<AgentToolData>
}

export class AgentToolDataUnavailableError extends Error {
  readonly code = 'DATA_SOURCE_UNAVAILABLE'

  constructor() {
    super('DATA_SOURCE_UNAVAILABLE')
    this.name = 'AgentToolDataUnavailableError'
  }
}

function readJson<T>(storage: Storage, key: string, fallback: T): T {
  const value = storage.getItem(key)
  if (value === null) return fallback

  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

/** Reads the dashboard's persisted data without seeding or changing storage. */
export function getAgentToolData(storage: Storage = localStorage): AgentToolData {
  const projects = readJson(storage, PROJECTS_STORAGE_KEY, [...SAMPLE_PROJECTS])
    .filter((project) => project.active !== false)
  const transactions = readJson(
    storage,
    TRANSACTIONS_STORAGE_KEY,
    [...SAMPLE_INVESTMENT_TRANSACTIONS],
  )
  const storedMappings = readJson<Record<string, string>>(
    storage,
    ORDER_MAPPINGS_STORAGE_KEY,
    {},
  )
  const orderToProject = {
    ...Object.fromEntries(
      projects.flatMap((project) =>
        project.orderIds.map((orderId) => [orderId, project.id]),
      ),
    ),
    ...storedMappings,
  }

  return { projects, transactions, orderToProject }
}

/** Browser-only adapter for deterministic local tests and the existing dashboard repositories. */
export function createBrowserAgentToolDataProvider(storage: Storage = localStorage): AgentToolDataProvider {
  return { load: async () => getAgentToolData(storage) }
}

/** Safe gateway default. A production caller must inject an authenticated server provider. */
export const unavailableAgentToolDataProvider: AgentToolDataProvider = {
  load: async () => { throw new AgentToolDataUnavailableError() },
}
