import { useState, type FormEvent } from 'react'
import { retrieveSafetyAnswer } from './safetyKnowledge'

export default function FloatingSafetyChatbot() {
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<ReturnType<typeof retrieveSafetyAnswer> | null>(null)
  function submit(event: FormEvent) { event.preventDefault(); if (question.trim()) setAnswer(retrieveSafetyAnswer(question.trim())) }
  return <div className={`floating-safety-chatbot${open ? ' is-open' : ''}`}>
    {open ? <section className="floating-chat-panel" aria-label="안전규정 챗봇"><header><div><strong>안전규정 도우미</strong><span>공식자료 근거 답변</span></div><button type="button" aria-label="챗봇 닫기" onClick={() => setOpen(false)}>×</button></header><div className="floating-chat-content">{answer ? <><p>{answer.answer}</p>{answer.citations.length ? <div className="floating-citations">{answer.citations.map((citation) => <a key={`${citation.documentId}-${citation.section}`} href={citation.url} target="_blank" rel="noreferrer">{citation.title} · {citation.section}</a>)}</div> : null}</> : <p className="floating-chat-placeholder">안전 관련 질문을 자연어로 입력해보세요.</p>}</div><form onSubmit={submit}><input aria-label="안전 질문" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="예: 위험성평가는 언제 하나요?" /><button type="submit">질문</button></form><small>참고용 답변이며 최종 판단은 안전·법무 담당자와 확인하세요.</small></section> : null}
    <button className="floating-chat-character" type="button" aria-label={open ? '안전규정 챗봇 닫기' : '안전규정 챗봇 열기'} onClick={() => setOpen((value) => !value)}><span aria-hidden="true">⛑</span><b>안전</b></button>
  </div>
}
