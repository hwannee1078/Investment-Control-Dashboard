import { describe, expect, it } from 'vitest'

import { PROJECT_STAGES } from './project'
import { SAMPLE_PROJECTS } from './sampleData'

describe('project domain', () => {
  it('defines the five supported project stages in workflow order', () => {
    expect(PROJECT_STAGES).toEqual([
      '사업승인',
      '토건착공',
      '기전착공',
      '준공(시운전완료)',
      'SOP',
    ])
  })

  it('starts every sample project with null plan and actual schedule cells', () => {
    expect(SAMPLE_PROJECTS).toHaveLength(4)

    for (const project of SAMPLE_PROJECTS) {
      expect(Object.keys(project.schedule)).toEqual(PROJECT_STAGES)
      expect(Object.values(project.schedule)).toEqual(
        PROJECT_STAGES.map(() => ({ plan: null, actual: null, actualReason: null })),
      )
    }
  })
})
