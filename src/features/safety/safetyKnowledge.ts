import type {
  SafetyAnswer,
  SafetyChunk,
  SafetyCitation,
  SafetyDocument,
} from './safetyTypes'

export const DEMO_SAFETY_DOCUMENTS: SafetyDocument[] = [
  {
    id: 'law-occupational-safety',
    title: '산업안전보건법',
    sourceGroup: 'law',
    sourceName: '국가법령정보센터',
    url: 'https://www.law.go.kr/법령/산업안전보건법',
    sourceDate: '2026-01-01',
    status: 'approved',
    description: '사업주의 안전보건 조치와 위험성평가 관련 법령',
  },
  {
    id: 'ministry-risk-assessment',
    title: '사업장 위험성평가에 관한 지침',
    sourceGroup: 'ministry',
    sourceName: '고용노동부',
    url: 'https://www.moel.go.kr/info/lawinfo/instruction/list.do',
    sourceDate: '2025-12-15',
    status: 'approved',
    description: '위험성평가 실시 절차와 기록 관리 기준',
  },
  {
    id: 'kosha-guide-chemical',
    title: '화학설비 작업 안전보건 기술지침(KOSHA Guide)',
    sourceGroup: 'kosha',
    sourceName: '한국산업안전보건공단',
    url: 'https://www.kosha.or.kr/kosha/data/guidance.do',
    sourceDate: '2025-10-20',
    status: 'approved',
    description: '화학설비 점검과 작업 전 안전조치 기술자료',
  },
  {
    id: 'internal-safety-standard',
    title: '사내 안전보건관리규정(시연용)',
    sourceGroup: 'internal',
    sourceName: '회사 안전환경실',
    url: 'https://intranet.example.com/safety/standards',
    sourceDate: '2026-02-01',
    status: 'approved',
    description: '사내 작업허가와 사고보고 기본 절차',
  },
]

export const DEMO_SAFETY_CHUNKS: SafetyChunk[] = [
  {
    id: 'law-occupational-safety-1',
    documentId: 'law-occupational-safety',
    section: '제36조 위험성평가',
    content: '사업주는 건설물, 설비, 작업행동 및 그 밖의 업무로 인한 유해·위험요인을 찾아 위험성평가를 실시해야 합니다.',
    keywords: ['위험성평가', '유해위험요인'],
  },
  {
    id: 'law-occupational-safety-2',
    documentId: 'law-occupational-safety',
    section: '중대재해 처벌 관련 의무',
    content: '사업주는 중대재해를 예방하기 위해 안전보건관리체계를 구축하고 필요한 인력과 예산을 확보해야 합니다.',
    keywords: ['중대재해', '처벌', '안전보건관리체계'],
  },
  {
    id: 'ministry-risk-assessment-1',
    documentId: 'ministry-risk-assessment',
    section: '제5조 평가 절차',
    content: '위험성평가는 사전준비, 유해·위험요인 파악, 위험성 결정, 감소대책 수립 및 실행 순서로 진행합니다.',
    page: 4,
    keywords: ['위험성평가', '평가절차', '감소대책'],
  },
  {
    id: 'kosha-guide-chemical-1',
    documentId: 'kosha-guide-chemical',
    section: '4. 작업 전 안전조치',
    content: '화학설비 작업 전에는 설비 격리, 잔류물 제거, 가스농도 측정 및 개인보호구 착용을 확인해야 합니다.',
    page: 7,
    keywords: ['화학설비', '작업전', '개인보호구'],
  },
  {
    id: 'internal-safety-standard-1',
    documentId: 'internal-safety-standard',
    section: '2. 작업허가서',
    content: '고위험 작업은 작업허가서를 발행하고, 작업 전 안전회의와 현장 책임자 확인을 완료한 후 시작합니다.',
    page: 3,
    keywords: ['작업허가', '안전회의', '고위험작업'],
  },
]

const normalizeKorean = (value: string): string =>
  value
    .toLocaleLowerCase('ko-KR')
    .normalize('NFKC')
    .replace(/[^가-힣a-z0-9]+/gi, '')

const queryTerms = (question: string): string[] => {
  const terms = question
    .toLocaleLowerCase('ko-KR')
    .normalize('NFKC')
    .split(/[^가-힣a-z0-9]+/gi)
    .map((term) => normalizeKorean(term))
    .filter((term) => term.length >= 2)

  const normalized = normalizeKorean(question)
  return Array.from(new Set([normalized, ...terms])).filter(Boolean)
}

const toCitation = (document: SafetyDocument, chunk: SafetyChunk): SafetyCitation => ({
  documentId: document.id,
  title: document.title,
  sourceGroup: document.sourceGroup,
  sourceName: document.sourceName,
  section: chunk.section,
  page: chunk.page,
  sourceDate: document.sourceDate,
  url: document.url,
  status: document.status,
})

export const retrieveSafetyAnswer = (
  question: string,
  documents: SafetyDocument[] = DEMO_SAFETY_DOCUMENTS,
  chunks: SafetyChunk[] = DEMO_SAFETY_CHUNKS,
): SafetyAnswer => {
  const approvedDocuments = documents.filter((document) => document.status === 'approved')
  const approvedIds = new Set(approvedDocuments.map((document) => document.id))
  const terms = queryTerms(question)
  const matches = chunks
    .filter((chunk) => approvedIds.has(chunk.documentId))
    .map((chunk) => {
      const haystack = normalizeKorean(`${chunk.content} ${(chunk.keywords ?? []).join(' ')}`)
      const score = terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0)
      return { chunk, score }
    })
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)

  if (matches.length === 0) {
    return {
      question,
      answer: '확인 가능한 공식 근거가 없습니다. 법령·안전 담당자에게 추가 확인을 요청하세요.',
      hasEvidence: false,
      citations: [],
    }
  }

  const documentMap = new Map(approvedDocuments.map((document) => [document.id, document]))
  const citations = matches
    .map(({ chunk }) => {
      const document = documentMap.get(chunk.documentId)
      return document ? toCitation(document, chunk) : null
    })
    .filter((citation): citation is SafetyCitation => citation !== null)

  return {
    question,
    answer: `질문하신 “${question}”에 대해 승인된 공식자료에서 확인되는 내용입니다.\n\n${matches.map(({ chunk }) => chunk.content).join('\n\n')}\n\n위 내용은 검색된 근거를 요약한 것이며, 실제 적용 전 원문과 최신 시행일을 확인하세요.`,
    hasEvidence: true,
    citations,
  }
}
