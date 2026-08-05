import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import * as XLSX from 'xlsx'

import App from './App'
import { TRANSACTIONS_STORAGE_KEY } from './data/investmentRepository'

function workbookFile(
  name: string,
  rows: Array<Record<string, unknown>>,
): File {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(rows),
    '투자비',
  )
  const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })

  return { name, arrayBuffer: async () => bytes } as File
}

describe('투자비 대시보드 통합 사용자 흐름', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem(TRANSACTIONS_STORAGE_KEY, '[]')
    localStorage.setItem('investment-dashboard.sample-transactions-seeded.v1', 'true')
    sessionStorage.clear()
  })

  it('로그인부터 사업 수정, 두 파일 가져오기, 월별·누적 투자비 확인까지 연결한다', async () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <App />
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByLabelText('아이디'), {
      target: { value: 'investment-manager' },
    })
    fireEvent.change(screen.getByLabelText('비밀번호'), {
      target: { value: 'dashboard' },
    })
    fireEvent.click(screen.getByRole('button', { name: '로그인' }))

    expect(screen.getByRole('button', { name: '양극재(2건)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '음극재(2건)' })).toBeInTheDocument()

    fireEvent.mouseEnter(screen.getByRole('button', { name: '양극재(2건)' }))
    fireEvent.click(
      screen.getByRole('button', { name: '포항 양극재 1단계 증설 상세 보기' }),
    )

    const schedule = screen.getByRole('table', { name: '사업 일정' })
    expect(
      within(schedule)
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
    expect(within(schedule).getAllByRole('rowheader')).toHaveLength(2)

    fireEvent.click(screen.getByRole('link', { name: '사업 관리' }))
    fireEvent.click(
      screen.getByRole('link', { name: '포항 양극재 1단계 증설 수정' }),
    )
    fireEvent.change(screen.getByRole('textbox', { name: '사업명' }), {
      target: { value: '포항 양극재 통합 사업' },
    })
    fireEvent.change(screen.getByLabelText('SOP 계획일'), {
      target: { value: '2026-10-01' },
    })
    fireEvent.change(screen.getByLabelText('SOP 실적일'), {
      target: { value: '2026-10-03' },
    })
    fireEvent.click(screen.getByRole('button', { name: '저장' }))

    expect(screen.getByText('포항 양극재 통합 사업')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('link', { name: '투자비 가져오기' }))
    const firstWorkbook = workbookFile('1월_투자비.xlsx', [
      { 투자오더번호: 'ORDER-FLOW', 기준월: '2026-01', 투자금액: 100 },
      { 투자오더번호: 'ORDER-FLOW', 기준월: '2026-02', 투자금액: 250 },
    ])
    const secondWorkbook = workbookFile('검증_투자비.xlsx', [
      { 투자오더번호: 'ORDER-FLOW', 기준월: '2026-01', 투자금액: 100 },
      { 투자오더번호: 'ORDER-BAD', 기준월: '2026-03', 투자금액: '오류' },
    ])

    fireEvent.change(screen.getByLabelText('엑셀 파일'), {
      target: { files: [firstWorkbook, secondWorkbook] },
    })

    expect(
      await screen.findByRole('heading', { name: '가져오기 미리보기' }),
    ).toBeInTheDocument()
    expect(screen.getByText('1월_투자비.xlsx, 검증_투자비.xlsx')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '중복 행' })).toHaveTextContent(
      '검증_투자비.xlsx:2',
    )
    expect(screen.getByRole('region', { name: '검증 오류' })).toHaveTextContent(
      '투자금액이 숫자가 아닙니다',
    )

    const mapping = screen.getByRole('region', { name: '미연결 오더' })
    expect(mapping).toHaveTextContent('ORDER-FLOW')
    fireEvent.change(
      within(mapping).getByRole('combobox', {
        name: 'ORDER-FLOW 연결 사업',
      }),
      { target: { value: 'project-pohang-cathode-1' } },
    )
    fireEvent.click(screen.getByRole('button', { name: '가져오기 확정' }))

    expect(
      screen.getByText('투자비 가져오기가 완료되었습니다.'),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('link', { name: '대시보드' }))
    expect(screen.getByRole('heading', { name: '사업목록' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '포항 양극재 통합 사업' })).toBeInTheDocument()
    fireEvent.mouseEnter(screen.getByRole('button', { name: '양극재(2건)' }))
    fireEvent.click(
      screen.getByRole('button', { name: '포항 양극재 통합 사업 상세 보기' }),
    )

    expect(screen.getByText('2026-10-01')).toBeInTheDocument()
    expect(screen.getByText('2026-10-03')).toBeInTheDocument()
    expect(screen.getByText('350원')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '월별 투자비 펼치기' }))

    expect(
      screen.getByRole('row', { name: '2026-01 100원 100원' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('row', { name: '2026-02 250원 350원' }),
    ).toBeInTheDocument()
  })
})
