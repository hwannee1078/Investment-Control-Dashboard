import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createAuthenticatedSession } from '../auth/authStore'
import AgentPage from './AgentPage'

const draft = {
  id: 'draft-1',
  kind: 'schedule-update' as const,
  projectId: 'project-1',
  summary: '일정 실적일을 2026-08-13으로 변경합니다.',
  changes: [{ field: 'schedule.착공.actual', before: null, after: '2026-08-13' }],
  validations: [{ code: 'VALID_ACTUAL_DATE', passed: true, message: '실적일 형식이 올바릅니다.' }],
  status: 'pending' as const,
}

function mockGateway(body: unknown) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })))
}

afterEach(() => {
  vi.unstubAllGlobals()
  sessionStorage.clear()
})

describe('AgentPage', () => {
  it('Korean question returns evidence and tool status from the gateway', async () => {
    createAuthenticatedSession('viewer')
    mockGateway({
      message: {
        answer: '8월 투자비가 전월 대비 증가했습니다.',
        intent: 'investment-analysis',
        citations: [],
        evidence: [{ label: '증가액', value: '1억 원', source: '월별 투자비' }],
        hasEvidence: true,
      },
      toolTrace: [{ name: 'findInvestmentAnomalies', status: 'ok' }],
    })

    render(<MemoryRouter><AgentPage /></MemoryRouter>)
    fireEvent.change(screen.getByLabelText('Agent 질문'), { target: { value: '8월 투자비 이상 징후를 분석해줘' } })
    fireEvent.click(screen.getByRole('button', { name: '분석 요청' }))

    expect(await screen.findByText('8월 투자비가 전월 대비 증가했습니다.')).toBeInTheDocument()
    expect(screen.getByText('증가액')).toBeInTheDocument()
    expect(screen.getByText('1억 원')).toBeInTheDocument()
    expect(screen.getByText('findInvestmentAnomalies · 완료')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith('/api/agent', expect.objectContaining({ method: 'POST' }))
  })

  it('shows approval controls to staff and sends an explicit approval action', async () => {
    createAuthenticatedSession('staff')
    mockGateway({
      message: { answer: '검토할 초안을 만들었습니다.', intent: 'schedule-analysis', citations: [], evidence: [], hasEvidence: false },
      draft,
      draftAction: { available: true },
      toolTrace: [{ name: 'prepareScheduleUpdate', status: 'ok' }],
    })
    render(<MemoryRouter><AgentPage /></MemoryRouter>)

    fireEvent.change(screen.getByLabelText('Agent 질문'), { target: { value: '일정 변경 초안을 만들어줘' } })
    fireEvent.click(screen.getByRole('button', { name: '분석 요청' }))
    expect(await screen.findByText(draft.summary)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '초안 승인' }))
    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith('/api/agent', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('approve-draft'),
    })))
  })

  it('does not expose draft persistence controls to viewers', async () => {
    createAuthenticatedSession('viewer')
    mockGateway({
      message: { answer: '초안을 검토하세요.', intent: 'schedule-analysis', citations: [], evidence: [], hasEvidence: false },
      draft,
      toolTrace: [],
    })
    render(<MemoryRouter><AgentPage /></MemoryRouter>)

    fireEvent.change(screen.getByLabelText('Agent 질문'), { target: { value: '일정 변경 초안을 만들어줘' } })
    fireEvent.click(screen.getByRole('button', { name: '분석 요청' }))
    await screen.findByText(draft.summary)

    expect(screen.queryByRole('button', { name: '초안 승인' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '초안 취소' })).not.toBeInTheDocument()
  })
})
