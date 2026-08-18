export const IMPORT_BATCHES_STORAGE_KEY = 'investment-dashboard.import-batches.v1'

export type ImportBatch = {
  id: string
  uploadedAt: string
  fileNames: string[]
  fileSizes: number[]
  projectIds: string[]
  orderIds: string[]
  acceptedRows: number
  warningCount: number
  errorCount: number
  status: 'confirmed'
}

export function listImportBatches(storage: Storage = localStorage): ImportBatch[] {
  try {
    const value = JSON.parse(storage.getItem(IMPORT_BATCHES_STORAGE_KEY) ?? '[]')
    return Array.isArray(value) ? value as ImportBatch[] : []
  } catch {
    return []
  }
}

export function saveImportBatch(batch: ImportBatch, storage: Storage = localStorage): void {
  const batches = listImportBatches(storage)
  storage.setItem(IMPORT_BATCHES_STORAGE_KEY, JSON.stringify([...batches, batch]))
}
