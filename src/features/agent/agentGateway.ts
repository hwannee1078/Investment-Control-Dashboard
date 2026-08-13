import type { InvestmentTransaction } from '../../domain/investment'
import { retrieveSafetyAnswer } from '../safety/safetyKnowledge'
import type { AgentAnswer, AgentDraft, AgentIntent } from './agentTypes'
import type { AgentToolContext, AgentToolResult } from './agentToolTypes'
import {
  explainVariance,
  findInvestmentAnomalies,
  getExecutiveBriefing,
  reconcileInvestmentWorkbook,
} from './tools/investmentTools'
import { findMissingData } from './tools/scheduleTools'

export interface AgentRequest {
  conversation: Array<{ role: 'user' | 'assistant'; content: string }>
  action?: { type: 'approve-draft' | 'cancel-draft'; draftId: string }
}

export interface AgentResponse {
  message: AgentAnswer
  draft?: AgentDraft
  toolTrace: Array<{ name: string; status: 'ok' | 'error' }>
}

export type AgentToolName =
  | 'findInvestmentAnomalies'
  | 'explainVariance'
  | 'getExecutiveBriefing'
  | 'findMissingData'
  | 'reconcileInvestmentWorkbook'

type ToolInput =
  | { projectId?: string; month?: string }
  | { projectId: string; month?: string }
  | { year?: number }
  | { sourceName: string; transactions: InvestmentTransaction[] }

type AgentTool = (
  context: AgentToolContext,
  input: ToolInput,
) => Promise<AgentAnswer | AgentToolResult>

export interface AgentModelAdapter {
  chooseTool(input: {
    question: string
    registeredTools: readonly AgentToolName[]
  }): Promise<{ name: string; input?: unknown }>
}

export interface AgentDraftActions {
  approve(context: AgentToolContext, draftId: string): Promise<AgentDraft | undefined>
  cancel(draftId: string): Promise<AgentDraft | undefined>
}

export interface AgentGatewayDependencies {
  provider?: AgentModelAdapter
  tools?: Partial<Record<AgentToolName, AgentTool>>
  safetySearch?: (question: string) => Promise<AgentAnswer> | AgentAnswer
  draftActions?: AgentDraftActions
}

export class AgentGatewayError extends Error {
  constructor(readonly code: 'MALFORMED_REQUEST' | 'UNAUTHENTICATED') {
    super(code)
    this.name = 'AgentGatewayError'
  }
}

const registeredTools: readonly AgentToolName[] = [
  'findInvestmentAnomalies',
  'explainVariance',
  'getExecutiveBriefing',
  'findMissingData',
  'reconcileInvestmentWorkbook',
]

function noEvidenceAnswer(answer: string, intent: AgentIntent = 'unknown'): AgentAnswer {
  return { answer, intent, citations: [], evidence: [], hasEvidence: false }
}

function validateContext(context: AgentToolContext): void {
  if (!context.userId.trim() || !context.employeeId.trim() || !context.now.trim()) {
    throw new AgentGatewayError('UNAUTHENTICATED')
  }
}

function validateRequest(request: AgentRequest): void {
  if (!Array.isArray(request.conversation) || request.conversation.length === 0) {
    throw new AgentGatewayError('MALFORMED_REQUEST')
  }
  for (const message of request.conversation) {
    if (
      (message.role !== 'user' && message.role !== 'assistant')
      || typeof message.content !== 'string'
      || !message.content.trim()
    ) throw new AgentGatewayError('MALFORMED_REQUEST')
  }
  if (
    request.action !== undefined
    && (request.action.type !== 'approve-draft' && request.action.type !== 'cancel-draft'
      || !request.action.draftId.trim())
  ) throw new AgentGatewayError('MALFORMED_REQUEST')
}

function latestQuestion(request: AgentRequest): string {
  return [...request.conversation]
    .reverse()
    .find((message) => message.role === 'user')?.content.trim() ?? ''
}

function routeQuestion(question: string): AgentToolName | 'safetySearch' {
  if (/(안전|위험|보호구|재해|산업안전|작업허가)/.test(question)) return 'safetySearch'
  if (/(엑셀|워크북|업로드|C14|C15)/i.test(question)) return 'reconcileInvestmentWorkbook'
  if (/(일정|공정|누락|매핑)/.test(question)) return 'findMissingData'
  if (/(차이|편차|변동|분산)/.test(question)) return 'explainVariance'
  if (/(경영진|브리핑|요약)/.test(question)) return 'getExecutiveBriefing'
  return 'findInvestmentAnomalies'
}

function projectIdFrom(question: string): string {
  return /(?:project|프로젝트|사업)\s*[-:]?\s*([a-z0-9_-]+)/i.exec(question)?.[1] ?? ''
}

function monthFrom(question: string): string | undefined {
  return /\b(20\d{2}-\d{2})\b/.exec(question)?.[1]
}

function toolInput(name: AgentToolName, question: string, candidate?: unknown): ToolInput {
  const requested = typeof candidate === 'object' && candidate !== null && !Array.isArray(candidate)
    ? candidate as Record<string, unknown>
    : {}
  const projectId = typeof requested.projectId === 'string' ? requested.projectId : projectIdFrom(question)
  const month = typeof requested.month === 'string' ? requested.month : monthFrom(question)
  if (name === 'explainVariance') return { projectId, month }
  if (name === 'getExecutiveBriefing') {
    const year = typeof requested.year === 'number' && Number.isInteger(requested.year)
      ? requested.year
      : Number(/\b(20\d{2})\b/.exec(question)?.[1]) || undefined
    return { year }
  }
  if (name === 'reconcileInvestmentWorkbook') {
    const transactions = Array.isArray(requested.transactions)
      ? requested.transactions.filter(isInvestmentTransaction)
      : []
    const sourceName = typeof requested.sourceName === 'string' && requested.sourceName.trim()
      ? requested.sourceName
      : /([^\s]+\.xlsx)\b/i.exec(question)?.[1] ?? 'uploaded-workbook'
    return { sourceName, transactions }
  }
  return { projectId: projectId || undefined, month }
}

