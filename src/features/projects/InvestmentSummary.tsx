import { useState } from 'react'

import MetricCard from '../../components/MetricCard'
import type { InvestmentSummary as InvestmentSummaryValue } from '../../domain/investment'

const currency = new Intl.NumberFormat('ko-KR')

export default function InvestmentSummary({
  summary,
}: {
  summary: InvestmentSummaryValue
}) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <section aria-labelledby="investment-summary-title">
      <h2 id="investment-summary-title">투자비 요약</h2>
      <div className="summary-card-grid">
        <MetricCard
          label="누적투자비"
          value={`${currency.format(summary.cumulativeTotal)}원`}
          tone="blue"
        />
        <MetricCard
          label="집행률(%)"
          value={summary.executionRate === null ? '-' : `${summary.executionRate.toFixed(1)}%`}
          tone="mint"
        />
      </div>

      <div className="monthly-investment">
        <button
          className="text-button"
          type="button"
          aria-expanded={isExpanded}
          onClick={() => setIsExpanded((current) => !current)}
        >
          월별 투자비 {isExpanded ? '접기' : '펼치기'}
        </button>
        {isExpanded && (
          Object.keys(summary.monthly).length > 0 ? (
            <div className="table-scroll">
              <table aria-label="월별 투자비">
                <thead>
                  <tr>
                    <th scope="col">월</th>
                    <th scope="col">월 투자비</th>
                    <th scope="col">누적투자비</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(summary.monthly).map(([month, amount]) => (
                    <tr key={month}>
                      <th scope="row">{month}</th>
                      <td>{currency.format(amount)}원</td>
                      <td>{currency.format(summary.cumulative[month])}원</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty-state">등록된 월별 투자비가 없습니다.</p>
          )
        )}
      </div>
    </section>
  )
}
