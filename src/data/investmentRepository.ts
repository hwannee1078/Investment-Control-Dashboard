import type { InvestmentTransaction } from '../domain/investment'
import { SAMPLE_INVESTMENT_TRANSACTIONS } from '../domain/sampleData'

export const TRANSACTIONS_STORAGE_KEY = 'investment-dashboard.transactions.v1'
export const ORDER_MAPPINGS_STORAGE_KEY = 'investment-dashboard.order-mappings.v1'
const SAMPLE_SEEDED_KEY = 'investment-dashboard.sample-transactions-seeded.v1'

export class InvestmentRepository {
  constructor(private readonly storage: Storage = localStorage) {}

  replaceTransactions(rows: InvestmentTransaction[]): void {
    this.storage.setItem(TRANSACTIONS_STORAGE_KEY, JSON.stringify(rows))
  }

  listTransactions(): InvestmentTransaction[] {
    const storedRows = this.storage.getItem(TRANSACTIONS_STORAGE_KEY)
    if (storedRows === null) {
      return [...SAMPLE_INVESTMENT_TRANSACTIONS]
    }
    if (storedRows === '[]' && this.storage.getItem(SAMPLE_SEEDED_KEY) !== 'true') {
      this.storage.setItem(SAMPLE_SEEDED_KEY, 'true')
      return [...SAMPLE_INVESTMENT_TRANSACTIONS]
    }
    return JSON.parse(storedRows) as InvestmentTransaction[]
  }

  replaceOrderMappings(mapping: Record<string, string>): void {
    this.storage.setItem(ORDER_MAPPINGS_STORAGE_KEY, JSON.stringify(mapping))
  }
}
