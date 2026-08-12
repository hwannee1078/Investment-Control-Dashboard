export type SafetySourceGroup = 'law' | 'ministry' | 'kosha' | 'internal'

export type SafetyDocumentStatus = 'pending' | 'approved'

export interface SafetyDocument {
  id: string
  title: string
  sourceGroup: SafetySourceGroup
  sourceName: string
  url: string
  sourceDate: string
  status: SafetyDocumentStatus
  description?: string
}

export interface SafetyChunk {
  id: string
  documentId: string
  content: string
  section: string
  page?: number
  keywords?: string[]
}

export interface SafetyCitation {
  documentId: string
  title: string
  sourceGroup: SafetySourceGroup
  sourceName: string
  section: string
  page?: number
  sourceDate: string
  url: string
  status: SafetyDocumentStatus
}

export interface SafetyAnswer {
  question: string
  answer: string
  hasEvidence: boolean
  citations: SafetyCitation[]
}
