import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import App from '../../App'
import { PROJECTS_STORAGE_KEY } from '../../data/projectRepository'
import { TRANSACTIONS_STORAGE_KEY } from '../../data/investmentRepository'
import type { Project } from '../../domain/project'

const SESSION_KEY = 'investment-dashboard.authenticated'

const project: Project = {
  id: 'detail-project',
  name: '포항 양극재 상세 사업',
  location: '경북 포항',
  material: '양극재',
  status: '기전착공',
  schedule: {
    사업승인: { plan: '2026-01-10', actual: '2026-01-12' },
    토건착공: { plan: '2026-02-10', actual: '2026-02-11' },
    기전착공: { plan: '2026-03-10', actual: null },
    '준공(시운전완료)': { plan: '2026-09-30', actual: null },
    SOP: { plan: '2026-10-15', actual: null },
  },
  approvalBudget: 1_000,
  orderIds: ['ORDER-1'],
}

describe('project detail', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.setItem(SESSION_KEY, 'true')
    localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify([project]))
    localStorage.setItem(
      TRANSACTIONS_STORAGE_KEY,
      JSON.stringify([
        {
          sourceId: 'investment.xlsx',
          rowId: '2',
          orderId: 'ORDER-1',
          month: '2026-01',
          amount: 100,
        },
        {
          sourceId: 'investment.xlsx',
          rowId: '3',
          orderId: 'ORDER-1',
          month: '2026-02',
          amount: 200,
        },
      ]),
    )
  })

  it('transposes the five stages into columns and keeps exactly two date rows', () => {
    render(
      <MemoryRouter initialEntries={['/projects/detail-project']}>
        <App />
      </MemoryRouter>,
    )

    const matrix = screen.getByRole('table', { name: '사업 일정' })
    expect(
      within(matrix)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual([
      '구분',
      '사업승인',
      '토건착공',
      '기전착공',
      '준공(시운전완료)',
      'SOP',
    ])
    expect(
      within(matrix)
        .getAllByRole('rowheader')
        .map((cell) => cell.textContent),
    ).toEqual(['계획일', '실적일'])
    expect(within(matrix).queryByText('상태')).not.toBeInTheDocument()
    expect(within(matrix).getByText('2026-09-30')).toBeInTheDocument()
  })

  it('shows basic project fields, investment summary, and expandable monthly values', () => {
    render(
      <MemoryRouter initialEntries={['/projects/detail-project']}>
        <App />
      </MemoryRouter>,
    )

    expect(
      screen.getByRole('heading', { name: '포항 양극재 상세 사업' }),
    ).toBeInTheDocument()
    const basicInfo = screen.getByRole('region', { name: '사업 기본 정보' })
    expect(within(basicInfo).getByText('경북 포항')).toBeInTheDocument()
    expect(within(basicInfo).getByText('양극재')).toBeInTheDocument()
    expect(within(basicInfo).getByText('기전착공')).toBeInTheDocument()
    expect(screen.getAllByText('1,000원').length).toBeGreaterThan(0)
    expect(screen.getByText('300원')).toBeInTheDocument()
    expect(screen.getByText('30.0%')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '월별 계획·실적 투자비 비교 그래프' })).toBeInTheDocument()

    const monthlyToggle = screen.getByRole('button', { name: '월별 투자비 펼치기' })
    fireEvent.click(monthlyToggle)

    expect(screen.getByRole('button', { name: '월별 투자비 접기' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    const januaryRow = screen.getByRole('row', { name: '2026-01 100원 100원' })
    expect(within(januaryRow).getAllByText('100원')).toHaveLength(2)
    expect(
      screen.getByRole('row', { name: '2026-02 200원 300원' }),
    ).toBeInTheDocument()
  })
})
