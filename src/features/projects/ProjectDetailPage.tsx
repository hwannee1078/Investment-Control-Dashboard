import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { InvestmentRepository } from '../../data/investmentRepository'
import { ProjectRepository } from '../../data/projectRepository'
import type { InvestmentSummary as InvestmentSummaryValue } from '../../domain/investment'
import { aggregateInvestment } from '../../services/investmentAggregation'
import ScheduleMatrix from './ScheduleMatrix'

const currency = new Intl.NumberFormat('ko-KR')
const EMPTY_SUMMARY: InvestmentSummaryValue = { monthly: {}, cumulative: {}, cumulativeTotal: 0, executionRate: null }
const monthsForQuarter = (year: number, quarter: number) => [0, 1, 2].map((offset) => `${year}-${String((quarter - 1) * 3 + offset + 1).padStart(2, '0')}`)

export default function ProjectDetailPage() {
  const { projectId = '' } = useParams()
  const [selectedQuarter, setSelectedQuarter] = useState<string | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
  const detail = useMemo(() => {
    const project = new ProjectRepository().list().filter((item) => item.active !== false).find(({ id }) => id === projectId)
    if (!project) return null
    const orderToProject = Object.fromEntries(project.orderIds.map((orderId) => [orderId, project.id]))
    const summary = aggregateInvestment(new InvestmentRepository().listTransactions(), orderToProject, [project]).get(project.id)
    return { project, summary: summary ?? EMPTY_SUMMARY }
  }, [projectId])
  if (!detail) return <main className="page-shell empty-page"><h1>사업을 찾을 수 없습니다.</h1><Link to="/dashboard">대시보드로 돌아가기</Link></main>

  const { project, summary } = detail
  const months = [...new Set([...Object.keys(summary.monthly), ...Object.keys(project.rollingPlan ?? {})])].sort()
  const years = [...new Set(months.map((month) => Number(month.slice(0, 4))))].sort()
  const currentYear = new Date().getFullYear()
  const selected = selectedQuarter?.split('-Q').map(Number)
  const selectedMonths = selected ? monthsForQuarter(selected[0], selected[1]) : []
  const value = (month: string, actual = false) => actual ? summary.monthly[month] ?? 0 : project.rollingPlan?.[month]?.amount ?? 0
  const sum = (items: string[], actual = false) => items.reduce((total, month) => total + value(month, actual), 0)
  const monthDetail = (quarterKey: string) => {
    const quarter = quarterKey.split('-Q').map(Number)
    if (quarter[0] !== currentYear) return null
    return <div className="rolling-month-detail" aria-label={`${quarterKey} 월별 상세`}><h3>{quarterKey} 월별 상세</h3><div className="rolling-chart" role="group" aria-label="월별 계획·실적 투자비 비교">
      {monthsForQuarter(quarter[0], quarter[1]).map((month) => { const plan = value(month); const actual = value(month, true); const max = Math.max(1, ...selectedMonths.map((item) => Math.max(Math.abs(value(item)), Math.abs(value(item, true))))); return <button key={month} type="button" className="rolling-bar-group" onClick={() => setSelectedMonth(month)}><span className="rolling-month">{month}</span><span className="rolling-bars"><i className="rolling-bar rolling-bar--plan" style={{ height: `${Math.max(2, Math.abs(plan) / max * 100)}%` }} /><i className="rolling-bar rolling-bar--actual" style={{ height: `${Math.max(2, Math.abs(actual) / max * 100)}%` }} /></span><small>계획 {Math.round(plan / 100000000)} / 실적 {Math.round(actual / 100000000)}억원</small></button> })}
    </div></div>
  }

  return <main className="page-shell">
    <Link className="back-link" to="/dashboard">← 대시보드</Link>
    <header className="project-heading"><div><p className="eyebrow">Project Detail</p><h1>{project.name}</h1></div><span className="status-badge">{project.status}</span></header>
    <section className="detail-panel" aria-labelledby="basic-info-title"><h2 id="basic-info-title">사업 기본 정보</h2><dl className="project-facts"><div><dt>소재</dt><dd>{project.material}</dd></div><div><dt>지역</dt><dd>{project.location}</dd></div><div><dt>현재 단계</dt><dd>{project.status}</dd></div><div className="project-facts__investment"><dt>승인투자비</dt><dd>{project.approvalBudget === null ? '-' : `${currency.format(project.approvalBudget)}원`}</dd><small>누적투자비 {currency.format(summary.cumulativeTotal)}원 · 집행률 {summary.executionRate === null ? '-' : `${summary.executionRate.toFixed(1)}%`}</small></div></dl></section>
    <section className="detail-panel" aria-labelledby="schedule-title"><h2 id="schedule-title">주요 일정</h2><ScheduleMatrix project={project} editable={false} /></section>
    <section className="detail-panel rolling-chart-panel" aria-labelledby="rolling-chart-title"><h2 id="rolling-chart-title">분기별 Rolling Plan 비교</h2>
      {years.length === 0 ? <p className="empty-state">등록된 Rolling Plan 또는 실적이 없습니다.</p> : years.map((year) => <section key={year} className="rolling-year" aria-label={`${year}년 Rolling Plan`}><h3>{year}년</h3><div className="rolling-chart" role="group" aria-label={`${year}년 분기별 계획·실적 투자비 비교`}>
        {[1, 2, 3, 4].map((quarter) => { const quarterMonths = monthsForQuarter(year, quarter); const plan = sum(quarterMonths); const actual = sum(quarterMonths, true); const max = Math.max(1, ...[1, 2, 3, 4].map((q) => Math.max(Math.abs(sum(monthsForQuarter(year, q))), Math.abs(sum(monthsForQuarter(year, q), true))))); const key = `${year}-Q${quarter}`; return <button key={key} type="button" className="rolling-bar-group" aria-label={`${year}년 ${quarter}분기`} onClick={() => { setSelectedQuarter(key); setSelectedMonth(null) }}><span className="rolling-month">{quarter}분기</span><span className="rolling-bars"><i className="rolling-bar rolling-bar--plan" style={{ height: `${Math.max(2, Math.abs(plan) / max * 100)}%` }} /><i className="rolling-bar rolling-bar--actual" style={{ height: `${Math.max(2, Math.abs(actual) / max * 100)}%` }} /></span><small>계획 {Math.round(plan / 100000000)} / 실적 {Math.round(actual / 100000000)}억원</small></button> })}
      </div>{selectedQuarter?.startsWith(`${year}-`) ? monthDetail(selectedQuarter) : null}</section>)}
      {selectedMonth ? <p className="rolling-reason"><strong>{selectedMonth} 차이 사유:</strong> {project.rollingPlan?.[selectedMonth]?.reason ?? '입력된 사유가 없습니다.'}</p> : null}
    </section>
  </main>
}
