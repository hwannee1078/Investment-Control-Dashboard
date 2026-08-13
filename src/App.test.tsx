import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach } from 'vitest'

import App from './App'
import { clearAuthenticatedSession, createAuthenticatedSession } from './features/auth/authStore'

afterEach(() => {
  clearAuthenticatedSession()
})

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

  it('redirects an unauthenticated Agent route request to login', () => {
    render(
      <MemoryRouter initialEntries={['/agent']}>
        <App />
      </MemoryRouter>,
    )

    expect(screen.queryByRole('heading', { name: 'AI Agent' })).not.toBeInTheDocument()
  })

  it('allows an admin to open the Agent route and management navigation', () => {
    createAuthenticatedSession('admin')

    render(
      <MemoryRouter initialEntries={['/agent']}>
        <App />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'AI Agent' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'AI Agent' })).toBeInTheDocument()
  })
})
