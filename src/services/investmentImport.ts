import * as XLSX from 'xlsx'

import type { InvestmentTransaction } from '../domain/investment'

export type ImportError = {
  sourceId: string
  rowId?: string
  code:
    | 'MISSING_HEADER'
    | 'INVALID_AMOUNT'
    | 'INVALID_MONTH'
    | 'UNMAPPED_ORDER'
    | 'DUPLICATE_ROW'
  message: string
}

export type DuplicateRow = {
  sourceId: string
  rowId: string
  duplicateOfRowId: string
}

export type ImportWarning = {
  sourceId: string
  code: 'MONTHLY_TOTAL_MISMATCH'
  message: string
}

export type ImportResult = {
  rows: InvestmentTransaction[]
  errors: ImportError[]
  duplicates: DuplicateRow[]
  warnings: ImportWarning[]
}

const ORDER_HEADER = '투자오더번호'
const MONTH_HEADER = '기준월'
const DATE_HEADER = '투자일'
const AMOUNT_HEADER = '투자금액'

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .replace(/^\uFEFF/, '')
    .replace(/\s+/g, '')
    .trim()
}

export function validateWorkbookHeaders(headers: string[]): ImportError[] {
  const normalizedHeaders = new Set(headers.map(normalizeHeader))
  const errors: ImportError[] = []

  if (!normalizedHeaders.has(ORDER_HEADER)) {
    errors.push({
      sourceId: '',
      code: 'MISSING_HEADER',
      message: '투자오더번호 열이 필요합니다.',
    })
  }
  if (
    !normalizedHeaders.has(MONTH_HEADER) &&
    !normalizedHeaders.has(DATE_HEADER)
  ) {
    errors.push({
      sourceId: '',
      code: 'MISSING_HEADER',
      message: '기준월 또는 투자일 열이 필요합니다.',
    })
  }
  if (!normalizedHeaders.has(AMOUNT_HEADER)) {
    errors.push({
      sourceId: '',
      code: 'MISSING_HEADER',
      message: '투자금액 열이 필요합니다.',
    })
  }

  return errors
}

function monthFromParts(year: number, month: number, day?: number): string | null {
  if (!Number.isInteger(year) || year < 1000 || year > 9999) {
    return null
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return null
  }
  if (day !== undefined) {
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
    if (!Number.isInteger(day) || day < 1 || day > lastDay) {
      return null
    }
  }

  return `${year}-${String(month).padStart(2, '0')}`
}

function normalizeMonth(value: unknown, fromDateColumn: boolean): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return monthFromParts(value.getUTCFullYear(), value.getUTCMonth() + 1)
  }

  if (fromDateColumn && typeof value === 'number' && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value)
    return parsed === null ? null : monthFromParts(parsed.y, parsed.m, parsed.d)
  }

  const text = String(value ?? '').trim()
  const monthMatch = /^(\d{4})[-./](\d{1,2})$/.exec(text)
  if (monthMatch !== null) {
    return monthFromParts(Number(monthMatch[1]), Number(monthMatch[2]))
  }

  if (fromDateColumn) {
    const dateMatch = /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/.exec(text)
    if (dateMatch !== null) {
      return monthFromParts(
        Number(dateMatch[1]),
        Number(dateMatch[2]),
        Number(dateMatch[3]),
      )
    }
  }

  return null
}

function normalizeReportMonth(value: unknown): string | null {
  const directMonth = normalizeMonth(value, true)
  if (directMonth !== null) return directMonth

  const match = /(\d{4})[-./](\d{1,2})(?:[-./]\d{1,2})?/.exec(
    String(value ?? ''),
  )
  if (match !== null) return normalizeMonth(`${match[1]}-${match[2]}`, true)

  // Some internal reports store the period as "- 6 6 2026" or "- 7 7 2026".
  const spacedPeriod = /(?:^|\D)(\d{1,2})\D+\d{1,2}\D+(\d{4})(?:\D|$)/.exec(String(value ?? ''))
  return spacedPeriod === null
    ? null
    : normalizeMonth(`${spacedPeriod[2]}-${spacedPeriod[1]}`, true)
}

async function readFile(file: File): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === 'function') {
    return file.arrayBuffer()
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => resolve(reader.result as ArrayBuffer))
    reader.addEventListener('error', () => reject(reader.error))
    reader.readAsArrayBuffer(file)
  })
}

