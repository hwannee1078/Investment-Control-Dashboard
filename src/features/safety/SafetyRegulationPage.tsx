import { useMemo, useState, type FormEvent } from 'react'
import { canManage, getSessionRole } from '../auth/authStore'
import { DEMO_SAFETY_DOCUMENTS, retrieveSafetyAnswer } from './safetyKnowledge'

export default function SafetyRegulationPage() {
  const role = getSessionRole()
  const [question, setQuestion] = useState('')
  const [submitted, setSubmitted] = useState('위험성평가 기준')
  const answer = useMemo(() => retrieveSafetyAnswer(submitted), [submitted])
  const [pendingTitle, setPendingTitle] = useState('')
  const [pendingSource, setPendingSource] = useState('')
  const [pending, setPending] = useState<string[]>([])
  const ask = (event: FormEvent) => { event.preventDefault(); if (question.trim()) setSubmitted(question.trim()) }
  const submitDocument = (event: FormEvent) => { event.preventDefault(); if (!pendingTitle.trim()) return; setPending((items) => [...items, pendingTitle.trim()]); setPendingTitle(''); setPendingSource('') }
  return <main className="page-shell safety-page">
    <header className="page-heading"><div><p className="eyebrow">Safety Knowledge Center</p><h1>안전규정</h1></div><p>공식 법령과 승인된 사내자료를 근거로 확인합니다.</p></header>
    <section className="safety-layout">
      <div className="safety-chat-panel"><div className="panel-heading"><div><h2>안전규정 챗봇</h2><p>근거가 확인된 문서만 답변에 사용합니다.</p></div></div>
        <div className="safety-examples"><span>예시 질문</span>{['위험성평가 기준', '중대재해 처벌 법령', '화학물질 취급 안전'].map((item) => <button key={item} type="button" onClick={() => { setQuestion(item); setSubmitted(item) }}>{item}</button>)}</div>
        <form className="safety-question-form" onSubmit={ask}><label htmlFor="safety-question">질문</label><div><input id="safety-question" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="안전 관련 질문을 입력하세요" /><button className="primary-button" type="submit">검색</button></div></form>
        <article className="safety-answer" aria-live="polite"><p className="eyebrow">검색 결과</p><p>{answer.answer}</p>{answer.hasEvidence ? <div className="safety-citations"><h3>근거 문서</h3>{answer.citations.map((citation) => <a key={`${citation.title}-${citation.section}`} href={citation.url} target="_blank" rel="noreferrer"><strong>{citation.title}</strong><span>{citation.section} · 기준일 {citation.sourceDate}</span></a>)}</div> : null}</article>
        <p className="safety-disclaimer">본 답변은 참고용이며, 최종 판단은 회사 안전·법무 담당자와 확인하세요.</p>
      </div>
      <aside className="safety-doc-panel"><div className="panel-heading"><div><h2>문서 현황</h2><p>승인된 문서만 검색됩니다.</p></div></div><ul className="safety-document-list">{DEMO_SAFETY_DOCUMENTS.map((document) => <li key={document.id}><strong>{document.title}</strong><span>{document.sourceGroup} · {document.sourceDate}</span><em>{document.status === 'approved' ? '승인됨' : '검토중'}</em></li>)}</ul>{canManage(role) ? <form className="safety-upload-form" onSubmit={submitDocument}><h3>사내자료 등록 요청</h3><input value={pendingTitle} onChange={(event) => setPendingTitle(event.target.value)} placeholder="문서명" aria-label="문서명" /><input value={pendingSource} onChange={(event) => setPendingSource(event.target.value)} placeholder="원문 URL(선택)" aria-label="원문 URL" /><button className="secondary-button" type="submit">검토 요청</button>{pending.length ? <p role="status">검토 대기 {pending.length}건</p> : null}</form> : null}</aside>
    </section>
  </main>
}
