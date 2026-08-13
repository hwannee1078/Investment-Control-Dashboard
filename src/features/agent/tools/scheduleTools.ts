import { PROJECT_STAGES } from '../../../domain/project'
import type { AgentAnswer, AgentEvidence } from '../agentTypes'
import type { AgentToolContext } from '../agentToolTypes'
import {
  createBrowserAgentToolDataProvider,
  type AgentToolDataProvider,
} from './toolContext'

function answer(text: string, evidence: AgentEvidence[]): AgentAnswer {
  return {
    answer: text,
    intent: 'schedule-analysis',
    citations: [{ title: '투자비 대시보드', url: 'local://investment-dashboard' }],
    evidence,
    hasEvidence: evidence.length > 0,
  }
}

export async function findMissingData(
  context: AgentToolContext,
  options: { projectId?: string } = {},
  dataProvider: AgentToolDataProvider = createBrowserAgentToolDataProvider(),
): Promise<AgentAnswer> {
  const data = await dataProvider.load(context)
  const projects = data.projects.filter((project) =>
    options.projectId === undefined || project.id === options.projectId,
  )
  if (projects.length === 0) {
    return answer('[NO_EVIDENCE] 요청한 사업 데이터를 찾지 못했습니다.', [])
  }

  const findings: string[] = []
  const evidence: AgentEvidence[] = []
  for (const project of projects) {
    const hasSchedule = PROJECT_STAGES.some((stage) => {
      const item = project.schedule[stage]
      return item.plan !== null || item.actual !== null
    })
    if (!hasSchedule) {
      findings.push(`[MISSING_SCHEDULE] ${project.name}: 등록된 일정이 없습니다.`)
      evidence.push({ label: `${project.name} 일정`, value: '미등록', source: '대시보드 저장 데이터' })
    }
  }

  for (const row of data.transactions) {
    if (options.projectId !== undefined && data.orderToProject[row.orderId] !== options.projectId) {
      continue
    }
    if (data.orderToProject[row.orderId] === undefined) {
      findings.push(`[MISSING_MAPPING] 오더 ${row.orderId}: 사업 매핑이 없습니다.`)
      evidence.push({ label: '미매핑 오더', value: row.orderId, source: row.sourceId })
    }
  }

  return findings.length === 0
    ? answer('[NO_EVIDENCE] 선택한 범위에서 누락된 데이터가 없습니다.', [])
    : answer(findings.join('\n'), evidence)
}
