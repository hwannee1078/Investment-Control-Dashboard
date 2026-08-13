# Investment Dashboard AI Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a role-aware, tool-calling AI Agent that analyzes investment and schedule data, validates uploaded workbooks, answers approved safety questions, and creates user-approved work drafts without direct AI writes.

**Architecture:** Keep deterministic investment calculations and authorization in TypeScript domain tools. Add a server-side Agent gateway that authenticates the Supabase session, exposes only typed tools, and returns either an answer with evidence or a draft action. The React floating chatbot and `/agent` page consume the gateway; draft persistence and audit logging occur only after an explicit user approval.

**Tech Stack:** React + TypeScript + Vite, Vitest + Testing Library, Supabase Auth/Postgres/RLS, existing `xlsx` parser, Vercel serverless function, provider-neutral structured tool-calling adapter.

## Global Constraints

- AI may not write directly to Supabase tables; all mutations go through typed application tools.
- Initial release supports analysis and draft creation; persistence requires explicit user confirmation.
- `viewer` can analyze only; `staff` can save approved drafts; `admin` can perform all existing management actions.
- Investment validation must preserve the existing rules: monthly actuals use Excel `C14`, detail reconciliation uses `C15:C108`, multiple order IDs aggregate by project and month, and negative adjustments are valid.
- Safety answers may use only approved safety documents and must include citation metadata or state that no approved evidence was found.
- Do not add a second independent data store for projects or investment transactions; reuse repositories and cloud sync patterns.
- Every persisted Agent action must create an audit record.

---

### Task 1: Define Agent contracts and deterministic tool result types

**Files:**
- Create: `src/features/agent/agentTypes.ts`
- Create: `src/features/agent/agentToolTypes.ts`
- Test: `src/features/agent/agentTypes.test.ts`

**Interfaces:**
- `AgentIntent = 'investment-analysis' | 'schedule-analysis' | 'workbook-validation' | 'safety-search' | 'unknown'`
- `AgentRole = 'viewer' | 'staff' | 'admin'`
- `AgentCitation = { title: string; section?: string; page?: number; sourceDate?: string; url: string }`
- `AgentEvidence = { label: string; value: string; source: string }`
- `AgentAnswer = { answer: string; intent: AgentIntent; citations: AgentCitation[]; evidence: AgentEvidence[]; hasEvidence: boolean }`
- `AgentDraft = { id: string; kind: 'investment-import' | 'schedule-update'; projectId: string; summary: string; changes: Array<{ field: string; before: unknown; after: unknown }>; validations: Array<{ code: string; passed: boolean; message: string }>; status: 'pending' | 'approved' | 'cancelled' }`
- `AgentToolContext = { userId: string; employeeId: string; role: AgentRole; now: string }`
- `AgentToolResult = { answer?: AgentAnswer; draft?: AgentDraft; errors: Array<{ code: string; message: string; recoverable: boolean }> }`

- [ ] **Step 1: Write failing type-level and runtime tests**

  Add tests asserting that answers can represent citations, drafts expose before/after values, and a failed validation cannot be represented as passed.

- [ ] **Step 2: Run the focused test**

  Run: `npm test -- --run src/features/agent/agentTypes.test.ts`
  Expected: FAIL because the new contracts do not exist.

- [ ] **Step 3: Implement the contracts**

  Add the discriminated unions and result shapes above. Keep the types independent of React and Supabase so tools and the API can share them.

- [ ] **Step 4: Run the focused test**

  Run: `npm test -- --run src/features/agent/agentTypes.test.ts`
  Expected: PASS.

- [ ] **Step 5: Commit**

  Run: `git add src/features/agent/agentTypes.ts src/features/agent/agentToolTypes.ts src/features/agent/agentTypes.test.ts && git commit -m "feat: define AI agent contracts"`

### Task 2: Implement the five deterministic analysis tools

**Files:**
- Create: `src/features/agent/tools/investmentTools.ts`
- Create: `src/features/agent/tools/scheduleTools.ts`
- Create: `src/features/agent/tools/toolContext.ts`
- Test: `src/features/agent/tools/investmentTools.test.ts`
- Test: `src/features/agent/tools/scheduleTools.test.ts`
- Modify: `src/data/investmentRepository.ts` only where a read-only query helper is missing
- Modify: `src/data/projectRepository.ts` only where a read-only query helper is missing

**Interfaces:**
- `findInvestmentAnomalies(context: AgentToolContext, options?: { projectId?: string; month?: string }): Promise<AgentAnswer>`
- `explainVariance(context: AgentToolContext, input: { projectId: string; month?: string }): Promise<AgentAnswer>`
- `getExecutiveBriefing(context: AgentToolContext, input?: { year?: number }): Promise<AgentAnswer>`
- `findMissingData(context: AgentToolContext, options?: { projectId?: string }): Promise<AgentAnswer>`
- `reconcileInvestmentWorkbook(context: AgentToolContext, input: { transactions: InvestmentTransaction[]; sourceName: string }): Promise<AgentToolResult>`

