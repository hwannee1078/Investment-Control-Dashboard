import { isSupabaseConfigured, supabase } from '../../services/supabaseClient'
import type { AgentRequest, AgentResponse } from './agentGateway'
import { createAgentGateway } from './agentGateway'
import { createBrowserAgentToolDataProvider } from './tools/toolContext'
import { getSessionRole } from '../auth/authStore'
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
  // The public prototype can run without Supabase. In that mode, use the same
  // read-only gateway against the dashboard data already loaded in localStorage.
  // A configured Supabase deployment always uses the authenticated server API.
  if (!isOfflineMode && !isSupabaseConfigured && import.meta.env.MODE !== 'test') {
    const gateway = createAgentGateway({ dataProvider: createBrowserAgentToolDataProvider() })
    return gateway(payload, {
      userId: 'prototype-session',
      employeeId: 'prototype',
      role: getSessionRole(),
      now: new Date().toISOString(),
    })
  }
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
