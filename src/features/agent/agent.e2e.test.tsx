import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { InvestmentTransaction } from '../../domain/investment'
import { createAuthenticatedSession } from '../auth/authStore'
import { approveAgentDraft, prepareInvestmentImport } from './drafts/agentDraftService'
import AgentPage from './AgentPage'
import { createAgentGateway } from './agentGateway'

const viewer = { userId: 'viewer-1', employeeId: 'V-100', role: 'viewer' as const, now: '2026-08-13T00:00:00.000Z' }
const staff = { ...viewer, userId: 'staff-1', employeeId: 'S-100', role: 'staff' as const }
const admin = { ...viewer, userId: 'admin-1', employeeId: 'A-100', role: 'admin' as const }

function request(content: string) {
  return { conversation: [{ role: 'user' as const, content }] }
}

function transaction(row: number, amount: number): InvestmentTransaction {
  return { sourceId: 'report.xlsx', rowId: `report.xlsx:${row}`, orderId: 'ORDER-1', month: '2026-07', amount }
}

function seedProject(): void {
  localStorage.setItem('investment-dashboard.projects.v1', JSON.stringify([{
    id: 'project-1', name: 'Project 1', location: 'Pohang', material: 'Steel', status: '?ъ뾽?뱀씤',
    schedule: {}, approvalBudget: 1_000, orderIds: ['ORDER-1'],
  }]))
  localStorage.setItem('investment-dashboard.transactions.v1', JSON.stringify([]))
  localStorage.setItem('investment-dashboard.order-mappings.v1', JSON.stringify({ 'ORDER-1': 'project-1' }))
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

afterEach(() => vi.unstubAllGlobals())

describe('AI Agent end-to-end safeguards', () => {
  it('lets a viewer run a read-only analysis without returning a draft', async () => {
    const response = await createAgentGateway({
      tools: {
        findInvestmentAnomalies: async () => ({
          answer: 'Read-only analysis', intent: 'investment-analysis', citations: [], evidence: [], hasEvidence: false,
        }),
      },
    })(request('investment analysis'), viewer)

    expect(response.message.answer).toBe('Read-only analysis')
    expect(response.toolTrace).toEqual([{ name: 'findInvestmentAnomalies', status: 'ok' }])
    expect(response.draft).toBeUndefined()
  })

  it('keeps a staff mutation request non-actionable when durable draft storage is unavailable', async () => {
    const response = await createAgentGateway()(request('프로젝트 A 일정을 변경해줘'), staff)

    expect(response.draft).toBeUndefined()
    expect(response.draftAction).toEqual({ available: false, reason: 'PENDING_DRAFT_STORAGE_UNAVAILABLE' })
    expect(response.toolTrace).toEqual([{ name: 'prepareDraft', status: 'error' }])
  })

  it('allows an admin context to run the same read-only analysis', async () => {
    const response = await createAgentGateway({
      tools: {
        findInvestmentAnomalies: async () => ({
          answer: 'Admin analysis', intent: 'investment-analysis', citations: [], evidence: [], hasEvidence: false,
        }),
      },
    })(request('investment analysis'), admin)

    expect(response.message.answer).toBe('Admin analysis')
    expect(response.toolTrace).toEqual([{ name: 'findInvestmentAnomalies', status: 'ok' }])
  })

  it('blocks approval of a workbook draft whose C14 total differs from C15:C108', async () => {
    seedProject()
    const draft = await prepareInvestmentImport(staff, {
      sourceName: 'report.xlsx', projectId: 'project-1',
      transactions: [transaction(14, 500), transaction(15, 300)],
    })
    const before = localStorage.getItem('investment-dashboard.transactions.v1')

    await expect(approveAgentDraft(staff, draft)).rejects.toMatchObject({ code: 'VALIDATION_FAILED' })
    expect(localStorage.getItem('investment-dashboard.transactions.v1')).toBe(before)
  })

  it('renders approved safety citations received from the gateway', async () => {
    createAuthenticatedSession('viewer')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      message: {
        answer: 'Safety guidance', intent: 'safety-search', evidence: [], hasEvidence: true,
        citations: [{ title: 'Approved safety standard', section: 'Section 3', url: 'https://example.test/safety' }],
      },
      toolTrace: [{ name: 'safetySearch', status: 'ok' }],
    }), { status: 200, headers: { 'content-type': 'application/json' } })))

    render(<MemoryRouter><AgentPage /></MemoryRouter>)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'safety question' } })
    fireEvent.click(screen.getByRole('button'))

    expect(await screen.findByText('Safety guidance')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Approved safety standard/ })).toHaveAttribute('href', 'https://example.test/safety')
  })

  it('returns no draft or tool call when the model provider is unavailable', async () => {
    const response = await createAgentGateway({
      provider: { chooseTool: async () => { throw new Error('provider offline') } },
    })(request('investment analysis'), viewer)

    expect(response.draft).toBeUndefined()
    expect(response.toolTrace).toEqual([])
    expect(response.message.hasEvidence).toBe(false)
  })

  it('classifies explicit mutation commands separately from read-only requests', async () => {
    const gateway = createAgentGateway({
      tools: {
        findInvestmentAnomalies: async () => ({
          answer: 'Read-only result', intent: 'investment-analysis', citations: [], evidence: [], hasEvidence: false,
        }),
      },
    })

    const mutation = await gateway(request('프로젝트 A 투자비를 수정해주세요'), staff)
    const readOnly = await gateway(request('investment analysis'), staff)

    expect(mutation.draftAction).toEqual({ available: false, reason: 'PENDING_DRAFT_STORAGE_UNAVAILABLE' })
    expect(mutation.toolTrace).toEqual([{ name: 'prepareDraft', status: 'error' }])
    expect(readOnly.message.answer).toBe('Read-only result')
    expect(readOnly.draftAction).toBeUndefined()
  })
})
