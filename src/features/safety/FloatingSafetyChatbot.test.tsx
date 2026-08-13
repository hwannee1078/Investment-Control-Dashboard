import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import FloatingSafetyChatbot from './FloatingSafetyChatbot'

afterEach(() => vi.unstubAllGlobals())

describe('FloatingSafetyChatbot', () => {
  it('opens the integrated Agent and preserves gateway safety citations', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      message: {
        answer: '승인된 작업허가서를 확인한 뒤 작업을 시작하세요.',
        intent: 'safety-search',
        evidence: [],
        hasEvidence: true,
        citations: [{ title: '작업허가 안전지침', section: '작업 전 점검', url: 'https://example.test/safety' }],
      },
      toolTrace: [{ name: 'safetySearch', status: 'ok' }],
    }), { status: 200, headers: { 'content-type': 'application/json' } })))

    render(<MemoryRouter><FloatingSafetyChatbot /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'AI Agent 열기' }))
    fireEvent.change(screen.getByLabelText('Agent 질문'), { target: { value: '작업허가서 확인 방법은?' } })
    fireEvent.click(screen.getByRole('button', { name: '질문' }))

    expect(await screen.findByText('승인된 작업허가서를 확인한 뒤 작업을 시작하세요.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '작업허가 안전지침 · 작업 전 점검' })).toHaveAttribute('href', 'https://example.test/safety')
    expect(fetch).toHaveBeenCalledWith('/api/agent', expect.objectContaining({ method: 'POST' }))
  })
})
