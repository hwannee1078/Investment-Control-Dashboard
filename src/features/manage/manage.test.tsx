import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import App from '../../App'
import { ProjectRepository, PROJECTS_STORAGE_KEY } from '../../data/projectRepository'
import type { Project } from '../../domain/project'

const SESSION_KEY = 'investment-dashboard.authenticated'

const project: Project = {
  id: 'manage-project',
  name: '포항 테스트 사업',
  location: '경북 포항',
  material: '양극재',
  status: '토건착공',
  schedule: {
    사업승인: { plan: '2026-01-10', actual: '2026-01-12' },
    토건착공: { plan: '2026-02-10', actual: '2026-02-11' },
    기전착공: { plan: null, actual: null },
    '준공(시운전완료)': { plan: null, actual: null },
    SOP: { plan: null, actual: null },
  },
  approvalBudget: 1_000,
  orderIds: ['ORDER-KEEP'],
}

function renderManagePage() {
  render(
    <MemoryRouter initialEntries={['/manage']}>
      <App />
    </MemoryRouter>,
  )
}

describe('사업 관리', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.setItem(SESSION_KEY, 'true')
    localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify([project]))
  })

  it('기본 필드와 다섯 단계의 계획일·실적일을 저장소에 보존한다', () => {
    renderManagePage()

    expect(screen.getByText('포항 테스트 사업')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: '포항 테스트 사업 수정' }))
    fireEvent.change(screen.getByRole('textbox', { name: '사업명' }), {
      target: { value: '광양 수정 사업' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: '소재지' }), {
      target: { value: '전남 광양' },
    })
    fireEvent.change(screen.getByRole('combobox', { name: '양극재/음극재' }), {
      target: { value: '음극재' },
    })
    fireEvent.change(screen.getByLabelText('기전착공 계획일'), {
      target: { value: '2026-03-10' },
    })
    fireEvent.change(screen.getByLabelText('기전착공 실적일'), {
      target: { value: '2026-03-12' },
    })
    fireEvent.change(screen.getByLabelText('SOP 계획일'), {
      target: { value: '2026-10-01' },
    })
    fireEvent.change(screen.getByLabelText('SOP 실적일'), {
      target: { value: '2026-10-03' },
    })
    fireEvent.click(screen.getByRole('button', { name: '저장' }))

    const saved = new ProjectRepository(localStorage).get(project.id)
    expect(saved).toEqual({
      ...project,
      name: '광양 수정 사업',
      location: '전남 광양',
      material: '음극재',
      schedule: {
        ...project.schedule,
        기전착공: { plan: '2026-03-10', actual: '2026-03-12' },
        SOP: { plan: '2026-10-01', actual: '2026-10-03' },
      },
    })
  })

  it('공백 사업명은 인라인 오류로 거부하고 취소하면 저장하지 않는다', () => {
    renderManagePage()

    fireEvent.click(screen.getByRole('link', { name: '포항 테스트 사업 수정' }))
    fireEvent.change(screen.getByRole('textbox', { name: '사업명' }), {
      target: { value: '   ' },
    })
    fireEvent.click(screen.getByRole('button', { name: '저장' }))

    expect(screen.getByText('사업명을 입력해 주세요.')).toBeInTheDocument()
    expect(new ProjectRepository(localStorage).get(project.id)?.name).toBe(
      '포항 테스트 사업',
    )

    fireEvent.change(screen.getByRole('textbox', { name: '사업명' }), {
      target: { value: '저장하면 안 되는 이름' },
    })
    fireEvent.click(screen.getByRole('button', { name: '취소' }))

    expect(screen.queryByRole('form', { name: '사업 수정' })).not.toBeInTheDocument()
    expect(new ProjectRepository(localStorage).get(project.id)?.name).toBe(
      '포항 테스트 사업',
    )
  })

  it('마지막 실적일로 자동 단계를 계산하고 수동 상태가 다르면 경고한다', () => {
    renderManagePage()

    fireEvent.click(screen.getByRole('link', { name: '포항 테스트 사업 수정' }))
    expect(screen.getByText('자동 단계: 토건착공')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    fireEvent.change(screen.getByRole('combobox', { name: '사업상태' }), {
      target: { value: '기전착공' },
    })

    expect(screen.getByRole('alert')).toHaveTextContent(
      '수동 사업상태와 자동 단계가 일치하지 않습니다.',
    )
    fireEvent.click(screen.getByRole('button', { name: '저장' }))
    expect(new ProjectRepository(localStorage).get(project.id)?.status).toBe(
      '기전착공',
    )
  })

  it('실적일이 모두 비어 있으면 수동 상태와 실적 없음의 불일치를 경고한다', () => {
    const projectWithoutActuals: Project = {
      ...project,
      schedule: {
        사업승인: { plan: '2026-01-10', actual: null },
        토건착공: { plan: '2026-02-10', actual: null },
        기전착공: { plan: null, actual: null },
        '준공(시운전완료)': { plan: null, actual: null },
        SOP: { plan: null, actual: null },
      },
    }
    localStorage.setItem(
      PROJECTS_STORAGE_KEY,
      JSON.stringify([projectWithoutActuals]),
    )
    renderManagePage()

    fireEvent.click(screen.getByRole('link', { name: '포항 테스트 사업 수정' }))

    expect(screen.getByText('자동 단계: 실적 없음')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(
      '수동 사업상태와 자동 단계가 일치하지 않습니다.',
    )
  })
})
