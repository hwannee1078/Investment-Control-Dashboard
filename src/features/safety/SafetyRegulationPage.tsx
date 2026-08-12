import { useMemo, useState } from 'react'
import { getSessionRole, canManage } from '../auth/authStore'
import { DEMO_SAFETY_DOCUMENTS, retrieveSafetyAnswer } from './safetyKnowledge'

export default function SafetyRegulationPage() {
  const role = getSessionRole()
  const [question, setQuestion] = useState('')
  const [submitted, setSubmitted] = useState('?곗뾽?덉쟾蹂닿굔踰??꾪뿕?깊룊媛 湲곗????뚮젮以?)
  const answer = useMemo(() => retrieveSafetyAnswer(submitted), [submitted])
  const [pendingTitle, setPendingTitle] = useState('')
  const [pendingSource, setPendingSource] = useState('')
  const [pending, setPending] = useState<string[]>([])

  function ask(event: React.FormEvent) {
    event.preventDefault()
    if (question.trim()) setSubmitted(question.trim())
  }

  function submitDocument(event: React.FormEvent) {
    event.preventDefault()
    if (!pendingTitle.trim()) return
    setPending((items) => [...items, pendingTitle.trim()])
    setPendingTitle('')
    setPendingSource('')
  }

  return <main className="page-shell safety-page">
    <header className="page-heading"><div><p className="eyebrow">Safety Knowledge Center</p><h1>?덉쟾洹쒖젙</h1></div><p>怨듭떇 踰뺣졊怨??뱀씤???щ궡?먮즺瑜?洹쇨굅濡??뺤씤?⑸땲??</p></header>
    <section className="safety-layout">
      <div className="safety-chat-panel">
        <div className="panel-heading"><div><h2>?덉쟾洹쒖젙 梨쀫큸</h2><p>洹쇨굅媛 ?뺤씤??臾몄꽌留??듬????ъ슜?⑸땲??</p></div></div>
        <div className="safety-examples"><span>?덉떆 吏덈Ц</span>{['?꾪뿕?깊룊媛 湲곗???', '以묐??ы빐泥섎쾶踰뺤쓽 ?덉쟾蹂닿굔愿由ъ껜怨꾨뒗?', '?뷀븰臾쇱쭏 痍④툒 ???뺤씤???ы빆??'].map((item) => <button key={item} type="button" onClick={() => { setQuestion(item); setSubmitted(item) }}>{item}</button>)}</div>
        <form className="safety-question-form" onSubmit={ask}><label htmlFor="safety-question">吏덈Ц</label><div><input id="safety-question" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="?덉쟾 愿??吏덈Ц???낅젰?섏꽭?? /><button className="primary-button" type="submit">寃??/button></div></form>
        <article className="safety-answer" aria-live="polite"><p className="eyebrow">寃??寃곌낵</p><p>{answer.answer}</p>{answer.hasEvidence ? <div className="safety-citations"><h3>洹쇨굅 臾몄꽌</h3>{answer.citations.map((citation) => <a key={`${citation.title}-${citation.section}`} href={citation.url} target="_blank" rel="noreferrer"><strong>{citation.title}</strong><span>{citation.section} 쨌 湲곗???{citation.sourceDate}</span></a>)}</div> : null}</article>
        <p className="safety-disclaimer">蹂??듬?? 李멸퀬?⑹씠硫? ?묒뾽 ??理쒖쥌 ?먮떒? ?뚯궗 ?덉쟾쨌踰뺣Т ?대떦?먯? ?뺤씤?섏꽭??</p>
      </div>
      <aside className="safety-doc-panel"><div className="panel-heading"><div><h2>臾몄꽌 ?꾪솴</h2><p>?뱀씤??臾몄꽌留?寃?됰맗?덈떎.</p></div></div><ul className="safety-document-list">{DEMO_SAFETY_DOCUMENTS.map((document) => <li key={document.id}><strong>{document.title}</strong><span>{document.sourceGroup} 쨌 {document.sourceDate}</span><em>{document.status === 'approved' ? '?뱀씤?? : '寃?좎쨷'}</em></li>)}</ul>{canManage(role) ? <form className="safety-upload-form" onSubmit={submitDocument}><h3>?щ궡?먮즺 ?깅줉 ?붿껌</h3><input value={pendingTitle} onChange={(event) => setPendingTitle(event.target.value)} placeholder="臾몄꽌紐? aria-label="臾몄꽌紐? /><input value={pendingSource} onChange={(event) => setPendingSource(event.target.value)} placeholder="?먮Ц URL(?좏깮)" aria-label="?먮Ц URL" /><button className="secondary-button" type="submit">寃???붿껌</button>{pending.length ? <p role="status">寃???湲?{pending.length}嫄?/p> : null}</form> : null}</aside>
    </section>
  </main>
}

