import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import * as XLSX from 'xlsx'

import App from '../../App'
import {
  InvestmentRepository,
  ORDER_MAPPINGS_STORAGE_KEY,
  TRANSACTIONS_STORAGE_KEY,
} from '../../data/investmentRepository'
import { ProjectRepository, PROJECTS_STORAGE_KEY } from '../../data/projectRepository'
import type { Project } from '../../domain/project'

const SESSION_KEY = 'investment-dashboard.authenticated'

const projects: Project[] = [
  {
    id: 'project-a',
    name: '포항 양극재 사업',
    location: '경북 포항',
    material: '양극재',
    status: '기전착공',
    schedule: {
      사업승인: { plan: '2026-01-01', actual: '2026-01-02' },
      토건착공: { plan: null, actual: null },
      기전착공: { plan: null, actual: null },
      '준공(시운전완료)': { plan: null, actual: null },
      SOP: { plan: null, actual: null },
    },
    approvalBudget: 1_000,
    orderIds: ['ORDER-OLD'],
  },
  {
    id: 'project-b',
    name: '광양 음극재 사업',
    location: '전남 광양',
    material: '음극재',
    status: '사업승인',
    schedule: {
      사업승인: { plan: null, actual: null },
      토건착공: { plan: null, actual: null },
      기전착공: { plan: null, actual: null },
      '준공(시운전완료)': { plan: null, actual: null },
      SOP: { plan: null, actual: null },
    },
    approvalBudget: 2_000,
    orderIds: [],
  },
]

function workbookFile(name: string, data: Array<Record<string, unknown>>): File {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(data),
    '투자비',
  )
  const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })

  return { name, arrayBuffer: async () => bytes } as File
}

function actualReportFile(name: string): File {
  const rows: unknown[][] = Array.from({ length: 112 }, () => [])
  rows[3] = [null, '오더/그룹 1006249 인조흑연음극재 신설', '프로젝트 보고서']
  rows[4] = [null, '보고기간 2026-03']
  rows[13] = [null, '무시할 값', 500]
  rows[14][2] = 200
  rows[15][2] = 250
  rows[108][1] = '* H,S'

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), '투자비')
  const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  return { name, arrayBuffer: async () => bytes } as File
}

const firstFile = workbookFile('첫번째.xlsx', [
  { 투자오더번호: 'ORDER-OLD', 기준월: '2026-01', 투자금액: 100 },
  { 투자오더번호: 'ORDER-NEW', 기준월: '2026-02', 투자금액: 200 },
])
const secondFile = workbookFile('두번째.xlsx', [
  { 투자오더번호: 'ORDER-OLD', 기준월: '2026-01', 투자금액: 100 },
  { 투자오더번호: 'ORDER-BAD', 기준월: '2026-03', 투자금액: '오류' },
])
const partialFile = workbookFile('부분.xlsx', [
  { 투자오더번호: 'ORDER-OLD', 기준월: '2026-04', 투자금액: 75 },
])
const invalidFile = workbookFile('무효.xlsx', [
  { 투자오더번호: 'ORDER-BAD', 기준월: '2026-04', 투자금액: '오류' },
])

function renderImportPage() {
  render(
    <MemoryRouter initialEntries={['/import']}>
      <App />
    </MemoryRouter>,
  )
}

async function selectFiles(files: File[]) {
  fireEvent.change(screen.getByLabelText('엑셀 파일'), {
    target: { files },
  })
  await screen.findByRole('heading', { name: '가져오기 미리보기' })
}

async function selectImportFiles() {
  await selectFiles([firstFile, secondFile])
}

