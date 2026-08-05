import * as XLSX from 'xlsx'
import { describe, expect, it } from 'vitest'

import {
  parseWorkbookFiles,
  validateWorkbookHeaders,
} from './investmentImport'

function workbookFile(
  name: string,
  data: Array<Record<string, unknown>>,
): File {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(data),
    '투자비',
  )
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet([{ 무시: '두 번째 시트' }]),
    '기타',
  )
  const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })

  return {
    name,
    arrayBuffer: async () => bytes,
  } as File
}

function actualReportFile(
  name: string,
  monthlyActual: number,
  validationAmounts: number[],
): File {
  const rows: unknown[][] = Array.from({ length: 112 }, () => [])
  rows[3] = [null, '오더/그룹 1006249 인조흑연음극재 신설', '프로젝트 보고서']
  rows[4] = [null, '보고기간 2026-03']
  rows[13] = [null, '무시할 값', monthlyActual]
  validationAmounts.forEach((amount, index) => {
    rows[14 + index][2] = amount
  })
  rows[108][1] = '* H,S'
  rows[109][2] = 999_999

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(rows),
    '투자비',
  )
  const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })

  return { name, arrayBuffer: async () => bytes } as File
}

describe('validateWorkbookHeaders', () => {
  it('투자오더번호, 월/일자, 투자금액 중 누락된 필수 열을 모두 보고한다', () => {
    const errors = validateWorkbookHeaders([' 투자오더번호 '])

    expect(errors).toHaveLength(2)
    expect(errors.every(({ code }) => code === 'MISSING_HEADER')).toBe(true)
    expect(errors.map(({ message }) => message)).toEqual([
      '기준월 또는 투자일 열이 필요합니다.',
      '투자금액 열이 필요합니다.',
    ])
  })

  it('기준월 대신 투자일 열을 허용하고 머리글 공백을 정규화한다', () => {
    expect(
      validateWorkbookHeaders([' 투자오더번호 ', '투 자 일', '투자금액']),
    ).toEqual([])
  })
})

describe('parseWorkbookFiles', () => {
  it('투자일을 YYYY-MM로 정규화하고 첫 번째 워크시트만 읽는다', async () => {
    const result = await parseWorkbookFiles([
      workbookFile('first.xlsx', [
        {
          투자오더번호: 'ORDER-1',
          투자일: '2026-02-15',
          투자금액: 150,
        },
      ]),
    ])

    expect(result.errors).toEqual([])
    expect(result.rows).toEqual([
      {
        sourceId: 'first.xlsx',
        rowId: 'first.xlsx:2',
        orderId: 'ORDER-1',
        month: '2026-02',
        amount: 150,
      },
    ])
  })

  it('숫자가 아닌 금액과 유효하지 않은 월 오류를 같은 실행에서 모두 반환한다', async () => {
    const result = await parseWorkbookFiles([
      workbookFile('invalid.xlsx', [
        {
          투자오더번호: 'ORDER-1',
          기준월: '2026-13',
          투자금액: '10만원',
        },
        {
          투자오더번호: 'ORDER-2',
          기준월: '날짜아님',
          투자금액: 200,
        },
      ]),
    ])

    expect(result.rows).toEqual([])
    expect(result.errors.map(({ rowId, code }) => ({ rowId, code }))).toEqual([
      { rowId: 'invalid.xlsx:2', code: 'INVALID_AMOUNT' },
      { rowId: 'invalid.xlsx:2', code: 'INVALID_MONTH' },
      { rowId: 'invalid.xlsx:3', code: 'INVALID_MONTH' },
    ])
  })

  it('두 파일을 함께 파싱하고 같은 오더·월·금액 행은 중복으로 제외한다', async () => {
    const result = await parseWorkbookFiles([
      workbookFile('a.xlsx', [
        { 투자오더번호: 'ORDER-1', 기준월: '2026-01', 투자금액: 100 },
        { 투자오더번호: 'ORDER-2', 기준월: '2026-02', 투자금액: 200 },
      ]),
      workbookFile('b.xlsx', [
        { 투자오더번호: 'ORDER-2', 기준월: '2026-02', 투자금액: 200 },
        { 투자오더번호: 'ORDER-3', 기준월: '2026-03', 투자금액: 300 },
      ]),
    ])

    expect(result.rows.map(({ orderId }) => orderId)).toEqual([
      'ORDER-1',
      'ORDER-2',
      'ORDER-3',
    ])
    expect(result.duplicates).toEqual([
      {
        sourceId: 'b.xlsx',
        rowId: 'b.xlsx:2',
        duplicateOfRowId: 'a.xlsx:3',
      },
    ])
    expect(result.errors.map(({ rowId, code }) => ({ rowId, code }))).toEqual([
      { rowId: 'b.xlsx:2', code: 'DUPLICATE_ROW' },
    ])
  })

  it('필수 머리글이 없는 파일도 처리 중단 없이 오류로 반환한다', async () => {
    const result = await parseWorkbookFiles([
      workbookFile('missing.xlsx', [{ 투자오더번호: 'ORDER-1' }]),
    ])

    expect(result.rows).toEqual([])
    expect(result.errors.map(({ code }) => code)).toEqual([
      'MISSING_HEADER',
      'MISSING_HEADER',
    ])
  })

  it('실제 보고서 형식은 B4 오더와 C14 월별실적을 사용하고 B109 마커 앞의 C열만 검증한다', async () => {
    const result = await parseWorkbookFiles([
      actualReportFile('actual.xlsx', 450, [200, 250]),
    ])

    expect(result.rows).toEqual([
      {
        sourceId: 'actual.xlsx',
        rowId: 'actual.xlsx:14',
        orderId: '1006249',
        month: '2026-03',
        amount: 450,
      },
    ])
    expect(result.warnings).toEqual([])
  })

  it('실제 보고서의 C14와 C15:C108 합계가 다르면 업로드용 경고만 반환한다', async () => {
    const result = await parseWorkbookFiles([
      actualReportFile('mismatch.xlsx', 500, [200, 250]),
    ])

    expect(result.rows[0]?.amount).toBe(500)
    expect(result.errors).toEqual([])
    expect(result.warnings).toEqual([
      {
        sourceId: 'mismatch.xlsx',
        code: 'MONTHLY_TOTAL_MISMATCH',
        message: '월별 실적(C14: 500)과 검증 합계(C15:C108: 450)가 일치하지 않습니다. 차이: 50',
      },
    ])
  })
})
