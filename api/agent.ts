import { createClient } from '@supabase/supabase-js'

import {
  AgentGatewayError,
  createAgentGateway,
  type AgentRequest,
} from '../src/features/agent/agentGateway'
import type { AgentRole } from '../src/features/agent/agentTypes'
import {
  AgentToolDataUnavailableError,
  type AgentToolDataProvider,
} from '../src/features/agent/tools/toolContext'
import { createSupabaseAgentToolDataProvider } from '../src/features/agent/tools/supabaseToolDataProvider'

type ServerEnvironment = typeof globalThis & {
  process?: { env?: Record<string, string | undefined> }
}

type AuthenticatedAgent = {
  userId: string
  employeeId: string
  role: AgentRole
}

export interface AgentApiDependencies {
  authenticate?: (token: string) => Promise<AuthenticatedAgent>
  dataProvider?: AgentToolDataProvider
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

function statusFor(error: AgentGatewayError): number {
  if (error.code === 'UNAUTHENTICATED') return 401
  if (error.code === 'FORBIDDEN') return 403
  return 400
}

function roleFromDatabase(value: unknown): AgentRole {
  return value === 'staff' || value === 'admin' ? value : 'viewer'
}

function bearerToken(request: Request): string | undefined {
  const match = /^Bearer\s+(.+)$/i.exec(request.headers.get('authorization') ?? '')
  return match?.[1]
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function authenticateWithSupabase(token: string): Promise<AuthenticatedAgent> {
  const environment = (globalThis as ServerEnvironment).process?.env ?? {}
  const url = environment.SUPABASE_URL
  const key = environment.SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) throw new Error('AUTH_UNAVAILABLE')

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data, error } = await supabase.auth.getUser(token)
  if (error || data.user === null) throw new AgentGatewayError('UNAUTHENTICATED')

  const { data: roleRow, error: roleError } = await supabase
    .from('user_roles')
    .select('role,employee_id')
    .eq('user_id', data.user.id)
    .maybeSingle()
  if (roleError) throw new Error('ROLE_LOOKUP_UNAVAILABLE')

  return {
    userId: data.user.id,
    employeeId: typeof roleRow?.employee_id === 'string' ? roleRow.employee_id : data.user.id,
    role: roleFromDatabase(roleRow?.role),
  }
}

function serverDataProvider(token: string): AgentToolDataProvider {
  const environment = (globalThis as ServerEnvironment).process?.env ?? {}
  const url = environment.SUPABASE_URL
  const key = environment.SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) {
    return { load: async () => { throw new AgentToolDataUnavailableError() } }
  }
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  return createSupabaseAgentToolDataProvider(supabase)
}

function parseAgentRequest(value: Record<string, unknown>): AgentRequest | undefined {
  if (!Array.isArray(value.conversation) || value.conversation.length === 0 || value.conversation.length > 50) return undefined
  const conversation: AgentRequest['conversation'] = []
  for (const message of value.conversation) {
    if (!isObject(message)) return undefined
    if ((message.role !== 'user' && message.role !== 'assistant') || typeof message.content !== 'string') return undefined
    if (!message.content.trim() || message.content.length > 4_000) return undefined
    conversation.push({ role: message.role, content: message.content })
  }
  if (value.action === undefined) return { conversation }
  if (!isObject(value.action)) return undefined
  if (
    (value.action.type !== 'approve-draft' && value.action.type !== 'cancel-draft')
    || typeof value.action.draftId !== 'string'
    || !value.action.draftId.trim()
  ) return undefined
  return { conversation, action: { type: value.action.type, draftId: value.action.draftId } }
}

/** Vercel serverless entry point. Client payload never determines user identity or role. */
export function createAgentHandler(dependencies: AgentApiDependencies = {}) {
  const authenticate = dependencies.authenticate ?? authenticateWithSupabase

  return async function agent(request: Request): Promise<Response> {
    if (request.method !== 'POST') return json({ error: { code: 'METHOD_NOT_ALLOWED' } }, 405)

    const token = bearerToken(request)
    if (token === undefined) return json({ error: { code: 'UNAUTHENTICATED' } }, 401)

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return json({ error: { code: 'MALFORMED_REQUEST' } }, 400)
    }
    if (!isObject(body)) return json({ error: { code: 'MALFORMED_REQUEST' } }, 400)
    const agentRequest = parseAgentRequest(body)
    if (agentRequest === undefined) return json({ error: { code: 'MALFORMED_REQUEST' } }, 400)

    try {
      const identity = await authenticate(token)
      const handleAgentRequest = createAgentGateway({
        dataProvider: dependencies.dataProvider ?? serverDataProvider(token),
      })
      const response = await handleAgentRequest(agentRequest, {
        ...identity,
        now: new Date().toISOString(),
      })
      return json(response)
    } catch (error) {
      if (error instanceof AgentGatewayError) {
        return json({ error: { code: error.code } }, statusFor(error))
      }
      return json({ error: { code: 'AGENT_UNAVAILABLE' } }, 503)
    }
  }
}

export default createAgentHandler()
