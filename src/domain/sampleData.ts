import { createEmptySchedule, type Project } from './project'

export const SAMPLE_PROJECTS: Project[] = [
  {
    id: 'project-pohang-cathode-1',
    name: '포항 양극재 1단계 증설',
    location: '경북 포항',
    material: '양극재',
    status: '기전착공',
    schedule: createEmptySchedule(),
    approvalBudget: 850_000_000_000,
    orderIds: [],
  },
  {
    id: 'project-gwangyang-cathode-5',
    name: '광양 양극재 5단계 신설',
    location: '전남 광양',
    material: '양극재',
    status: '토건착공',
    schedule: createEmptySchedule(),
    approvalBudget: 1_240_000_000_000,
    orderIds: [],
  },
  {
    id: 'project-pohang-anode-2',
    name: '포항 천연흑연 음극재 2공장',
    location: '경북 포항',
    material: '음극재',
    status: '사업승인',
    schedule: createEmptySchedule(),
    approvalBudget: 420_000_000_000,
    orderIds: [],
  },
  {
    id: 'project-sejong-anode-expansion',
    name: '세종 음극재 생산라인 증설',
    location: '세종특별자치시',
    material: '음극재',
    status: 'SOP',
    schedule: createEmptySchedule(),
    approvalBudget: 310_000_000_000,
    orderIds: [],
  },
]
