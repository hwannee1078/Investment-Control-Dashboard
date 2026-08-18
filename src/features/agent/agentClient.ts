import { isSupabaseConfigured, supabase } from '../../services/supabaseClient'
import type { AgentRequest, AgentResponse } from './agentGateway'
import { isOfflineMode, offlineApiBaseUrl, offlineAuthHeaders } from '../../services/runtimeConfig'

async function apiHeaders(): Promise<HeadersInit> {
  if (isOfflineMode) return { 'content-type': 'application/json', ...offlineAuthHeaders() }
  if (!isSupabaseConfigured || !supabase) return { 'content-type': 'application/json' }
  const { data } = await supabase.auth.getSession()
  return {
    'content-type': 'application/json',
    ...(data.session?.access_token ? { authorization: `Bearer ${data.session.access_token}` } : {}),
  }
}

export async function requestAgent(payload: AgentRequest): Promise<AgentResponse> {
  const endpoint = isOfflineMode ? `${offlineApiBaseUrl}/agent` : '/api/agent'
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: await apiHeaders(),
    body: JSON.stringify(payload),
  })
  const data = await response.json() as AgentResponse & { error?: { code?: string } }
  if (!response.ok || data.error?.code) throw new Error(data.error?.code ?? 'AGENT_UNAVAILABLE')
  return data
}
