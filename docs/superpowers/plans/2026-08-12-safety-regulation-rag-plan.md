# 안전규정 RAG 챗봇 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a demo-ready Korean safety regulation tab with approved document upload, source-grounded keyword retrieval, citations, and role-aware controls.

**Architecture:** Reuse the existing React Router and Supabase authentication context. Store demo documents and chunks through a small safety knowledge service abstraction, with local fallback data for preview and a future Supabase vector-search adapter boundary.

**Tech Stack:** React, TypeScript, React Router, Supabase JS, Vite, Vitest.

## Global Constraints

- All UI text is Korean.
- Only approved documents appear in user search results.
- Answers must show source title, section/page metadata, source date, and URL.
- Do not present generated text as legal advice; show the safety/legal review notice.
- Preserve existing dashboard, import, manage, authentication, and mobile layouts.

---

### Task 1: Safety knowledge domain and retrieval service

**Files:**
- Create: `src/features/safety/safetyTypes.ts`
- Create: `src/features/safety/safetyKnowledge.ts`
- Test: `src/features/safety/safetyKnowledge.test.ts`

- [ ] Define document, chunk, citation, and answer types.
- [ ] Add approved demo documents for the four official source groups.
- [ ] Implement normalized Korean keyword retrieval over approved chunks only.
- [ ] Return citations and an explicit no-evidence response when nothing matches.
- [ ] Add tests for approval filtering, keyword matching, citation metadata, and no-match behavior.

### Task 2: Safety regulation screen and route

**Files:**
- Create: `src/features/safety/SafetyRegulationPage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles/app.css`

- [ ] Add a `안전규정` navigation item for authenticated users.
- [ ] Add question input, example questions, loading state, answer panel, citations, source date, and legal/safety notice.
- [ ] Add responsive layout that works on mobile without horizontal scrolling.
- [ ] Add route `/safety` and preserve direct-link Vercel fallback behavior.

### Task 3: Role-aware document management demo

**Files:**
- Modify: `src/features/safety/SafetyRegulationPage.tsx`
- Modify: `src/styles/app.css`
- Test: `src/features/safety/SafetyRegulationPage.test.tsx`

- [ ] Show document management controls only to 관리자 and 실무담당자 roles.
- [ ] Allow 관리자 to mark a demo document approved or pending.
- [ ] Allow 실무담당자 to submit a document title/source/URL for review without making it searchable.
- [ ] Keep 조회 전용 users limited to search and citations.
- [ ] Test role visibility and pending-document exclusion.

### Task 4: Verification and deployment

**Files:**
- No additional source files.

- [ ] Run `npm test -- --run`.
- [ ] Run `npm run build`.
- [ ] Verify `/safety` and `/login` return 200 in the production deployment after pushing.
- [ ] Commit implementation and push `main` so Vercel deploys the feature.
