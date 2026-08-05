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

const firstFile = workbookFile('첫번째.xlsx', [
  { 투자오더번호: 'ORDER-OLD', 기준월: '2026-01', 투자금액: 100 },
  { 투자오더번호: 'ORDER-NEW', 기준월: '2026-02', 투자금액: 200 },
])
const secondFile = workbookFile('두번째.xlsx', [
  { 투자오더번호: 'ORDER-OLD', 기준월: '2026-01', 투자금액: 100 },
  { 투자오더번호: 'ORDER-BAD', 기준월: '2026-03', 투자금액: '오류' },
])

function renderImportPage() {
  render(
    <MemoryRouter initialEntries={['/import']}>
      <App />
    </MemoryRouter>,
  )
}

async function selectImportFiles() {
  fireEvent.change(screen.getByLabelText('엑셀 파일'), {
    target: { files: [firstFile, secondFile] },
  })
  await screen.findByRole('heading', { name: '가져오기 미리보기' })
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

  it('미리보기를 취소하면 어떤 저장소도 변경하지 않는다', async () => {
    renderImportPage()
    await selectImportFiles()

    fireEvent.click(screen.getByRole('button', { name: '취소' }))

    expect(screen.queryByRole('heading', { name: '가져오기 미리보기' })).not.toBeInTheDocument()
    expect(new InvestmentRepository(localStorage).listTransactions()).toHaveLength(1)
    expect(localStorage.getItem(ORDER_MAPPINGS_STORAGE_KEY)).toBeNull()
    expect(new ProjectRepository(localStorage).list()).toEqual(projects)
  })
})
