import type { SafetyChunk, SafetyDocument } from './safetyTypes'
import { DEMO_SAFETY_CHUNKS, DEMO_SAFETY_DOCUMENTS } from './safetyKnowledge'
import { supabase } from '../../services/supabaseClient'

type CloudDocument = { id: string; title: string; source_group: SafetyDocument['sourceGroup']; source_name: string; url: string; source_date: string; status: SafetyDocument['status']; description?: string }
type CloudChunk = Omit<SafetyChunk, 'documentId'> & { document_id: string }

export async function loadSafetyKnowledge(): Promise<{ documents: SafetyDocument[]; chunks: SafetyChunk[]; source: 'cloud' | 'demo' }> {
  if (!supabase) return { documents: DEMO_SAFETY_DOCUMENTS, chunks: DEMO_SAFETY_CHUNKS, source: 'demo' }
  const [documentsResult, chunksResult] = await Promise.all([
    supabase.from('safety_documents').select('id,title,source_group,source_name,url,source_date,status,description'),
    supabase.from('safety_document_chunks').select('id,document_id,content,section,page,keywords'),
  ])
  if (documentsResult.error || chunksResult.error || !documentsResult.data?.length) {
    return { documents: DEMO_SAFETY_DOCUMENTS, chunks: DEMO_SAFETY_CHUNKS, source: 'demo' }
  }
  const documents = (documentsResult.data as CloudDocument[]).map(({ source_group, source_date, source_name, ...document }) => ({ ...document, sourceName: source_name, sourceGroup: source_group, sourceDate: source_date }))
  const chunks = (chunksResult.data as CloudChunk[]).map(({ document_id, ...chunk }) => ({ ...chunk, documentId: document_id }))
  return { documents, chunks, source: 'cloud' }
}
