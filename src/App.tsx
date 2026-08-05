import { Navigate, Route, Routes, useLocation } from 'react-router-dom'

import AppLayout from './components/AppLayout'
import LoginPage from './features/auth/LoginPage'
import { hasAuthenticatedSession } from './features/auth/authStore'
import DashboardPage from './features/dashboard/DashboardPage'
import InvestmentImportPage from './features/import/InvestmentImportPage'
import ProjectManagePage from './features/manage/ProjectManagePage'
import ProjectDetailPage from './features/projects/ProjectDetailPage'

function ProtectedLayout() {
  const location = useLocation()

  return hasAuthenticatedSession() ? (
    <AppLayout />
  ) : (
    <Navigate to="/login" replace state={{ from: location.pathname }} />
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        <Route path="/manage" element={<ProjectManagePage />} />
        <Route path="/import" element={<InvestmentImportPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
