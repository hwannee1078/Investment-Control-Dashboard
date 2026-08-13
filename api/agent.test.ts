import { describe, expect, it, vi } from 'vitest'

import { createAgentHandler } from './agent'

function authenticatedHandler() {
  return createAgentHandler({
    authenticate: vi.fn(async () => ({
      userId: 'user-1',
      employeeId: 'E-100',
      role: 'staff' as const,
    })),
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
})
