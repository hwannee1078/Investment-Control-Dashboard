import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import App from '../../App'

const SESSION_KEY = 'investment-dashboard.authenticated'

function renderApp(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

describe('login and protected routes', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('rejects blank credentials inline', () => {
    renderApp('/login')

    fireEvent.click(screen.getByRole('button', { name: '로그인' }))

    expect(screen.getByText('아이디를 입력해 주세요.')).toBeInTheDocument()
    expect(screen.getByText('비밀번호를 입력해 주세요.')).toBeInTheDocument()
  })

  it('accepts non-empty credentials and stores the session', () => {
    renderApp('/login')

    fireEvent.change(screen.getByLabelText('아이디'), {
      target: { value: 'executive' },
    })
    fireEvent.change(screen.getByLabelText('비밀번호'), {
      target: { value: 'dashboard' },
    })
    fireEvent.click(screen.getByRole('button', { name: '로그인' }))

    expect(sessionStorage.getItem(SESSION_KEY)).toBe('true')
    expect(
      screen.getByRole('heading', { name: '투자비 대시보드' }),
    ).toBeInTheDocument()
  })

  it.each(['/dashboard', '/projects/project-pohang-cathode-1', '/manage', '/import'])(
    'redirects unauthenticated access to %s back to login',
    (path) => {
      renderApp(path)

      expect(screen.getByLabelText('아이디')).toBeInTheDocument()
      expect(screen.getByLabelText('비밀번호')).toBeInTheDocument()
    },
  )
})

describe('executive dashboard', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.setItem(SESSION_KEY, 'true')
  })

  it('shows material segments and the business schedule list without metric cards', () => {
    renderApp('/dashboard')

    expect(screen.getByRole('heading', { name: '사업목록' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: '사업명' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /투자비 현황/ })).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: '소재지' })).not.toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: '사업일정' })).not.toBeInTheDocument()
    expect(screen.getAllByText('승인투자비').length).toBeGreaterThan(0)
    expect(screen.getAllByText('누적투자비').length).toBeGreaterThan(0)
    expect(screen.getAllByText('잔여투자비').length).toBeGreaterThan(0)
    expect(screen.getAllByText('누적률').length).toBeGreaterThan(0)
    expect(screen.queryByRole('columnheader', { name: '소재' })).not.toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: '사업상태' })).not.toBeInTheDocument()
    expect(screen.getAllByText('사업승인').length).toBeGreaterThan(0)
    expect(screen.getAllByText('토건착공').length).toBeGreaterThan(0)
    expect(screen.getAllByText('기전착공').length).toBeGreaterThan(0)
    expect(screen.getAllByText('준공(시운전완료)').length).toBeGreaterThan(0)
    expect(screen.getAllByText('SOP').length).toBeGreaterThan(0)
    expect(screen.queryAllByRole('textbox')).toHaveLength(0)
    expect(
      screen.getByRole('button', { name: '양극재(2건)' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '음극재(2건)' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: '양극재 사업 목록' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: '음극재 사업 목록' })).not.toBeInTheDocument()
  })

  it('reveals the hovered material projects and navigates on project click', () => {
    renderApp('/dashboard')

    fireEvent.mouseEnter(screen.getByRole('button', { name: '음극재(2건)' }))

    const hoverList = screen.getByRole('region', { name: '음극재 사업 목록' })
    expect(within(hoverList).getByText('포항 천연흑연 음극재 2공장')).toBeInTheDocument()
    expect(within(hoverList).getByText('세종 음극재 생산라인 증설')).toBeInTheDocument()
    expect(within(hoverList).queryByText('광양 양극재 5단계 신설')).not.toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: '포항 천연흑연 음극재 2공장 상세 보기' }),
    )

    expect(
      screen.getByRole('heading', { name: '포항 천연흑연 음극재 2공장' }),
    ).toBeInTheDocument()
  })

  it('shows the linked sample investment data in sample mode', () => {
    renderApp('/dashboard?sample=1')

    expect(screen.getAllByText('누적투자비').length).toBeGreaterThan(0)
    expect(screen.getAllByText('11941.3').length).toBeGreaterThan(0)
    expect(screen.getAllByText('-84.7').length).toBeGreaterThan(0)
  })
})
