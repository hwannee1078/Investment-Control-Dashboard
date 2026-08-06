import { NavLink, Outlet } from 'react-router-dom'
import { canManage, getSessionRole } from '../features/auth/authStore'

export default function AppLayout() {
  const role = getSessionRole()
  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink className="brand" to="/dashboard">
          <span className="brand-mark" aria-hidden="true">
            P
          </span>
          <span>Investment Control</span>
        </NavLink>
        <nav aria-label="주요 메뉴">
          <NavLink to="/dashboard">대시보드</NavLink>
          {canManage(role) ? <NavLink to="/manage">사업 관리</NavLink> : null}
          {canManage(role) ? <NavLink to="/import">투자비 가져오기</NavLink> : null}
        </nav>
      </header>
      <Outlet />
    </div>
  )
}
