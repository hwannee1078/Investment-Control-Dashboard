import type { AgentDraft, AgentRole } from './agentTypes'

type AgentDraftCardProps = {
  draft: AgentDraft
  role: AgentRole
  onApprove: () => void
  onCancel: () => void
  isActionable?: boolean
  isWorking?: boolean
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '없음'
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  return JSON.stringify(value)
}

export default function AgentDraftCard({ draft, role, onApprove, onCancel, isActionable = false, isWorking = false }: AgentDraftCardProps) {
  const canSave = role === 'staff' || role === 'admin'
  return <article className="agent-draft-card" aria-label="Agent 작업 초안">
    <header>
      <p className="eyebrow">검토 후 저장</p>
      <h3>{draft.summary}</h3>
      <span className={`agent-draft-status agent-draft-status--${draft.status}`}>{draft.status === 'pending' ? '승인 대기' : draft.status === 'approved' ? '저장됨' : '취소됨'}</span>
    </header>
    <dl className="agent-draft-changes">
      {draft.changes.map((change) => <div key={change.field}>
        <dt>{change.field}</dt>
        <dd><span>이전: {displayValue(change.before)}</span><span>변경: {displayValue(change.after)}</span></dd>
      </div>)}
    </dl>
    <ul className="agent-draft-validations" aria-label="검증 결과">
      {draft.validations.map((validation) => <li key={validation.code} className={validation.passed ? 'is-passed' : 'is-failed'}>
        <strong>{validation.passed ? '통과' : '확인 필요'}</strong> {validation.message}
      </li>)}
    </ul>
    {canSave && !isActionable ? <p className="agent-draft-unavailable">이 초안은 서버에 안전하게 보관되지 않아 승인하거나 저장할 수 없습니다.</p> : null}
    {canSave && isActionable && draft.status === 'pending' ? <div className="agent-draft-actions">
      <button className="secondary-button" type="button" onClick={onCancel} disabled={isWorking}>초안 취소</button>
      <button className="primary-button" type="button" onClick={onApprove} disabled={isWorking || !draft.validations.every(({ passed }) => passed)}>{isWorking ? '처리 중…' : '초안 승인'}</button>
    </div> : null}
  </article>
}
