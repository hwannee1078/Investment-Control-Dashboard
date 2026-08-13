import { isSupabaseConfigured, supabase } from '../../services/supabaseClient'
import type { AgentRequest, AgentResponse } from './agentGateway'

async function apiHeaders(): Promise<HeadersInit> {
  if (!isSupabaseConfigured || !supabase) return { 'content-type': 'application/json' }
  const { data } = await supabase.auth.getSession()
  return {
    'content-type': 'application/json',
    ...(data.session?.access_token ? { authorization: `Bearer ${data.session.access_token}` } : {}),
  }
}

export async function requestAgent(payload: AgentRequest): Promise<AgentResponse> {
  const response = await fetch('/api/agent', {
    method: 'POST',
    headers: await apiHeaders(),
    body: JSON.stringify(payload),
  })
  const data = await response.json() as AgentResponse & { error?: { code?: string } }
  if (!response.ok || data.error?.code) throw new Error(data.error?.code ?? 'AGENT_UNAVAILABLE')
  return data
}
