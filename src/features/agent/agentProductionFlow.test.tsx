import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createAuthenticatedSession } from '../auth/authStore'
import { handleAgentRequest } from './agentGateway'
import AgentPage from './AgentPage'

afterEach(() => {
  vi.unstubAllGlobals()
  sessionStorage.clear()
})

describe('production draft lifecycle', () => {
  it('does not present approval controls when the production gateway cannot safely persist a requested draft', async () => {
    createAuthenticatedSession('staff')
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body))
      const body = await handleAgentRequest(request, {
        userId: 'user-1', employeeId: 'E-100', role: 'staff', now: '2026-08-13T00:00:00.000Z',
      })
      return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
    }))

    render(<MemoryRouter><AgentPage /></MemoryRouter>)
    fireEvent.change(screen.getByLabelText('Agent 질문'), { target: { value: '일정 변경 초안을 만들어줘' } })
    fireEvent.click(screen.getByRole('button', { name: '분석 요청' }))

    expect(await screen.findByText(/초안 저장은 현재 지원되지 않습니다/)).toBeInTheDocument()
    expect(screen.getByText('prepareDraft · 오류')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '초안 승인' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '초안 취소' })).not.toBeInTheDocument()
  })

  it('keeps viewers blocked from a production write-intent request', async () => {
    const response = await handleAgentRequest({
      conversation: [{ role: 'user', content: '일정 변경 초안을 만들어줘' }],
    }, { userId: 'viewer-1', employeeId: 'V-100', role: 'viewer', now: '2026-08-13T00:00:00.000Z' })

    expect(response.draft).toBeUndefined()
    expect(response.draftAction).toEqual({ available: false, reason: 'PENDING_DRAFT_STORAGE_UNAVAILABLE' })
    expect(response.toolTrace).toEqual([{ name: 'prepareDraft', status: 'error' }])
  })
})
