# Final review fix report

Date: 2026-08-13

## Release decision

The production Agent is intentionally read-only. This change does not enable draft persistence or approval because the repository does not yet contain a server-owned pending-draft service and a single database transaction that can atomically authorize, revalidate, mutate, consume the draft, and write an immutable audit record.

## Implemented

- Added an `AgentToolDataProvider` boundary. The default gateway fails closed instead of reading browser `localStorage`.
- Added a Supabase-backed provider that queries `projects`, `investment_transactions`, and `order_mappings` through the bearer-scoped server client, validates row envelopes and domain values, filters inactive projects, and returns `DATA_SOURCE_UNAVAILABLE` on query or shape failure.
- Changed `/api/agent` to construct the gateway with authenticated server data and to parse `unknown` request JSON into `AgentRequest` without an unsafe assertion. Requests are capped at 50 messages and 4,000 characters per message.
- Added `tsconfig.api.json` and `npm run typecheck:api`; the API type check is now part of `npm run build`.
- Removed the dormant client-side approval mutation implementation. Valid caller-supplied investment and schedule drafts now deterministically reject with `UNSUPPORTED_ACTION`, while the production gateway continues to hide approval controls.
- Disabled client audit persistence and removed audit uploads from cloud sync. The Supabase script revokes client insert/update/delete privileges and makes its read policies repeatable.
- Added the server environment variables to `.env.example` and documented the read-only safety boundary.

## TDD evidence

The focused tests were first observed failing for the missing Supabase provider, local-data default gateway behavior, absent API provider injection, and successful caller-supplied draft mutations. After the implementation, the focused suite passed 43/43 tests.

## Verification

- `npm test -- --run`: 22 files, 126 tests passed.
- `npm run typecheck:api`: passed.
- `npm run build`: passed, including the API type check and client production build. Vite retains the pre-existing 622.82 kB chunk-size warning.
- `git diff --check`: passed.

## Deliberately not enabled

- No Agent mutation, approval, or client audit write path.
- No caller-supplied draft is treated as authority.
- No model-generated transaction rows or direct AI writes.

Before writes can ship, implement an opaque server-owned draft ID, ownership/role/version/expiry checks, current-data validation, conflict and replay protection, mutation, draft state transition, and server-derived audit insertion in one database transaction/RPC, with rollback and double-approval integration tests.