export async function parseWorkbookFiles(files: File[]): Promise<ImportResult> {
  const rows: InvestmentTransaction[] = []
  const errors: ImportError[] = []
  const duplicates: DuplicateRow[] = []
  const warnings: ImportWarning[] = []
  const firstRowIdByContent = new Map<string, string>()

  for (const file of files) {
    const sourceId = file.name
    const workbook = XLSX.read(await readFile(file), {
      type: 'array',
      cellDates: true,
    })
    const firstSheetName = workbook.SheetNames[0]
    const sheet = firstSheetName === undefined ? undefined : workbook.Sheets[firstSheetName]
    const values = sheet === undefined
      ? []
      : (XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          raw: true,
          defval: null,
        }) as unknown[][])
    const headers = (values[0] ?? []).map(normalizeHeader)

    const reportMarkerRow = sheet === undefined
      ? -1
      : Object.keys(sheet)
          .map((address) => /^B(\d+)$/.exec(address))
          .filter((match): match is RegExpExecArray => match !== null)
          .map((match) => Number(match[1]))
          .filter((rowNumber) =>
            rowNumber >= 109 &&
            String(sheet[`B${rowNumber}`]?.v ?? '').replace(/\s+/g, '') === '*H,S',
          )
          .sort((left, right) => left - right)[0] ?? -1
    const reportHeader = String(sheet?.B4?.v ?? '').trim()
    if (reportMarkerRow !== -1 && reportHeader !== '') {
      const orderNumber = /(?<!\d)\d{7}(?!\d)/.exec(reportHeader)?.[0]
      let orderId = orderNumber ?? reportHeader
      if (orderId === '투자오더번호' || orderId === '오더번호') {
        orderId = String(sheet?.C4?.v ?? '').trim()
      }

      const month = normalizeReportMonth(sheet?.B5?.v) ?? normalizeReportMonth(sourceId)
      const amountValue = sheet?.C14?.v
      const rowId = `${sourceId}:14`
      let valid = true

      if (orderId === '') {
        errors.push({
          sourceId,
          rowId,
          code: 'UNMAPPED_ORDER',
          message: '투자오더번호 값이 없습니다.',
        })
        valid = false
      }
      if (typeof amountValue !== 'number' || !Number.isFinite(amountValue)) {
        errors.push({
          sourceId,
          rowId,
          code: 'INVALID_AMOUNT',
          message: `투자금액이 숫자가 아닙니다: ${String(amountValue ?? '')}`,
        })
        valid = false
      }
      if (month === null) {
        errors.push({
          sourceId,
          rowId,
          code: 'INVALID_MONTH',
          message: `기준월 또는 투자일이 올바르지 않습니다: ${String(sheet?.B14?.v ?? '')}`,
        })
        valid = false
      }

      let validationTotal = 0
      for (let rowNumber = 15; rowNumber < reportMarkerRow; rowNumber += 1) {
        const value = sheet?.[`C${rowNumber}`]?.v
        if (typeof value === 'number' && Number.isFinite(value)) {
          validationTotal += value
        }
      }
      if (
        typeof amountValue === 'number' &&
        Number.isFinite(amountValue) &&
        amountValue !== validationTotal
      ) {
        const difference = amountValue - validationTotal
        warnings.push({
          sourceId,
          code: 'MONTHLY_TOTAL_MISMATCH',
          message: `월별 실적(C14: ${amountValue})과 검증 합계(C15:C108: ${validationTotal})가 일치하지 않습니다. 차이: ${difference}`,
        })
      }

      if (valid && month !== null && typeof amountValue === 'number') {
        rows.push({
          sourceId,
          rowId,
          orderId,
          month,
          amount: amountValue,
          reconciliationDetailTotal: validationTotal,
        })
      }
      continue
    }

    const headerErrors = validateWorkbookHeaders(headers).map((error) => ({
      ...error,
      sourceId,
    }))
    errors.push(...headerErrors)
    if (headerErrors.length > 0) {
      continue
    }

    const headerIndexes = new Map(headers.map((header, index) => [header, index]))
    const orderIndex = headerIndexes.get(ORDER_HEADER) as number
    const amountIndex = headerIndexes.get(AMOUNT_HEADER) as number
    const monthIndex = headerIndexes.get(MONTH_HEADER)
    const dateIndex = headerIndexes.get(DATE_HEADER)
    const periodIndex = monthIndex ?? (dateIndex as number)
    const fromDateColumn = monthIndex === undefined

    for (let index = 1; index < values.length; index += 1) {
      const worksheetRow = values[index]
      const rowNumber = index + 1
      const rowId = `${sourceId}:${rowNumber}`
      const orderId = String(worksheetRow[orderIndex] ?? '').trim()
      const amountValue = worksheetRow[amountIndex]
      const month = normalizeMonth(worksheetRow[periodIndex], fromDateColumn)
      let valid = true

      if (orderId === '') {
        errors.push({
          sourceId,
          rowId,
          code: 'UNMAPPED_ORDER',
          message: '투자오더번호 값이 없습니다.',
        })
        valid = false
      }
      if (typeof amountValue !== 'number' || !Number.isFinite(amountValue)) {
        errors.push({
          sourceId,
          rowId,
          code: 'INVALID_AMOUNT',
          message: `투자금액이 숫자가 아닙니다: ${String(amountValue ?? '')}`,
        })
        valid = false
      }
      if (month === null) {
        errors.push({
          sourceId,
          rowId,
          code: 'INVALID_MONTH',
          message: `기준월 또는 투자일이 올바르지 않습니다: ${String(worksheetRow[periodIndex] ?? '')}`,
        })
        valid = false
      }
      if (!valid || month === null || typeof amountValue !== 'number') {
        continue
      }

      const contentKey = JSON.stringify([orderId, month, amountValue])
      const duplicateOfRowId = firstRowIdByContent.get(contentKey)
      if (duplicateOfRowId !== undefined) {
        duplicates.push({ sourceId, rowId, duplicateOfRowId })
        errors.push({
          sourceId,
          rowId,
          code: 'DUPLICATE_ROW',
          message: `${duplicateOfRowId} 행과 중복되어 제외했습니다.`,
        })
        continue
      }

      firstRowIdByContent.set(contentKey, rowId)
      rows.push({ sourceId, rowId, orderId, month, amount: amountValue })
    }
  }

  return { rows, errors, duplicates, warnings }
}
