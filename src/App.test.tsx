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
      screen.getByRole('heading', { name: '?ъ옄鍮???쒕낫??' }),
    ).toBeInTheDocument()
  })
})