- [ ] **Step 1: Write failing tests for known domain rules**

  Cover: a sudden month-over-month change is reported; an approval-budget overrun is reported; plan/actual variance includes the stored reason; missing schedule or order mappings are reported; `C14` mismatch fails reconciliation; a negative adjustment remains valid; viewer context can run all five tools but cannot create a draft.

- [ ] **Step 2: Run focused tests and confirm failures**

  Run: `npm test -- --run src/features/agent/tools/investmentTools.test.ts src/features/agent/tools/scheduleTools.test.ts`
  Expected: FAIL because the tool functions do not exist.

- [ ] **Step 3: Implement read-only repository adapters**

  Read projects, mappings, transactions, schedules, approval budgets, rolling plans, and finalization state through existing repository/cloud-hydrated data. Do not mutate localStorage or Supabase from these functions.

- [ ] **Step 4: Implement the five tools**

  Reuse existing aggregation logic for monthly and cumulative values. Return stable codes for `BUDGET_EXCEEDED`, `MONTHLY_SPIKE`, `MISSING_MAPPING`, `MISSING_SCHEDULE`, `DETAIL_SUM_MISMATCH`, and `NO_EVIDENCE` instead of embedding error text in calculations.

- [ ] **Step 5: Run focused tests**

  Run: `npm test -- --run src/features/agent/tools/investmentTools.test.ts src/features/agent/tools/scheduleTools.test.ts`
  Expected: PASS.

- [ ] **Step 6: Commit**

  Run: `git add src/features/agent/tools src/data/investmentRepository.ts src/data/projectRepository.ts && git commit -m "feat: add deterministic investment agent tools"`

### Task 3: Add draft generation and explicit approval persistence

**Files:**
- Create: `src/features/agent/drafts/agentDraftService.ts`
- Create: `src/features/agent/drafts/agentDraftService.test.ts`
- Create: `supabase/agent-audit-schema.sql`
- Modify: `src/services/cloudSync.ts` to sync audit rows only after an approved action
- Modify: existing project/investment repositories through their public mutation methods, not direct storage writes

**Interfaces:**
- `prepareInvestmentImport(context: AgentToolContext, input: { sourceName: string; transactions: InvestmentTransaction[]; projectId: string }): Promise<AgentDraft>`
- `prepareScheduleUpdate(context: AgentToolContext, input: { projectId: string; stage: ProjectStage; actual: string; reason?: string | null }): Promise<AgentDraft>`
- `approveAgentDraft(context: AgentToolContext, draft: AgentDraft): Promise<{ auditId: string; saved: true }>`
- `cancelAgentDraft(draftId: string): void`

- [ ] **Step 1: Write failing tests for approval boundaries**

  Assert that a viewer receives `FORBIDDEN`; staff can approve valid investment and schedule drafts; invalid reconciliation blocks approval; cancellation leaves repositories unchanged; approval records before/after values.

- [ ] **Step 2: Run focused tests**

  Run: `npm test -- --run src/features/agent/drafts/agentDraftService.test.ts`
  Expected: FAIL because draft service and schema do not exist.

- [ ] **Step 3: Add the audit schema**

  Create an `agent_audit_logs` table with `id`, `user_id`, `employee_id`, `role`, `question`, `tool_name`, `target_project_id`, `before_data`, `after_data`, `approved`, `result_code`, and `created_at`; enable RLS so authenticated users can insert their own records and admins can read all records.

- [ ] **Step 4: Implement draft preparation and approval**

  Draft preparation must call the deterministic validation tools. Approval re-checks role and validations, calls existing repository mutation methods, then persists the audit record. No mutation occurs in preparation or cancellation.

- [ ] **Step 5: Run focused tests**

  Run: `npm test -- --run src/features/agent/drafts/agentDraftService.test.ts`
  Expected: PASS.

- [ ] **Step 6: Commit**

  Run: `git add src/features/agent/drafts src/services/cloudSync.ts supabase/agent-audit-schema.sql && git commit -m "feat: add approved agent drafts and audit logs"`

### Task 4: Build the server-side Agent gateway

**Files:**
- Create: `api/agent.ts`
- Create: `src/features/agent/agentGateway.ts`
- Create: `src/features/agent/agentGateway.test.ts`
- Modify: `package.json` only if a server-side structured-generation SDK is required by the selected provider
- Create: `.env.example` entries for the provider key and model name without real secrets

**Interfaces:**
- `handleAgentRequest(request: AgentRequest, context: AgentToolContext): Promise<AgentResponse>`
- `AgentRequest = { conversation: Array<{ role: 'user' | 'assistant'; content: string }>; action?: { type: 'approve-draft' | 'cancel-draft'; draftId: string } }`
- `AgentResponse = { message: AgentAnswer; draft?: AgentDraft; toolTrace: Array<{ name: string; status: 'ok' | 'error' }> }`

- [ ] **Step 1: Write failing gateway tests**

  Cover intent routing to each of the five tools, malformed input rejection, unauthenticated request rejection, and the rule that model output cannot invoke an unregistered tool.