describe('투자비 가져오기', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.setItem(SESSION_KEY, 'true')
    localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects))
    localStorage.setItem(
      TRANSACTIONS_STORAGE_KEY,
      JSON.stringify([
        {
          sourceId: '기존.xlsx',
          rowId: '기존.xlsx:2',
          orderId: 'ORDER-OLD',
          month: '2025-12',
          amount: 50,
        },
      ]),
    )
  })

  it('두 파일을 저장소 변경 없이 미리 보고 오류·중복·미연결 오더를 표시한다', async () => {
    renderImportPage()
    await selectImportFiles()

    expect(screen.getByText('첫번째.xlsx, 두번째.xlsx')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '유효 행' })).toHaveTextContent(
      'ORDER-NEW',
    )
    expect(screen.getByRole('region', { name: '검증 오류' })).toHaveTextContent(
      '투자금액이 숫자가 아닙니다',
    )
    expect(screen.getByRole('region', { name: '중복 행' })).toHaveTextContent(
      '두번째.xlsx:2',
    )
    expect(screen.getByRole('region', { name: '미연결 오더' })).toHaveTextContent(
      'ORDER-NEW',
    )
    expect(new InvestmentRepository(localStorage).listTransactions()).toEqual([
      {
        sourceId: '기존.xlsx',
        rowId: '기존.xlsx:2',
        orderId: 'ORDER-OLD',
        month: '2025-12',
        amount: 50,
      },
    ])
    expect(localStorage.getItem(ORDER_MAPPINGS_STORAGE_KEY)).toBeNull()
  })

  it('모든 오더를 연결한 뒤 확인하면 유효 행과 연결만 저장하고 사업 정보는 보존한다', async () => {
    renderImportPage()
    await selectImportFiles()

    const mappingRegion = screen.getByRole('region', { name: '미연결 오더' })
    fireEvent.change(
      within(mappingRegion).getByRole('combobox', {
        name: 'ORDER-NEW 연결 사업',
      }),
      { target: { value: 'project-b' } },
    )
    fireEvent.click(screen.getByRole('button', { name: '가져오기 확정' }))

    await waitFor(() => {
      expect(screen.getByText('투자비 가져오기가 완료되었습니다.')).toBeInTheDocument()
    })
    expect(new InvestmentRepository(localStorage).listTransactions()).toEqual([
      {
        sourceId: '기존.xlsx',
        rowId: '기존.xlsx:2',
        orderId: 'ORDER-OLD',
        month: '2025-12',
        amount: 50,
      },
      {
        sourceId: '첫번째.xlsx',
        rowId: '첫번째.xlsx:2',
        orderId: 'ORDER-OLD',
        month: '2026-01',
        amount: 100,
      },
      {
        sourceId: '첫번째.xlsx',
        rowId: '첫번째.xlsx:3',
        orderId: 'ORDER-NEW',
        month: '2026-02',
        amount: 200,
      },
    ])
    expect(JSON.parse(localStorage.getItem(ORDER_MAPPINGS_STORAGE_KEY) ?? '{}')).toEqual({
      'ORDER-OLD': 'project-a',
      'ORDER-NEW': 'project-b',
    })

    const reloadedProjects = new ProjectRepository(localStorage).list()
    expect(reloadedProjects[0]).toEqual(projects[0])
    expect(reloadedProjects[1]).toEqual({
      ...projects[1],
      orderIds: ['ORDER-NEW'],
    })
  })

  it('실제 보고서 합계 불일치 경고를 미리보기에서 확인할 수 있다', async () => {
    renderImportPage()
    await selectFiles([actualReportFile('실제보고서.xlsx')])

    const warningRegion = screen.getByRole('region', { name: '검증 경고' })
    expect(warningRegion).toHaveTextContent('C14: 500')
    expect(warningRegion).toHaveTextContent('C15:C108: 450')
    expect(warningRegion).toHaveTextContent('차이: 50')
  })

  it('미리보기를 취소하면 어떤 저장소도 변경하지 않는다', async () => {
    renderImportPage()
    await selectImportFiles()

    fireEvent.click(screen.getByRole('button', { name: '취소' }))

    expect(screen.queryByRole('heading', { name: '가져오기 미리보기' })).not.toBeInTheDocument()
    expect(new InvestmentRepository(localStorage).listTransactions()).toHaveLength(1)
    expect(localStorage.getItem(ORDER_MAPPINGS_STORAGE_KEY)).toBeNull()
    expect(new ProjectRepository(localStorage).list()).toEqual(projects)
  })

  it('부분 가져오기는 기존 거래와 새 유효 거래를 함께 보존한다', async () => {
    localStorage.setItem(
      ORDER_MAPPINGS_STORAGE_KEY,
      JSON.stringify({ 'ORDER-LEGACY': 'project-b' }),
    )
    renderImportPage()
    await selectFiles([partialFile])

    fireEvent.click(screen.getByRole('button', { name: '가져오기 확정' }))

    await waitFor(() => {
      expect(screen.getByText('투자비 가져오기가 완료되었습니다.')).toBeInTheDocument()
    })
    expect(new InvestmentRepository(localStorage).listTransactions()).toEqual([
      {
        sourceId: '기존.xlsx',
        rowId: '기존.xlsx:2',
        orderId: 'ORDER-OLD',
        month: '2025-12',
        amount: 50,
      },
      {
        sourceId: '부분.xlsx',
        rowId: '부분.xlsx:2',
        orderId: 'ORDER-OLD',
        month: '2026-04',
        amount: 75,
      },
    ])
    expect(JSON.parse(localStorage.getItem(ORDER_MAPPINGS_STORAGE_KEY) ?? '{}')).toEqual({
      'ORDER-LEGACY': 'project-b',
      'ORDER-OLD': 'project-a',
    })
  })

  it('유효하게 연결된 행이 없으면 저장하지 않고 미리보기를 유지한다', async () => {
    renderImportPage()
    await selectFiles([invalidFile])

    fireEvent.click(screen.getByRole('button', { name: '가져오기 확정' }))

    expect(screen.getByRole('heading', { name: '가져오기 미리보기' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(
      '유효하게 연결된 행이 하나 이상 필요합니다.',
    )
    expect(screen.queryByText('투자비 가져오기가 완료되었습니다.')).not.toBeInTheDocument()
    expect(new InvestmentRepository(localStorage).listTransactions()).toHaveLength(1)
    expect(localStorage.getItem(ORDER_MAPPINGS_STORAGE_KEY)).toBeNull()
  })

  it('같은 sourceId와 rowId의 새 행은 기존 거래와 중복 저장하지 않는다', async () => {
    localStorage.setItem(
      TRANSACTIONS_STORAGE_KEY,
      JSON.stringify([
        {
          sourceId: '부분.xlsx',
          rowId: '부분.xlsx:2',
          orderId: 'ORDER-OLD',
          month: '2026-04',
          amount: 75,
        },
      ]),
    )
    renderImportPage()
    await selectFiles([partialFile])

    fireEvent.click(screen.getByRole('button', { name: '가져오기 확정' }))

    await waitFor(() => {
      expect(screen.getByText('투자비 가져오기가 완료되었습니다.')).toBeInTheDocument()
    })
    expect(new InvestmentRepository(localStorage).listTransactions()).toEqual([
      {
        sourceId: '부분.xlsx',
        rowId: '부분.xlsx:2',
        orderId: 'ORDER-OLD',
        month: '2026-04',
        amount: 75,
      },
    ])
  })
})
