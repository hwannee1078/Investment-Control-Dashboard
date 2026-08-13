export type InvestmentTransaction = {
  sourceId: string
  rowId: string
  orderId: string
  month: string
  amount: number
  reconciliationDetailTotal?: number
}

export type InvestmentSummary = {
  monthly: Record<string, number>
  cumulative: Record<string, number>
  cumulativeTotal: number
  executionRate: number | null
}
