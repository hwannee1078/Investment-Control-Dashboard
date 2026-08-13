import { useState, type FormEvent } from 'react'

type AgentComposerProps = {
  onSubmit: (question: string) => Promise<void> | void
  isLoading?: boolean
  error?: string
  compact?: boolean
}

export default function AgentComposer({ onSubmit, isLoading = false, error, compact = false }: AgentComposerProps) {
  const [question, setQuestion] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextQuestion = question.trim()
    if (!nextQuestion || isLoading) return
    await onSubmit(nextQuestion)
    setQuestion('')
  }

  return <form className={`agent-composer${compact ? ' agent-composer--compact' : ''}`} onSubmit={submit}>
    <label className="visually-hidden" htmlFor={compact ? 'floating-agent-question' : 'agent-question'}>Agent 질문</label>
    <input
      id={compact ? 'floating-agent-question' : 'agent-question'}
      aria-label="Agent 질문"
      value={question}
      onChange={(event) => setQuestion(event.target.value)}
      placeholder="예: 8월 투자비 이상 징후를 분석해줘"
      disabled={isLoading}
    />
    <button type="submit" disabled={isLoading || !question.trim()}>
      {isLoading ? '분석 중…' : compact ? '질문' : '분석 요청'}
    </button>
    {error ? <p className="agent-composer-error" role="alert">{error}</p> : null}
  </form>
}
