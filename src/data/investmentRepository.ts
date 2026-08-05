import type { InvestmentTransaction } from '../domain/investment'

export const TRANSACTIONS_STORAGE_KEY = 'investment-dashboard.transactions.v1'
export const ORDER_MAPPINGS_STORAGE_KEY = 'investment-dashboard.order-mappings.v1'

export class InvestmentRepository {
  constructor(private readonly storage: Storage = localStorage) {}

  replaceTransactions(rows: InvestmentTransaction[]): void {
    this.storage.setItem(TRANSACTIONS_STORAGE_KEY, JSON.stringify(rows))
  }

  listTransactions(): InvestmentTransaction[] {
    const storedRows = this.storage.getItem(TRANSACTIONS_STORAGE_KEY)
    return storedRows === null ? [] : (JSON.parse(storedRows) as InvestmentTransaction[])
  }

  replaceOrderMappings(mapping: Record<string, string>): void {
    this.storage.setItem(ORDER_MAPPINGS_STORAGE_KEY, JSON.stringify(mapping))
  }
}
