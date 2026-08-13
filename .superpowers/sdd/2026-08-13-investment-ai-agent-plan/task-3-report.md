# Task 3 Report — Agent Draft Approval and Audit Persistence

## Implemented

- Added draft preparation for reconciled investment imports and schedule actual-date updates. Preparation uses the deterministic reconciliation tool and read-only Agent data access; it does not mutate repositories.
- Added explicit approval boundaries: viewers receive `FORBIDDEN`; cancelled drafts and drafts with failed validation cannot persist; staff and admins can approve valid drafts.
- Approval applies changes only through `InvestmentRepository` and `ProjectRepository` public mutation methods, then stores an approved audit record containing the draft's before/after values.
- Added local audit staging and Supabase sync for approved audit records only.
- Added the `agent_audit_logs` SQL schema with required fields and RLS policies for own-record insertion/read plus admin-wide read access.

## Test coverage

- Viewer approval rejection with unchanged storage and no audit row.
- Valid staff investment approval with an audit record containing before/after data.
- C14/C15:C108 reconciliation failure preventing an import write.
- Cancellation preventing later approval and leaving repositories unchanged.
- Valid staff schedule approval through the project repository.

## Verification

```text
npm test -- --run
Test Files  15 passed (15)
Tests  70 passed (70)

npm run build
tsc -b && vite build — passed

git diff --check
passed
```

Vite emitted its existing bundle-size advisory for a JavaScript chunk over 500 kB; it did not fail the build.

## Fix round 1 — authorization and audit RLS

- `prepareInvestmentImport` and `prepareScheduleUpdate` now reject `viewer` contexts with `FORBIDDEN` before reading or creating actionable drafts. The schedule preparation path retains and validates its context.
- Added a regression test covering both viewer preparation paths and asserting that projects, transactions, and mappings remain unchanged.
- The `agent_audit_logs` INSERT policy now requires `approved = true`, a staff/admin row value, and an independently verified staff/admin role from `public.user_roles` for the authenticated user. This prevents a client from self-assigning an elevated role or inserting an unapproved audit row.

### Fix verification

```text
npm test -- --run src/features/agent/drafts/agentDraftService.test.ts
Test Files  1 passed (1)
Tests  6 passed (6)

npm test -- --run
Test Files  16 passed (16)
Tests  81 passed (81)
```

`npm run build` was run but is presently blocked by five TypeScript function-variance errors in concurrent, uncommitted Task 4 files (`src/features/agent/agentGateway.ts:175-179`). The Task 3 files report no TypeScript errors in this build output; a full build must be re-run after the Task 4 changes are corrected.