- [ ] **Step 2: Run focused tests**

  Run: `npm test -- --run src/features/agent/agentGateway.test.ts`
  Expected: FAIL because the gateway does not exist.

- [ ] **Step 3: Implement provider-neutral tool routing**

  Parse the authenticated Supabase session in `api/agent.ts`, construct `AgentToolContext`, register only the five analysis tools plus draft/approval tools, and use structured tool calls. Keep the model adapter behind `agentGateway.ts` so the UI does not depend on a provider SDK.

- [ ] **Step 4: Add safe fallback behavior**

  If the model or provider is unavailable, return a Korean error explaining that analysis is temporarily unavailable and expose no mutation path. If a safety query is routed, call the existing approved-document retrieval function and preserve citations.

- [ ] **Step 5: Run focused tests**

  Run: `npm test -- --run src/features/agent/agentGateway.test.ts`
  Expected: PASS.

- [ ] **Step 6: Commit**

  Run: `git add api/agent.ts src/features/agent/agentGateway.ts src/features/agent/agentGateway.test.ts .env.example package.json package-lock.json && git commit -m "feat: add role-aware agent gateway"`

### Task 5: Add the Agent UI and integrate the existing floating chatbot

**Files:**
- Create: `src/features/agent/AgentPage.tsx`
- Create: `src/features/agent/AgentPage.test.tsx`
- Create: `src/features/agent/AgentComposer.tsx`
- Create: `src/features/agent/AgentDraftCard.tsx`
- Modify: `src/features/safety/FloatingSafetyChatbot.tsx` to call the unified gateway while preserving safety citations
- Modify: `src/components/AppLayout.tsx` to label the floating character as the integrated 업무 Agent
- Modify: `src/App.tsx` to add protected `/agent` route
- Modify: `src/styles/app.css` for responsive chat, draft cards, loading, and error states

**Interfaces:**
- `AgentComposer` emits `onSubmit(question: string)` and renders loading/error states.
- `AgentDraftCard` emits `onApprove()` and `onCancel()` and never calls repositories directly.

- [ ] **Step 1: Write failing UI tests**

  Assert that a user can open the floating Agent, submit a Korean question, see an answer with evidence, see a draft card for a write request, approve/cancel it, and that a viewer does not see save controls.

- [ ] **Step 2: Run focused UI tests**

  Run: `npm test -- --run src/features/agent/AgentPage.test.tsx`
  Expected: FAIL because the route and components do not exist.

- [ ] **Step 3: Implement the Agent page and draft card**

  Use a small conversation state in the page, call `/api/agent`, render answer evidence and tool trace status, and render draft cards with explicit approval buttons. Keep all visible copy Korean.

- [ ] **Step 4: Integrate the floating chatbot**

  Replace direct `retrieveSafetyAnswer` submission with the gateway call. Preserve the compact character button, make the panel keyboard accessible, and show a link to `/agent` for full-screen analysis.

- [ ] **Step 5: Add route and responsive styling**

  Add `/agent` inside the authenticated layout. Ensure mobile widths do not create horizontal scrolling and draft cards remain readable.

- [ ] **Step 6: Run focused UI tests**

  Run: `npm test -- --run src/features/agent/AgentPage.test.tsx src/app-flow.test.tsx`
  Expected: PASS.

- [ ] **Step 7: Commit**

  Run: `git add src/features/agent src/features/safety/FloatingSafetyChatbot.tsx src/components/AppLayout.tsx src/App.tsx src/styles/app.css && git commit -m "feat: add integrated AI agent experience"`

### Task 6: End-to-end verification and gstack review preparation

**Files:**
- Modify: `src/App.test.tsx` and `src/app-flow.test.tsx` for the protected `/agent` route and role behavior
- Create: `src/features/agent/agent.e2e.test.tsx`
- Modify: `docs/INVESTMENT-DASHBOARD-SERVICE.md` with Agent usage, environment variables, and approval rules

- [ ] **Step 1: Add end-to-end scenarios**

  Cover viewer analysis, staff draft approval, admin access, workbook mismatch blocking, safety citation rendering, and provider-unavailable fallback.

- [ ] **Step 2: Run the full test suite**

  Run: `npm test -- --run`
  Expected: all existing tests plus Agent tests pass.

- [ ] **Step 3: Run the production build**

  Run: `npm run build`
  Expected: TypeScript and Vite build complete successfully.

- [ ] **Step 4: Verify the deployed flow**

  Start the local Vite/Vercel-compatible server, log in as viewer and staff test accounts, verify `/dashboard`, `/agent`, `/safety`, and draft approval behavior on desktop and mobile widths.

- [ ] **Step 5: Run gstack engineering and code review**

  After implementation, run `/plan-eng-review` against this plan and `/review` against the final diff. Resolve any findings related to authorization, direct model writes, RLS, or secret exposure before deployment.

- [ ] **Step 6: Commit documentation and verification updates**

  Run: `git add src/App.test.tsx src/app-flow.test.tsx src/features/agent/agent.e2e.test.tsx docs/INVESTMENT-DASHBOARD-SERVICE.md && git commit -m "test: verify AI agent workflows"`

