import { Navigate, Route, Routes, useLocation } from 'react-router-dom'

import AppLayout from './components/AppLayout'
import LoginPage from './features/auth/LoginPage'
import { hasAuthenticatedSession } from './features/auth/authStore'
import DashboardPage from './features/dashboard/DashboardPage'
import ProjectDetailPage from './features/projects/ProjectDetailPage'

function ProtectedLayout() {
  const location = useLocation()

  return hasAuthenticatedSession() ? (
    <AppLayout />
  ) : (
    <Navigate to="/login" replace state={{ from: location.pathname }} />
  )
}

function ManagePage() {
  return (
    <main className="page-shell empty-page">
      <h1>사업 관리</h1>
      <p>사업 등록과 수정 기능은 다음 단계에서 제공됩니다.</p>
    </main>
  )
}

function ImportPage() {
  return (
    <main className="page-shell empty-page">
      <h1>투자비 가져오기</h1>
      <p>투자비 파일 가져오기 기능은 다음 단계에서 제공됩니다.</p>
    </main>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        <Route path="/manage" element={<ManagePage />} />
        <Route path="/import" element={<ImportPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
