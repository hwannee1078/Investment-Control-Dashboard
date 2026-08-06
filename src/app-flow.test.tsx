import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from './App'

describe('app flow', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear() })
  it('logs in with employee id and shows dashboard', () => {
    render(<MemoryRouter initialEntries={['/login']}><App /></MemoryRouter>)
    fireEvent.change(screen.getByLabelText('아이디'), { target: { value: 'viewer-001' } })
    fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'password' } })
    fireEvent.click(screen.getByRole('button', { name: '로그인' }))
    expect(screen.getByRole('heading', { name: '투자비 대시보드' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '사업 관리' })).not.toBeInTheDocument()
  })
})
