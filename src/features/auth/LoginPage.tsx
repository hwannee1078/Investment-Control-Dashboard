import { type FormEvent, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { createAuthenticatedSession } from './authStore'
import { getUserRole } from './userStore'
import { ensureCloudUserRole, getCloudUserRole } from '../../services/cloudSync'
import { isSupabaseConfigured, supabase } from '../../services/supabaseClient'

type LoginErrors = { username?: string; password?: string }

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<LoginErrors>({})
  const [authError, setAuthError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [registerMode, setRegisterMode] = useState(false)
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors: LoginErrors = {}
    if (!username.trim()) nextErrors.username = '아이디를 입력해 주세요.'
    if (!password.trim()) nextErrors.password = '비밀번호를 입력해 주세요.'
    setErrors(nextErrors)
    setAuthError('')
    if (Object.keys(nextErrors).length > 0) return
    setIsSubmitting(true)
    if (isSupabaseConfigured && supabase) {
      if (registerMode) {
        const { data, error } = await supabase.auth.signUp({
          email: `${username.trim().toLowerCase()}@investment.local`,
          password,
          options: { data: { employee_id: username.trim() } },
        })
        if (error || !data.user) {
          setAuthError(error?.message ?? '계정 등록에 실패했습니다.')
          setIsSubmitting(false)
          return
        }
        if (!data.session) {
          setAuthError('계정이 등록되었습니다. Supabase 이메일 확인 설정을 해제한 뒤 다시 로그인해 주세요.')
          setIsSubmitting(false)
          return
        }
        await ensureCloudUserRole(data.user.id, username.trim())
        createAuthenticatedSession(await getCloudUserRole(data.user.id))
      } else {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: `${username.trim().toLowerCase()}@investment.local`,
        password,
      })
      if (error || !data.user) {
        setAuthError('사번 또는 비밀번호가 올바르지 않거나 Supabase에 계정이 등록되지 않았습니다.')
        setIsSubmitting(false)
        return
      }
      await ensureCloudUserRole(data.user.id, username.trim())
      createAuthenticatedSession(await getCloudUserRole(data.user.id))
      }
    } else {
      createAuthenticatedSession(getUserRole(username.trim()))
    }
    setIsSubmitting(false)
    const requestedPath = (location.state as { from?: string } | null)?.from
    navigate(requestedPath ?? '/dashboard', { replace: true })
  }
  return <main className="login-shell"><section className="login-card" aria-labelledby="login-title"><p className="eyebrow">Investment Control Center</p><h1 id="login-title">투자비 대시보드</h1><p className="login-intro">사내 사번과 비밀번호로 로그인하세요.</p><form className="login-form" onSubmit={handleSubmit} noValidate>
    <label><span>사번</span><input aria-label="아이디" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} aria-invalid={errors.username !== undefined} /></label>{errors.username ? <p className="field-error">{errors.username}</p> : null}
    <label><span>비밀번호</span><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} aria-invalid={errors.password !== undefined} /></label>{errors.password ? <p className="field-error">{errors.password}</p> : null}
    {authError ? <p className="field-error" role="alert">{authError}</p> : null}
    <button className="primary-button" type="submit" disabled={isSubmitting}>{isSubmitting ? (registerMode ? '계정 등록 중…' : '로그인 중…') : (registerMode ? '계정 등록' : '로그인')}</button>
    {isSupabaseConfigured ? <button className="text-button login-mode-button" type="button" onClick={() => { setRegisterMode((current) => !current); setAuthError('') }}>{registerMode ? '로그인으로 돌아가기' : '처음 사용하시나요? 계정 등록'}</button> : null}
  </form></section></main>
}
