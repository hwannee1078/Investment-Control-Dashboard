import { useState } from 'react'

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
