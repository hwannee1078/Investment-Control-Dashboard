# 전체 화면 플로팅 안전 챗봇 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a shared floating safety chatbot that opens from every authenticated screen and reuses the approved-document retrieval flow.

**Architecture:** Render one `FloatingSafetyChatbot` inside the protected layout so it is shared by all authenticated routes. Keep retrieval client-side through `retrieveSafetyAnswer`, with citations and the existing safety disclaimer.

**Tech Stack:** React, TypeScript, React Router, existing CSS, Vitest.

## Global Constraints

- Korean UI copy.
- Do not expose the chatbot on the login screen.
- Keep answers grounded in approved safety documents.
- Preserve mobile usability and avoid horizontal scrolling.

### Task 1: Shared chatbot component

**Files:**
- Create: `src/features/safety/FloatingSafetyChatbot.tsx`
- Modify: `src/components/AppLayout.tsx`
- Modify: `src/styles/app.css`
- Test: `src/features/safety/FloatingSafetyChatbot.test.tsx`

- [ ] Add collapsed character button with accessible label.
- [ ] Add open panel with natural-language input, submit action, answer, citations, close action.
- [ ] Use the same approved-document retrieval function as `/safety`.
- [ ] Add responsive bottom-sheet behavior on narrow screens.
- [ ] Test open/close, question submission, evidence citation, and no-evidence response.

### Task 2: Verification and deployment

- [ ] Run `npm test -- --run`.
- [ ] Run `npm run build`.
- [ ] Push and deploy to Vercel.
- [ ] Verify `/dashboard`, `/manage`, `/import`, and `/safety` remain accessible.
