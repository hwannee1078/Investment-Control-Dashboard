import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import App from './App'

describe('App', () => {
  it('shows the investment cost dashboard login heading', () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <App />
      </MemoryRouter>,
    )

    expect(
      screen.getByRole('heading', { name: '투자비 대시보드' }),
    ).toBeInTheDocument()
  })

  it.each(['/', '/not-a-route'])(
    'redirects %s to login and shows the login heading',
    (path) => {
      render(
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>,
      )

      expect(
        screen.getByRole('heading', { name: '투자비 대시보드' }),
      ).toBeInTheDocument()
    },
  )
})
