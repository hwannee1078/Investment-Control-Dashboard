import { isOfflineMode, offlineApiBaseUrl, offlineAuthHeaders } from './runtimeConfig'

function bytesToBase64(bytes: Uint8Array): string {
  let result = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    result += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(result)
}

export async function archiveOfflineImportFiles(batchId: string, files: File[]): Promise<void> {
  if (!isOfflineMode || files.length === 0) return
  const payload = await Promise.all(files.map(async (file) => ({
    name: file.name,
    size: file.size,
    contentBase64: bytesToBase64(new Uint8Array(await file.arrayBuffer())),
  })))
  const response = await fetch(`${offlineApiBaseUrl}/import-files`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...offlineAuthHeaders() },
    body: JSON.stringify({ batchId, files: payload }),
  })
  if (!response.ok) throw new Error('원본 Excel 보관에 실패했습니다.')
}
