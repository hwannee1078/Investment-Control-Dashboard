import { describe, expect, it, vi } from 'vitest'

import type { AgentAnswer } from './agentTypes'
import {
  createAgentGateway,
  type AgentToolName,
} from './agentGateway'

const context = {
  userId: 'user-1',
  employeeId: 'E-100',
  role: 'viewer' as const,
  now: '2026-08-13T00:00:00.000Z',
}

function answer(intent: AgentAnswer['intent'] = 'investment-analysis'): AgentAnswer {
  return { answer: '분석 결과', intent, citations: [], evidence: [], hasEvidence: false }
}

function request(content: string) {
  return { conversation: [{ role: 'user' as const, content }] }
}

function gatewayWithTools() {
  const names: AgentToolName[] = [
    'findInvestmentAnomalies',
    'explainVariance',
    'getExecutiveBriefing',
    'findMissingData',
    'reconcileInvestmentWorkbook',
  ]
  const tools = Object.fromEntries(
    names.map((name) => [name, vi.fn(async () => answer())]),
  )
  return { gateway: createAgentGateway({ tools }), tools }
}

describe('agent gateway', () => {
  it.each([
    ['이번 달 투자비 이상 징후를 분석해줘', 'findInvestmentAnomalies'],
    ['project-1의 2026-07 투자비 차이를 설명해줘', 'explainVariance'],
    ['2026년 경영진 투자비 브리핑을 만들어줘', 'getExecutiveBriefing'],
    ['일정과 오더 매핑 누락을 확인해줘', 'findMissingData'],
    ['엑셀 C14와 C15:C108을 검증해줘', 'reconcileInvestmentWorkbook'],
  ] as const)('routes Korean request to %s', async (content, expectedTool) => {
    const { gateway, tools } = gatewayWithTools()

    const response = await gateway(request(content), context)

    expect(response.toolTrace).toEqual([{ name: expectedTool, status: 'ok' }])
    expect(tools[expectedTool]).toHaveBeenCalledOnce()
  })

  it('rejects malformed conversations before calling a tool', async () => {
    const { gateway, tools } = gatewayWithTools()

    await expect(gateway({ conversation: [{ role: 'user', content: '   ' }] }, context))
      .rejects.toMatchObject({ code: 'MALFORMED_REQUEST' })

    expect(Object.values(tools).every((tool) => tool.mock.calls.length === 0)).toBe(true)
  })

  it('rejects requests without an authenticated tool context', async () => {
    const { gateway } = gatewayWithTools()

    await expect(gateway(request('투자비 분석'), { ...context, userId: '' }))
      .rejects.toMatchObject({ code: 'UNAUTHENTICATED' })
  })

  it('prevents provider output from invoking an unregistered tool', async () => {
    const unregistered = vi.fn()
    const gateway = createAgentGateway({
      provider: { chooseTool: async () => ({ name: 'delete-all-data' }) },
      tools: { findInvestmentAnomalies: unregistered },
    })

    const response = await gateway(request('투자비 분석'), context)

    expect(response.toolTrace).toEqual([{ name: 'delete-all-data', status: 'error' }])
    expect(response.message.answer).toContain('허용되지 않은')
    expect(unregistered).not.toHaveBeenCalled()
  })

  it('returns a Korean safe fallback when the provider is unavailable', async () => {
    const gateway = createAgentGateway({
      provider: { chooseTool: async () => { throw new Error('provider offline') } },
    })

    const response = await gateway(request('투자비 분석'), context)

    expect(response.message.answer).toContain('일시적으로')
    expect(response.draft).toBeUndefined()
    expect(response.toolTrace).toEqual([])
  })

  it('keeps approved safety citations in the response', async () => {
    const gateway = createAgentGateway({
      safetySearch: async () => ({
        answer: '승인 문서 기반 답변',
        intent: 'safety-search',
        hasEvidence: true,
        evidence: [],
        citations: [{ title: '안전 문서', section: '3장', url: 'https://example.test/safety' }],
      }),
    })

    const response = await gateway(request('작업 전 안전 점검은 무엇인가요?'), context)

    expect(response.message.citations).toEqual([
      expect.objectContaining({ title: '안전 문서', section: '3장' }),
    ])
    expect(response.toolTrace).toEqual([{ name: 'safetySearch', status: 'ok' }])
  })
})