function isInvestmentTransaction(value: unknown): value is InvestmentTransaction {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const row = value as Record<string, unknown>
  return typeof row.sourceId === 'string'
    && typeof row.rowId === 'string'
    && typeof row.orderId === 'string'
    && typeof row.month === 'string'
    && typeof row.amount === 'number'
}

function toAnswer(result: AgentAnswer | AgentToolResult): { message: AgentAnswer; draft?: AgentDraft } {
  if ('errors' in result) {
    return {
      message: result.answer ?? noEvidenceAnswer(
        result.errors.map(({ code }) => `[${code}]`).join(' ') || '분석 결과가 없습니다.',
      ),
      draft: result.draft,
    }
  }
  return { message: result }
}

const defaultTools: Record<AgentToolName, AgentTool> = {
  findInvestmentAnomalies: (context, input) => findInvestmentAnomalies(
    context,
    input as { projectId?: string; month?: string },
  ),
  explainVariance: (context, input) => explainVariance(
    context,
    input as { projectId: string; month?: string },
  ),
  getExecutiveBriefing: (context, input) => getExecutiveBriefing(
    context,
    input as { year?: number },
  ),
  findMissingData: (context, input) => findMissingData(
    context,
    input as { projectId?: string },
  ),
  reconcileInvestmentWorkbook: (context, input) => reconcileInvestmentWorkbook(
    context,
    input as { sourceName: string; transactions: InvestmentTransaction[] },
  ),
}

function defaultSafetySearch(question: string): AgentAnswer {
  const safety = retrieveSafetyAnswer(question)
  return {
    answer: safety.answer,
    intent: 'safety-search',
    citations: safety.citations.map(({ title, section, page, sourceDate, url }) => ({
      title,
      section,
      page,
      sourceDate,
      url,
    })),
    evidence: [],
    hasEvidence: safety.hasEvidence,
  }
}

export function createAgentGateway(dependencies: AgentGatewayDependencies = {}) {
  const tools = { ...defaultTools, ...dependencies.tools }
  const safetySearch = dependencies.safetySearch ?? defaultSafetySearch

  return async function handleAgentRequest(
    request: AgentRequest,
    context: AgentToolContext,
  ): Promise<AgentResponse> {
    validateContext(context)
    validateRequest(request)

    if (request.action !== undefined) {
      const action = request.action.type === 'approve-draft'
        ? dependencies.draftActions?.approve(context, request.action.draftId)
        : dependencies.draftActions?.cancel(request.action.draftId)
      const draft = action === undefined ? undefined : await action
      return {
        message: draft === undefined
          ? noEvidenceAnswer('요청한 초안을 찾을 수 없습니다. 새로 분석을 요청해 주세요.')
          : noEvidenceAnswer(request.action.type === 'approve-draft' ? '초안 승인 요청을 처리했습니다.' : '초안을 취소했습니다.'),
        draft,
        toolTrace: [{ name: request.action.type === 'approve-draft' ? 'approveDraft' : 'cancelDraft', status: draft === undefined ? 'error' : 'ok' }],
      }
    }

    const question = latestQuestion(request)
    let selected: { name: string; input?: unknown }
    try {
      selected = dependencies.provider === undefined
        ? { name: routeQuestion(question) }
        : await dependencies.provider.chooseTool({ question, registeredTools })
    } catch {
      return {
        message: noEvidenceAnswer('AI 분석 서비스를 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.'),
        toolTrace: [],
      }
    }

    if (typeof selected !== 'object' || selected === null || typeof selected.name !== 'string') {
      return {
        message: noEvidenceAnswer('AI 분석 요청 형식을 확인할 수 없습니다.'),
        toolTrace: [],
      }
    }
    if (selected.name === 'safetySearch') {
      try {
        return { message: await safetySearch(question), toolTrace: [{ name: 'safetySearch', status: 'ok' }] }
      } catch {
        return { message: noEvidenceAnswer('안전 문서 분석 서비스를 일시적으로 사용할 수 없습니다.', 'safety-search'), toolTrace: [{ name: 'safetySearch', status: 'error' }] }
      }
    }
    if (!registeredTools.includes(selected.name as AgentToolName)) {
      return {
        message: noEvidenceAnswer('허용되지 않은 도구 요청은 실행할 수 없습니다.'),
        toolTrace: [{ name: selected.name, status: 'error' }],
      }
    }

    const name = selected.name as AgentToolName
    try {
      return {
        ...toAnswer(await tools[name](context, toolInput(name, question, selected.input))),
        toolTrace: [{ name, status: 'ok' }],
      }
    } catch {
      return {
        message: noEvidenceAnswer('분석 중 오류가 발생했습니다. 요청 조건을 확인한 뒤 다시 시도해 주세요.'),
        toolTrace: [{ name, status: 'error' }],
      }
    }
  }
}

export const handleAgentRequest = createAgentGateway()
