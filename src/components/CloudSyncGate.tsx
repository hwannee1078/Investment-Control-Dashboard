import { useEffect, useState, type ReactNode } from 'react'
import { hydrateLocalDataFromCloud } from '../services/cloudSync'

export default function CloudSyncGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    hydrateLocalDataFromCloud()
      .catch(() => setError('서버 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'))
      .finally(() => setReady(true))
  }, [])

  if (!ready) return <main className="page-shell"><p role="status">서버 데이터를 불러오는 중입니다.</p></main>
  if (error) return <main className="page-shell"><p className="status-warning" role="alert">{error}</p></main>
  return <>{children}</>
}
