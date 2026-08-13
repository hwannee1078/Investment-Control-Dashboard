# Task 2 Report — Deterministic Read-only Analysis Tools

## Changed files

- `src/features/agent/tools/toolContext.ts` — read-only dashboard data access from localStorage.
- `src/features/agent/tools/investmentTools.ts` — anomaly detection, variance explanation, executive briefing, and C14 reconciliation.
- `src/features/agent/tools/scheduleTools.ts` — missing schedule and order-mapping analysis.
- `src/features/agent/tools/investmentTools.test.ts` — viewer access, spike, budget, variance, C14 mismatch, and negative adjustment coverage.
- `src/features/agent/tools/scheduleTools.test.ts` — missing data and no-evidence coverage.

## Commit hashes

- `410e3cf` — `feat: add read-only agent analysis tools`

## Test commands and output

```text
npm test -- --run src/features/agent/tools/investmentTools.test.ts src/features/agent/tools/scheduleTools.test.ts
Test Files  2 passed (2)
Tests  8 passed (8)

npm run build
✓ built in 303ms
```

## Concerns

- Workbook reconciliation receives parsed transactions; it recognizes `rowId` values ending in `:14` (or `14`) for C14 and `:15` through `:108` for detail rows. The current workbook importer persists C14 only, so callers that need reconciliation must retain/pass the detail rows.
- The existing production build continues to emit Vite's pre-existing chunk-size warning; it does not affect these read-only tools.

## P1 fix report

### Finding 1: production workbook reconciliation

- Preserved the parser-computed `C15:C108` sum as optional `reconciliationDetailTotal` on the persisted C14 transaction record. Reconciliation now uses direct detail rows when supplied and otherwise uses that parser-produced evidence.
- Added production-parser end-to-end regressions: a valid non-zero detail total reconciles successfully; a real mismatch returns `DETAIL_SUM_MISMATCH`.

### Finding 2: executive annual aggregation

- Replaced raw annual transaction summation with month-filtered values from `aggregateInvestment`, preserving duplicate suppression, order mapping, and valid-project filtering.
- Added regression coverage proving duplicate and unmapped rows are excluded from the annual briefing total.

### Changed files

- `src/domain/investment.ts`
- `src/services/investmentImport.ts`
- `src/services/investmentImport.test.ts`
- `src/features/agent/tools/investmentTools.ts`
- `src/features/agent/tools/investmentTools.test.ts`

### Tests and output

```text
npm test -- --run src/features/agent/tools/investmentTools.test.ts src/features/agent/tools/scheduleTools.test.ts src/services/investmentImport.test.ts src/services/investmentAggregation.test.ts
Test Files  4 passed (4)
Tests  25 passed (25)

npm run build
✓ built in 260ms
```

### Commit

- `4110783` — `fix: preserve agent reconciliation evidence`
