import { useState } from 'react'

import { getSessionRole } from '../auth/authStore'
import AgentComposer from './AgentComposer'
import AgentDraftCard from './AgentDraftCard'
import { requestAgent } from './agentClient'
import type { AgentAnswer, AgentDraft } from './agentTypes'
import type { AgentResponse } from './agentGateway'

type ConversationItem = {
  id: string
  question: string
  answer?: AgentAnswer
  draft?: AgentDraft
  draftAction?: AgentResponse['draftAction']
  toolTrace?: AgentResponse['toolTrace']
}

function nextId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message === 'FORBIDDEN') return '현재 권한으로는 이 작업을 저장할 수 없습니다.'
  if (error instanceof Error && error.message === 'UNAUTHENTICATED') return '로그인 정보를 확인한 뒤 다시 시도해 주세요.'
  return 'Agent 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'
}

function CitationList({ answer }: { answer: AgentAnswer }) {
  if (!answer.citations.length) return null
  return <div className="agent-citations"><h4>근거 문서</h4>{answer.citations.map((citation) => <a key={`${citation.title}-${citation.section ?? ''}-${citation.url}`} href={citation.url} target="_blank" rel="noreferrer">
    <strong>{citation.title}</strong><span>{citation.section ?? '관련 항목'}{citation.page ? ` · ${citation.page}쪽` : ''}</span>
  </a>)}</div>
}

export default function AgentPage() {
  const role = getSessionRole()
  const [conversation, setConversation] = useState<ConversationItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeDraftId, setActiveDraftId] = useState<string>()

  async function submit(question: string) {
    setIsLoading(true)
    setError('')
    const id = nextId()
    setConversation((items) => [...items, { id, question }])
    try {
      const response = await requestAgent({ conversation: [{ role: 'user', content: question }] })
      setConversation((items) => items.map((item) => item.id === id ? { ...item, answer: response.message, draft: response.draft, draftAction: response.draftAction, toolTrace: response.toolTrace } : item))
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setIsLoading(false)
    }
  }

  async function actOnDraft(draft: AgentDraft, type: 'approve-draft' | 'cancel-draft') {
    setActiveDraftId(draft.id)
    setError('')
    try {
      const response = await requestAgent({
        conversation: [{ role: 'user', content: draft.summary }],
        action: { type, draftId: draft.id },
      })
      setConversation((items) => items.map((item) => item.draft?.id === draft.id ? {
        ...item,
        answer: response.message,
        draft: response.draft ?? { ...draft, status: type === 'approve-draft' ? 'approved' : 'cancelled' },
        draftAction: response.draftAction,
        toolTrace: response.toolTrace,
      } : item))
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setActiveDraftId(undefined)
    }
  }

  return <main className="page-shell agent-page">
    <header className="page-heading"><div><p className="eyebrow">Integrated AI Agent</p><h1>AI Agent</h1></div><p>투자비·일정·안전 문서를 분석하고, 저장 전에는 반드시 초안을 검토합니다.</p></header>
    <section className="agent-workspace" aria-label="AI Agent 분석 대화">
      <div className="agent-conversation" aria-live="polite">
        {conversation.length === 0 ? <div className="agent-empty"><h2>무엇을 확인할까요?</h2><p>예산 변동, 일정 누락, 엑셀 검증, 안전 규정 질문을 한국어로 입력해 주세요.</p></div> : conversation.map((item) => <article className="agent-message" key={item.id}>
          <p className="agent-question"><span>나</span>{item.question}</p>
          {item.answer ? <div className="agent-answer"><span className="agent-answer-label">AI Agent</span><p>{item.answer.answer}</p>
            {item.answer.evidence.length ? <dl className="agent-evidence">{item.answer.evidence.map((evidence) => <div key={`${evidence.label}-${evidence.source}`}><dt>{evidence.label}</dt><dd>{evidence.value}<small>{evidence.source}</small></dd></div>)}</dl> : null}
            <CitationList answer={item.answer} />
            {item.toolTrace?.length ? <ul className="agent-tool-trace" aria-label="도구 처리 상태">{item.toolTrace.map((tool) => <li key={`${tool.name}-${tool.status}`} className={tool.status === 'ok' ? 'is-ok' : 'is-error'}>{tool.name} · {tool.status === 'ok' ? '완료' : '오류'}</li>)}</ul> : null}
          </div> : null}
          {item.draft ? <AgentDraftCard draft={item.draft} role={role} isActionable={item.draftAction?.available === true} isWorking={activeDraftId === item.draft.id} onApprove={() => void actOnDraft(item.draft!, 'approve-draft')} onCancel={() => void actOnDraft(item.draft!, 'cancel-draft')} /> : null}
        </article>)}</div>
      <AgentComposer onSubmit={submit} isLoading={isLoading} error={error} />
    </section>
  </main>
}
