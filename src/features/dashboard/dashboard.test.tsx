import { fireEvent, render, screen } from '@testing-library/react'
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

  it('shows the three investment metrics and only two material segments initially', () => {
    renderApp('/dashboard')

    expect(screen.getByText('승인투자비')).toBeInTheDocument()
    expect(screen.getByText('누적투자비')).toBeInTheDocument()
    expect(screen.getByText('집행률(%)')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '양극재(2건)' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '음극재(2건)' }),
    ).toBeInTheDocument()
    expect(screen.queryByText('포항 양극재 1단계 증설')).not.toBeInTheDocument()
    expect(screen.queryByText('세종 음극재 생산라인 증설')).not.toBeInTheDocument()
  })

  it('reveals the hovered material projects and navigates on project click', () => {
    renderApp('/dashboard')

    fireEvent.mouseEnter(screen.getByRole('button', { name: '음극재(2건)' }))

    expect(screen.getByText('포항 천연흑연 음극재 2공장')).toBeInTheDocument()
    expect(screen.getByText('세종 음극재 생산라인 증설')).toBeInTheDocument()
    expect(screen.queryByText('광양 양극재 5단계 신설')).not.toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: '포항 천연흑연 음극재 2공장 상세 보기' }),
    )

    expect(
      screen.getByRole('heading', { name: '포항 천연흑연 음극재 2공장' }),
    ).toBeInTheDocument()
  })
})
