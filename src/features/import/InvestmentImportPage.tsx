import { useMemo, useState, type ChangeEvent } from 'react'
import { InvestmentRepository, ORDER_MAPPINGS_STORAGE_KEY } from '../../data/investmentRepository'
import { ProjectRepository } from '../../data/projectRepository'
import type { Project } from '../../domain/project'
import { parseWorkbookFiles, type ImportResult } from '../../services/investmentImport'
import { getSessionRole } from '../auth/authStore'
import { finalizeProject } from '../auth/workflowStore'
import ImportPreview from './ImportPreview'
import OrderMappingTable from './OrderMappingTable'
import { syncLocalDataToCloud } from '../../services/cloudSync'

function mappingsFromProjects(projects: Project[]): Record<string, string> { return Object.fromEntries(projects.flatMap((project) => project.orderIds.map((orderId) => [orderId, project.id]))) }
function mappingsFromStorage(storage: Storage = localStorage): Record<string, string> { try { return JSON.parse(storage.getItem(ORDER_MAPPINGS_STORAGE_KEY) ?? '{}') as Record<string, string> } catch { return {} } }

export default function InvestmentImportPage() {
  const projectRepository = useMemo(() => new ProjectRepository(), [])
  const investmentRepository = useMemo(() => new InvestmentRepository(), [])
  const [projects] = useState(() => projectRepository.list().filter((project) => project.active !== false))
  const [result, setResult] = useState<ImportResult | null>(null)
  const [orderMappings, setOrderMappings] = useState(() => ({ ...mappingsFromProjects(projects), ...mappingsFromStorage() }))
  const [isReading, setIsReading] = useState(false)
  const [readError, setReadError] = useState('')
  const [confirmError, setConfirmError] = useState('')
  const [completed, setCompleted] = useState(false)
  const role = getSessionRole()
  // 실무담당자는 확정 이후에도 다음 달 실적 파일을 계속 업로드할 수 있다.
  // 관리자만 활성화/비활성화 및 강제 수정 권한을 별도로 가진다.
  const lockedProjectIds = new Set<string>()
  const projectIds = useMemo(() => new Set(projects.map(({ id }) => id)), [projects])
  const ordersForMapping = result === null ? [] : [...new Set(result.rows.map(({ orderId }) => orderId))]

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    if (!files.length) return
    setCompleted(false); setReadError(''); setConfirmError(''); setIsReading(true)
    try { setResult(await parseWorkbookFiles(files)) } catch { setResult(null); setReadError('파일을 읽을 수 없습니다. 원본 파일 형식을 확인해 주세요.') } finally { setIsReading(false) }
  }
  function confirmImport() {
    if (!result) return
    const combinedMappings = { ...mappingsFromStorage(), ...orderMappings }
    const validMappings = Object.fromEntries(Object.entries(combinedMappings).filter(([, projectId]) => projectIds.has(projectId)))
    const mappedRows = result.rows.filter(({ orderId }) => validMappings[orderId] !== undefined && !lockedProjectIds.has(validMappings[orderId]))
    if (!mappedRows.length) { setConfirmError('유효하게 연결된 행이 하나 이상 필요합니다. 이미 확정된 사업은 관리자만 수정할 수 있습니다.'); return }
    const mergedTransactions = new Map<string, (typeof mappedRows)[number]>()
    for (const row of [...investmentRepository.listTransactions(), ...mappedRows]) { const identity = `${row.sourceId}\u0000${row.rowId}`; if (!mergedTransactions.has(identity)) mergedTransactions.set(identity, row) }
    investmentRepository.replaceTransactions([...mergedTransactions.values()]); investmentRepository.replaceOrderMappings(combinedMappings)
    for (const project of projects) { const ids = Object.entries(combinedMappings).filter(([, id]) => id === project.id).map(([id]) => id); const next = [...new Set([...project.orderIds, ...ids])]; if (next.length !== project.orderIds.length) projectRepository.save({ ...project, orderIds: next }) }
    for (const projectId of new Set(mappedRows.map(({ orderId }) => validMappings[orderId]))) finalizeProject(projectId)
    void syncLocalDataToCloud()
    setResult(null); setConfirmError(''); setCompleted(true)
  }
  function cancelPreview() { setResult(null); setOrderMappings({ ...mappingsFromProjects(projects), ...mappingsFromStorage() }); setConfirmError('') }

  return <main className="page-shell"><header className="page-heading"><div><p className="eyebrow">Excel Data Intake</p><h1>투자비 가져오기</h1></div><p>여러 파일을 검증하고 투자비를 사업별로 반영합니다.</p></header>
    {result === null ? <section className="import-upload-panel" aria-labelledby="upload-title"><h2 id="upload-title">엑셀 파일 선택</h2><p>사업별 파일을 여러 번 업로드하고 각각 확정할 수 있습니다.</p><label className="file-picker">엑셀 파일<input type="file" accept=".xlsx,.xls" multiple onChange={handleFiles} /></label>{isReading ? <p role="status">파일을 분석하고 있습니다.</p> : null}{readError ? <p className="status-warning" role="alert">{readError}</p> : null}{completed ? <p className="success-message" role="status">투자비 가져오기가 완료되었습니다.</p> : null}</section> : <><ImportPreview result={result} onConfirm={confirmImport} onCancel={cancelPreview} />{confirmError ? <p className="status-warning" role="alert">{confirmError}</p> : null}<OrderMappingTable orders={ordersForMapping} projects={projects} mappings={orderMappings} onMap={(orderId, projectId) => setOrderMappings((current) => ({ ...current, [orderId]: projectId }))} disabledProjectIds={lockedProjectIds} /></>}
  </main>
}
