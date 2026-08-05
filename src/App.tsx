import { Navigate, Route, Routes } from 'react-router-dom'

function LoginPage() {
  return <h1>투자비 대시보드</h1>
}

function DashboardPage() {
  return <h1>Dashboard</h1>
}

function ProjectPage() {
  return <h1>Project</h1>
}

function ManagePage() {
  return <h1>Manage</h1>
}

function ImportPage() {
  return <h1>Import</h1>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/projects/:projectId" element={<ProjectPage />} />
      <Route path="/manage" element={<ManagePage />} />
      <Route path="/import" element={<ImportPage />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
