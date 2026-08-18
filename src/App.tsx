import type { ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'

import AppLayout from './components/AppLayout'
import LoginPage from './features/auth/LoginPage'
import { canManage, getSessionRole, hasAuthenticatedSession } from './features/auth/authStore'
import DashboardPage from './features/dashboard/DashboardPage'
import InvestmentImportPage from './features/import/InvestmentImportPage'
import ProjectManagePage from './features/manage/ProjectManagePage'
import ProjectDetailPage from './features/projects/ProjectDetailPage'
import CloudSyncGate from './components/CloudSyncGate'
import { isOfflineMode } from './services/runtimeConfig'
import SafetyRegulationPage from './features/safety/SafetyRegulationPage'
import AgentPage from './features/agent/AgentPage'
import { isSupabaseConfigured } from './services/supabaseClient'

function ProtectedLayout() {
  const location = useLocation()

  return hasAuthenticatedSession() ? (
    <AppLayout />
  ) : (
    <Navigate to="/login" replace state={{ from: location.pathname }} />
  )
}

function ManageRoute({ children }: { children: ReactNode }) {
  return canManage(getSessionRole()) ? children : <Navigate to="/dashboard" replace />
}

export default function App() {
  const routes = (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        <Route path="/manage" element={<ManageRoute><ProjectManagePage /></ManageRoute>} />
        <Route path="/import" element={<ManageRoute><InvestmentImportPage /></ManageRoute>} />
        <Route path="/safety" element={<SafetyRegulationPage />} />
        <Route path="/agent" element={<AgentPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
  return isSupabaseConfigured || isOfflineMode ? <CloudSyncGate>{routes}</CloudSyncGate> : routes
}
