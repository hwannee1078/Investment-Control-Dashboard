import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '../../App'
import { PROJECTS_STORAGE_KEY } from '../../data/projectRepository'
import { TRANSACTIONS_STORAGE_KEY } from '../../data/investmentRepository'
import { SAMPLE_PROJECTS } from '../../domain/sampleData'

describe('project detail rolling plan', () => {
  beforeEach(() => {
    localStorage.clear(); sessionStorage.setItem('investment-dashboard.authenticated', 'true')
    localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify([SAMPLE_PROJECTS[0]]))
    localStorage.setItem(TRANSACTIONS_STORAGE_KEY, JSON.stringify([]))
  })
  it('shows four quarterly charts and no legacy monthly toggle', () => {
    render(<MemoryRouter initialEntries={[`/projects/${SAMPLE_PROJECTS[0].id}`]}><App /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: '분기별 Rolling Plan 비교' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /2026년 [1-4]분기/ })).toHaveLength(4)
    expect(screen.queryByRole('button', { name: '월별 투자비 펼치기' })).not.toBeInTheDocument()
  })
})
