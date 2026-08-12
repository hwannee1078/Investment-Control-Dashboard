import { describe, expect, it } from 'vitest'

import {
  DEMO_SAFETY_DOCUMENTS,
  retrieveSafetyAnswer,
} from './safetyKnowledge'

describe('retrieveSafetyAnswer', () => {
  it('returns only approved documents in citations', () => {
    const answer = retrieveSafetyAnswer('위험성평가 절차')

    expect(answer.hasEvidence).toBe(true)
    expect(answer.citations.length).toBeGreaterThan(0)
    expect(answer.answer).toContain('질문하신')
    expect(answer.answer).toContain('검색된 근거')
    expect(answer.citations.every((citation) => citation.status === 'approved')).toBe(true)
    expect(answer.citations.every((citation) => citation.url.startsWith('https://'))).toBe(true)
  })

  it('matches Korean keywords regardless of spacing and case', () => {
    const answer = retrieveSafetyAnswer('  위 험 성 평 가  ')

    expect(answer.hasEvidence).toBe(true)
    expect(answer.answer).toContain('위험성평가')
  })

  it('includes source metadata needed for citation display', () => {
    const answer = retrieveSafetyAnswer('중대재해 처벌')
    const citation = answer.citations[0]

    expect(citation).toMatchObject({
      title: expect.any(String),
      section: expect.any(String),
      sourceDate: expect.any(String),
      url: expect.any(String),
      status: 'approved',
    })
  })

  it('returns an explicit no-evidence response when nothing matches', () => {
    const answer = retrieveSafetyAnswer('행복한 주말 여행지 추천')

    expect(answer.hasEvidence).toBe(false)
    expect(answer.citations).toEqual([])
    expect(answer.answer).toContain('확인 가능한 공식 근거가 없습니다')
  })

  it('ships demo documents for all four approved source groups', () => {
    expect(new Set(DEMO_SAFETY_DOCUMENTS.map((document) => document.sourceGroup))).toEqual(
      new Set(['law', 'ministry', 'kosha', 'internal']),
    )
    expect(DEMO_SAFETY_DOCUMENTS.every((document) => document.status === 'approved')).toBe(true)
  })
})
