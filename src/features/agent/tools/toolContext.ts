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

export type AgentToolData = {
  projects: Project[]
  transactions: InvestmentTransaction[]
  orderToProject: Record<string, string>
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
