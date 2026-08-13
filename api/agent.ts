import { createClient } from '@supabase/supabase-js'

import {
  AgentGatewayError,
  handleAgentRequest,
  type AgentRequest,
} from '../src/features/agent/agentGateway'
import type { AgentRole } from '../src/features/agent/agentTypes'

type ServerEnvironment = typeof globalThis & {
  process?: { env?: Record<string, string | undefined> }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

function agentRole(value: unknown): AgentRole {
  return value === 'staff' || value === 'admin' || value === 'viewer' ? value : 'viewer'
}

function bearerToken(request: Request): string | undefined {
  const match = /^Bearer\s+(.+)$/i.exec(request.headers.get('authorization') ?? '')
  return match?.[1]
}

function isAgentRequest(value: unknown): value is AgentRequest {
  return typeof value === 'object' && value !== null && 'conversation' in value
}

/** Vercel serverless entry point. The browser never supplies role or user identity. */
export default async function agent(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: { code: 'METHOD_NOT_ALLOWED' } }, 405)

  const token = bearerToken(request)
  if (token === undefined) return json({ error: { code: 'UNAUTHENTICATED' } }, 401)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: { code: 'MALFORMED_REQUEST' } }, 400)
  }
  if (!isAgentRequest(body)) return json({ error: { code: 'MALFORMED_REQUEST' } }, 400)

  const environment = (globalThis as ServerEnvironment).process?.env ?? {}
  const url = environment.SUPABASE_URL ?? environment.VITE_SUPABASE_URL
  const key = environment.SUPABASE_PUBLISHABLE_KEY ?? environment.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) return json({ error: { code: 'AUTH_UNAVAILABLE' } }, 503)

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await supabase.auth.getUser(token)
  if (error || data.user === null) return json({ error: { code: 'UNAUTHENTICATED' } }, 401)

  const user = data.user
  const employeeId = typeof user.user_metadata.employee_id === 'string'
    ? user.user_metadata.employee_id
    : user.email ?? user.id
  const role = agentRole(user.app_metadata.role ?? user.user_metadata.role)

  try {
    const response = await handleAgentRequest(body, {
      userId: user.id,
      employeeId,
      role,
      now: new Date().toISOString(),
    })
    return json(response)
  } catch (error) {
    if (error instanceof AgentGatewayError) {
      return json({ error: { code: error.code } }, error.code === 'UNAUTHENTICATED' ? 401 : 400)
    }
    return json({ error: { code: 'AGENT_UNAVAILABLE' } }, 503)
  }
}
