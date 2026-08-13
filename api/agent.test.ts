import { describe, expect, it, vi } from 'vitest'

import { createAgentHandler } from './agent'
import type { AgentToolDataProvider } from '../src/features/agent/tools/toolContext'

function authenticatedHandler(dataProvider?: AgentToolDataProvider) {
  return createAgentHandler({
    authenticate: vi.fn(async () => ({
      userId: 'user-1',
      employeeId: 'E-100',
      role: 'staff' as const,
    })),
    dataProvider,
  })
}

describe('agent API', () => {
  it('returns a deterministic 400 for a null action payload', async () => {
    const response = await authenticatedHandler()(new Request('https://example.test/api/agent', {
      method: 'POST',
      headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
      body: JSON.stringify({
        conversation: [{ role: 'user', content: '투자비 분석' }],
        action: null,
      }),
    }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: { code: 'MALFORMED_REQUEST' } })
  })

  it('uses only the trusted user role resolved by the server dependency', async () => {
    const authenticate = vi.fn(async () => ({
      userId: 'user-1', employeeId: 'E-100', role: 'viewer' as const,
    }))
    const handler = createAgentHandler({ authenticate })

    const response = await handler(new Request('https://example.test/api/agent', {
      method: 'POST',
      headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
      body: JSON.stringify({
        conversation: [{ role: 'user', content: '초안 승인' }],
        action: { type: 'approve-draft', draftId: 'draft-1' },
        employeeId: 'forged-employee',
        role: 'admin',
      }),
    }))

    expect(authenticate).toHaveBeenCalledWith('token')
    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: { code: 'FORBIDDEN' } })
  })

  it('injects authenticated server data into the production gateway', async () => {
    const load = vi.fn(async () => ({ projects: [], transactions: [], orderToProject: {} }))
    const response = await authenticatedHandler({ load })(new Request('https://example.test/api/agent', {
      method: 'POST',
      headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
      body: JSON.stringify({ conversation: [{ role: 'user', content: 'investment analysis' }] }),
    }))

    expect(response.status).toBe(200)
    expect(load).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1', role: 'staff' }))
    const body = await response.json() as { message: { answer: string }; toolTrace: unknown[] }
    expect(body.message.answer).toContain('NO_EVIDENCE')
    expect(body.toolTrace).toEqual([{ name: 'findInvestmentAnomalies', status: 'ok' }])
  })
})
