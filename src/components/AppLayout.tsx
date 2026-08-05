import { NavLink, Outlet } from 'react-router-dom'

export default function AppLayout() {
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
          <NavLink to="/manage">사업 관리</NavLink>
          <NavLink to="/import">투자비 가져오기</NavLink>
        </nav>
      </header>
      <Outlet />
    </div>
  )
}
