import { describe, expect, it } from 'vitest'

import './agentTypes'
import type { AgentAnswer, AgentDraft } from './agentTypes'

describe('agent contracts', () => {
  it('allows answers to carry source citations', () => {
    const answer: AgentAnswer = {
      answer: 'The project is within budget.',
      intent: 'investment-analysis',
      citations: [
        {
          title: 'Investment plan',
          section: 'Budget summary',
          page: 2,
          sourceDate: '2026-08-13',
          url: 'https://example.com/investment-plan',
        },
      ],
      evidence: [],
      hasEvidence: true,
    }

    expect(answer.citations).toEqual([
      expect.objectContaining({
        title: 'Investment plan',
        url: 'https://example.com/investment-plan',
      }),
    ])
  })

  it('keeps draft changes with before and after values', () => {
    const draft: AgentDraft = {
      id: 'draft-1',
      kind: 'investment-import',
      projectId: 'project-1',
      summary: 'Update investment budget.',
      changes: [{ field: 'budget', before: 100, after: 125 }],
      validations: [{ code: 'budget-valid', passed: true, message: 'Budget is valid.' }],
      status: 'pending',
    }

    expect(draft.changes).toContainEqual({ field: 'budget', before: 100, after: 125 })
  })

  it('marks a failed validation as not passed', () => {
    const draft: AgentDraft = {
      id: 'draft-2',
      kind: 'schedule-update',
      projectId: 'project-1',
      summary: 'Update schedule.',
      changes: [],
      validations: [
        { code: 'end-before-start', passed: false, message: 'End date must follow start date.' },
      ],
      status: 'pending',
    }

    expect(draft.validations[0].passed).toBe(false)
  })
})
