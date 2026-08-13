import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { requestAgent } from '../agent/agentClient'
import type { AgentAnswer } from '../agent/agentTypes'

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message === 'UNAUTHENTICATED') return '로그인 정보를 확인한 뒤 다시 시도해 주세요.'
  return '안전 문서 분석을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'
}

export default function FloatingSafetyChatbot() {
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<AgentAnswer | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const content = question.trim()
    if (!content || isLoading) return
    setIsLoading(true)
    setError('')
    try {
      const response = await requestAgent({ conversation: [{ role: 'user', content }] })
      setAnswer(response.message)
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setIsLoading(false)
    }
  }

  return <div className={`floating-safety-chatbot${open ? ' is-open' : ''}`}>
    {open ? <section className="floating-chat-panel" aria-label="통합 AI Agent 대화">
      <header><div><strong>통합 AI Agent</strong><span>승인된 안전 문서를 근거로 답합니다.</span></div><button type="button" aria-label="AI Agent 닫기" onClick={() => setOpen(false)}>×</button></header>
      <div className="floating-chat-content" aria-live="polite">
        {answer ? <><p>{answer.answer}</p>{answer.citations.length ? <div className="floating-citations">{answer.citations.map((citation) => <a key={`${citation.title}-${citation.section ?? ''}-${citation.url}`} href={citation.url} target="_blank" rel="noreferrer">{citation.title} · {citation.section ?? '관련 항목'}</a>)}</div> : null}</> : <p className="floating-chat-placeholder">안전 관련 질문을 자연어로 입력해 보세요.</p>}
        {error ? <p className="floating-chat-error" role="alert">{error}</p> : null}
      </div>
      <form onSubmit={submit}><label className="visually-hidden" htmlFor="floating-agent-question">Agent 질문</label><input id="floating-agent-question" aria-label="Agent 질문" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="예: 위험성평가는 언제 하나요?" disabled={isLoading} /><button type="submit" disabled={isLoading || !question.trim()}>{isLoading ? '분석 중…' : '질문'}</button></form>
      <Link className="floating-agent-link" to="/agent" onClick={() => setOpen(false)}>전체 분석 화면 열기</Link>
      <small>답변은 참고용이며 최종 판단은 안전·법무 담당자에게 확인하세요.</small>
    </section> : null}
    <button className="floating-chat-character" type="button" aria-label={open ? 'AI Agent 닫기' : 'AI Agent 열기'} aria-expanded={open} aria-controls="floating-agent-question" onClick={() => setOpen((value) => !value)}><span aria-hidden="true">AI</span><b>AI Agent</b></button>
  </div>
}
