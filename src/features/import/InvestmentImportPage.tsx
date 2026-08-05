import { useMemo, useState, type ChangeEvent } from 'react'

import { InvestmentRepository } from '../../data/investmentRepository'
import { ProjectRepository } from '../../data/projectRepository'
import type { Project } from '../../domain/project'
import {
  parseWorkbookFiles,
  type ImportResult,
} from '../../services/investmentImport'
import ImportPreview from './ImportPreview'
import OrderMappingTable from './OrderMappingTable'

function mappingsFromProjects(projects: Project[]): Record<string, string> {
  return Object.fromEntries(
    projects.flatMap((project) =>
      project.orderIds.map((orderId) => [orderId, project.id]),
    ),
  )
}

export default function InvestmentImportPage() {
  const projectRepository = useMemo(() => new ProjectRepository(), [])
  const investmentRepository = useMemo(() => new InvestmentRepository(), [])
  const [projects] = useState(() => projectRepository.list())
  const [result, setResult] = useState<ImportResult | null>(null)
  const [orderMappings, setOrderMappings] = useState(() =>
    mappingsFromProjects(projects),
  )
  const [isReading, setIsReading] = useState(false)
  const [readError, setReadError] = useState('')
  const [completed, setCompleted] = useState(false)

  const projectIds = useMemo(
    () => new Set(projects.map(({ id }) => id)),
    [projects],
  )
  const unmappedOrders = result === null
    ? []
    : [...new Set(
        result.rows
          .map(({ orderId }) => orderId)
          .filter((orderId) => !projectIds.has(orderMappings[orderId] ?? '')),
      )]

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    if (files.length === 0) return

    setCompleted(false)
    setReadError('')
    setIsReading(true)
    try {
      setResult(await parseWorkbookFiles(files))
    } catch {
      setResult(null)
      setReadError('파일을 읽을 수 없습니다. 엑셀 파일 형식을 확인해 주세요.')
    } finally {
      setIsReading(false)
    }
  }

  function mapOrder(orderId: string, projectId: string) {
    setOrderMappings((current) => ({ ...current, [orderId]: projectId }))
  }

  function confirmImport() {
    if (result === null) return

    const validMappings = Object.fromEntries(
      Object.entries(orderMappings).filter(([, projectId]) => projectIds.has(projectId)),
    )
    const mappedRows = result.rows.filter(
      ({ orderId }) => validMappings[orderId] !== undefined,
    )

    investmentRepository.replaceTransactions(mappedRows)
    investmentRepository.replaceOrderMappings(validMappings)

    for (const project of projects) {
      const mappedOrderIds = Object.entries(validMappings)
        .filter(([, projectId]) => projectId === project.id)
        .map(([orderId]) => orderId)
      const nextOrderIds = [...new Set([...project.orderIds, ...mappedOrderIds])]
      if (nextOrderIds.length !== project.orderIds.length) {
        projectRepository.save({ ...project, orderIds: nextOrderIds })
      }
    }

    setResult(null)
    setCompleted(true)
  }

  function cancelPreview() {
    setResult(null)
    setOrderMappings(mappingsFromProjects(projects))
  }

  return (
    <main className="page-shell">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Excel Data Intake</p>
          <h1>투자비 가져오기</h1>
        </div>
        <p>여러 엑셀 파일을 검증한 뒤 투자비를 반영합니다.</p>
      </header>

      {result === null ? (
        <section className="import-upload-panel" aria-labelledby="upload-title">
          <h2 id="upload-title">엑셀 파일 선택</h2>
          <p>파일은 미리보기와 오더 연결을 확인한 뒤에만 저장됩니다.</p>
          <label className="file-picker">
            엑셀 파일
            <input
              type="file"
              accept=".xlsx,.xls"
              multiple
              onChange={handleFiles}
            />
          </label>
          {isReading ? <p role="status">파일을 분석하고 있습니다.</p> : null}
          {readError !== '' ? <p className="status-warning" role="alert">{readError}</p> : null}
          {completed ? (
            <p className="success-message" role="status">
              투자비 가져오기가 완료되었습니다.
            </p>
          ) : null}
        </section>
      ) : (
        <>
          <ImportPreview
            result={result}
            onConfirm={confirmImport}
            onCancel={cancelPreview}
          />
          <OrderMappingTable
            orders={unmappedOrders}
            projects={projects}
            onMap={mapOrder}
          />
        </>
      )}
    </main>
  )
}
