export const PROJECT_STAGES = [
  '사업승인',
  '토건착공',
  '기전착공',
  '준공(시운전완료)',
  'SOP',
] as const

export type ProjectStage = (typeof PROJECT_STAGES)[number]

export type ProjectSchedule = Record<
  ProjectStage,
  { plan: string | null; actual: string | null }
>

export type Project = {
  id: string
  name: string
  location: string
  material: '양극재' | '음극재'
  status: ProjectStage
  schedule: ProjectSchedule
  approvalBudget: number | null
  orderIds: string[]
}

export function createEmptySchedule(): ProjectSchedule {
  return {
    사업승인: { plan: null, actual: null },
    토건착공: { plan: null, actual: null },
    기전착공: { plan: null, actual: null },
    '준공(시운전완료)': { plan: null, actual: null },
    SOP: { plan: null, actual: null },
  }
}
