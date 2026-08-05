import { type FormEvent, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { createAuthenticatedSession } from './authStore'

type LoginErrors = {
  username?: string
  password?: string
}

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<LoginErrors>({})

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextErrors: LoginErrors = {}
    if (username.trim() === '') {
      nextErrors.username = '아이디를 입력해 주세요.'
    }
    if (password.trim() === '') {
      nextErrors.password = '비밀번호를 입력해 주세요.'
    }
    setErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    createAuthenticatedSession()
    const requestedPath = (location.state as { from?: string } | null)?.from
    navigate(requestedPath ?? '/dashboard', { replace: true })
  }

  return (
    <main className="login-shell">
      <section className="login-card" aria-labelledby="login-title">
        <p className="eyebrow">Investment Control Center</p>
        <h1 id="login-title">투자비 대시보드</h1>
        <p className="login-intro">사업별 투자 현황과 주요 일정을 한눈에 확인하세요.</p>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <label>
            <span>아이디</span>
            <input
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              aria-invalid={errors.username !== undefined}
              aria-describedby={errors.username ? 'username-error' : undefined}
            />
          </label>
          {errors.username && (
            <p className="field-error" id="username-error">
              {errors.username}
            </p>
          )}

          <label>
            <span>비밀번호</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={errors.password !== undefined}
              aria-describedby={errors.password ? 'password-error' : undefined}
            />
          </label>
          {errors.password && (
            <p className="field-error" id="password-error">
              {errors.password}
            </p>
          )}

          <button className="primary-button" type="submit">
            로그인
          </button>
        </form>
      </section>
    </main>
  )
}
