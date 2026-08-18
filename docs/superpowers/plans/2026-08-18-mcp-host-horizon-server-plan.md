# MCP Host and Horizon Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing investment dashboard into an MCP Host and build a separate read-only FastMCP Server repository deployable to Prefect Horizon.

**Architecture:** Keep the React/Vite dashboard as the Host, including its LLM Provider Adapter, MCP Client, user interface, and policy checks. Create a separate Python/FastMCP repository for domain Tools and Supabase access; deploy that repository to Horizon via Preview and Production endpoints. The first release is read-only and returns structured data, evidence, warnings, and errors.

**Tech Stack:** Existing React + TypeScript + Vite + Supabase dashboard, Python 3.11+, FastMCP, Pydantic, Supabase Python client, pytest, OpenAI-compatible HTTP LLM adapter, Horizon HTTP MCP deployment.

**Spec:** `docs/superpowers/specs/2026-08-18-mcp-host-horizon-server-design.md`

## Global Constraints

- Current phase is read-only lookup, analysis, validation, and approved safety-document search; no MCP write or confirm Tool.
- Existing dashboard remains the MCP Host; MCP Server code lives in a separate `Investment-Control-MCP-Server` repository.
- The MCP Server must never use browser `localStorage`; it reads Supabase or approved system adapters with bearer-scoped authorization.
- Roles are resolved from trusted `user_roles` or `app_metadata`, never editable `user_metadata`.
- `service_role` or secret keys must never be exposed to browsers or the Host frontend.
- Investment actuals use Excel `C14`; detail reconciliation compares `C14` with `C15~C108`; multiple investment orders aggregate by project and month; negative adjustments are valid.
- Safety search uses only documents with `status = approved` and returns citation metadata or `SAFETY_EVIDENCE_NOT_FOUND`.
- Every Tool response uses `success`, `data`, `evidence`, `warnings`, `errors`, and `metadata` with `toolName`, `toolVersion`, `contractVersion`, `source`, and `asOf`.
- Tool names and schemas are versioned; adding fields is compatible, while deleting or changing field meaning requires a major contract version.

---

### Task 1: Create the separate MCP Server repository scaffold

**Files / repositories:**
- Create repository: `Investment-Control-MCP-Server`
- Create: `src/server.py`
- Create: `src/config/settings.py`
- Create: `src/config/permissions.py`
- Create: `src/schemas/responses.py`
- Create: `pyproject.toml`
- Create: `.env.example`
- Create: `README.md`
- Test: `tests/test_server_contract.py`

**Interfaces:**
- `create_mcp_server() -> FastMCP`
- `ToolResponse[T]` with `success`, `data`, `evidence`, `warnings`, `errors`, `metadata`
- `ToolMetadata(tool_name: str, tool_version: str, contract_version: str, source: str, as_of: str)`

- [ ] **Step 1: Create the new GitHub repository and local checkout**

  Create the repository separately from `Investment-Control-Dashboard`; do not copy the dashboard’s frontend source into it. Configure a `main` branch and a development branch.

- [ ] **Step 2: Write failing server contract tests**

  Test that the server starts, every response contains the six required top-level fields, and an unknown Tool is not registered.

- [ ] **Step 3: Add pinned Python dependencies and configuration**

  Pin FastMCP, Pydantic, pytest, and the Supabase Python client in `pyproject.toml`. Put only variable names, never secrets, in `.env.example`.

- [ ] **Step 4: Implement the FastMCP server and response envelope**

  Register no business Tool yet. Implement a health/ping resource for local tests only and a common error-code serializer.

- [ ] **Step 5: Run tests and commit**

  Run: `pytest -q`
  Expected: all scaffold tests pass.

  Commit in the new repository: `chore: scaffold investment control MCP server`.

### Task 2: Implement authentication, permissions, and Supabase read provider

**Files:**
- Modify MCP repo: `src/config/permissions.py`
- Create: `src/services/auth_service.py`
- Create: `src/services/supabase_service.py`
- Create: `src/services/data_provider.py`
- Create: `src/schemas/auth.py`
- Test: `tests/test_auth_service.py`
- Test: `tests/test_data_provider.py`

**Interfaces:**
- `RequestContext(user_id: str, employee_id: str, role: Literal['viewer','staff','admin'], access_token: str)`
- `resolve_request_context(bearer_token: str) -> RequestContext`
- `InvestmentDataProvider.get_projects(project_id: str | None = None) -> list[ProjectRecord]`
- `InvestmentDataProvider.get_transactions(project_id: str | None = None, month_from: str | None = None, month_to: str | None = None) -> list[TransactionRecord]`
- `InvestmentDataProvider.get_order_mappings() -> list[OrderMappingRecord]`

- [ ] **Step 1: Write failing auth/provider tests**

  Cover invalid bearer token, trusted role lookup, rejection of editable user metadata, project filtering, and `DATA_SOURCE_UNAVAILABLE` when Supabase is unreachable.

- [ ] **Step 2: Implement bearer-scoped authentication**

  Validate the token with Supabase Auth, resolve role from trusted `user_roles` or `app_metadata`, and construct `RequestContext`. Do not accept role or employee identity from Tool input.

- [ ] **Step 3: Implement read-only Supabase access**

  Query only the project, transaction, order mapping, Rolling Plan, and schedule fields required by Tools. Do not use browser storage or service-role credentials in client code.

- [ ] **Step 4: Run tests and commit**

  Run: `pytest -q tests/test_auth_service.py tests/test_data_provider.py`
  Expected: all tests pass, including unavailable-data fallback.

  Commit: `feat: add authenticated Supabase read provider`.

### Task 3: Implement the investment analysis Tools

**Files:**
- Modify MCP repo: `src/tools/investment_tools.py`
- Create: `src/services/investment_service.py`
- Create: `src/schemas/investment.py`
- Test: `tests/test_investment_tools.py`

**Interfaces:**
- `get_project_investment_summary(context: RequestContext, input: ProjectInvestmentSummaryInput) -> ToolResponse[ProjectInvestmentSummary]`
- `find_investment_anomalies(context: RequestContext, input: InvestmentAnomalyInput) -> ToolResponse[InvestmentAnomalyReport]`
- `explain_plan_actual_variance(context: RequestContext, input: PlanActualVarianceInput) -> ToolResponse[PlanActualVarianceReport]`
- `get_executive_briefing(context: RequestContext, input: ExecutiveBriefingInput) -> ToolResponse[ExecutiveBriefing]`
- `compare_project_investment(context: RequestContext, input: CompareProjectInvestmentInput) -> ToolResponse[ProjectInvestmentComparison]`

- [ ] **Step 1: Write failing domain tests**

  Cover multiple order IDs per project/month, C14 actuals, cumulative totals, budget remaining, execution rate, negative adjustments, duplicate transaction suppression, anomaly severity, and plan/actual variance.

- [ ] **Step 2: Implement deterministic aggregation**

  Compute investment values in Python services, not in the LLM. Return integer won values and nullable rates when approval budget is absent or zero.

- [ ] **Step 3: Register the five investment Tools**

  Register exact names from the spec and return Korean-safe structured data without generating final prose in the server.

- [ ] **Step 4: Run tests and commit**

  Run: `pytest -q tests/test_investment_tools.py`
  Expected: all investment Tool tests pass.

  Commit: `feat: add investment analysis MCP tools`.

### Task 4: Implement schedule, workbook, and safety Tools

**Files:**
- Create/modify MCP repo: `src/tools/schedule_tools.py`
- Create/modify MCP repo: `src/tools/workbook_tools.py`
- Create/modify MCP repo: `src/tools/safety_tools.py`
- Create: `src/services/workbook_service.py`
- Create: `src/services/safety_rag_service.py`
- Create: `src/schemas/schedule.py`
- Create: `src/schemas/workbook.py`
- Create: `src/schemas/safety.py`
- Test: `tests/test_schedule_tools.py`
- Test: `tests/test_workbook_tools.py`
- Test: `tests/test_safety_tools.py`

**Interfaces:**
- `get_schedule_variance(context, input) -> ToolResponse[ScheduleVarianceReport]`
- `find_schedule_risks(context, input) -> ToolResponse[ScheduleRiskReport]`
- `find_missing_project_data(context, input) -> ToolResponse[MissingDataReport]`
- `validate_investment_workbook(context, input) -> ToolResponse[WorkbookValidationReport]`
- `reconcile_workbook_detail_rows(context, input) -> ToolResponse[WorkbookReconciliationReport]`
- `detect_duplicate_upload(context, input) -> ToolResponse[DuplicateUploadReport]`
- `resolve_order_project_mapping(context, input) -> ToolResponse[OrderMappingReport]`
- `search_approved_safety_documents(context, input) -> ToolResponse[SafetySearchReport]`
- `get_safety_document_citation(context, input) -> ToolResponse[SafetyCitation]`

- [ ] **Step 1: Write failing schedule/workbook/safety tests**

  Cover plan/actual date differences and reasons, missing schedule fields, C14 versus C15:C108 mismatch, duplicate file/order/month, negative adjustment warnings, and exclusion of pending/rejected/expired safety documents.

- [ ] **Step 2: Implement schedule and workbook validation**

  Preserve the existing Excel rules exactly. A single error file makes `canPrepareImport` false, but the Tool does not save or confirm an import.

- [ ] **Step 3: Implement approved-document retrieval**

  Search only approved documents and return document title, section, page, source date, URL, and relevance metadata. Return `answerable: false` when no approved evidence exists.

- [ ] **Step 4: Run tests and commit**

  Run: `pytest -q tests/test_schedule_tools.py tests/test_workbook_tools.py tests/test_safety_tools.py`
  Expected: all tests pass.

  Commit: `feat: add schedule workbook and safety MCP tools`.

### Task 5: Deploy the MCP Server to Horizon Preview

**Files / systems:**
- Modify MCP repo: `README.md`
- Modify MCP repo: Horizon-compatible server path configuration
- Create: `.github/workflows/test.yml` if repository CI is enabled
- Test: `tests/test_mcp_contract.py`

- [ ] **Step 1: Run complete MCP Server tests locally**

  Run: `pytest -q`
  Expected: all tests pass with no real secrets in the repository.

- [ ] **Step 2: Configure Horizon Preview**

  Connect the new GitHub repository to Horizon, configure the server path and environment variables in Horizon, and deploy a pull-request Preview endpoint. Keep Supabase secrets in Horizon environment configuration only.

- [ ] **Step 3: Verify remote MCP handshake**

  Verify `initialize`, `listTools`, Tool schema discovery, bearer authentication, `FORBIDDEN`, `DATA_SOURCE_UNAVAILABLE`, and one successful read-only Tool call against non-production test data.

- [ ] **Step 4: Commit deployment documentation**

  Document the Preview endpoint, required environment variables, rollback process, and test commands without committing secrets.

  Commit: `docs: document Horizon MCP deployment`.

### Task 6: Add the Host MCP Client and LLM Provider Adapter

**Files in `Investment-Control-Dashboard`:**
- Create: `src/features/agent/mcp/mcpClient.ts`
- Create: `src/features/agent/mcp/mcpPolicy.ts`
- Create: `src/features/agent/llm/llmProvider.ts`
- Create: `src/features/agent/llm/openaiCompatibleProvider.ts`
- Modify: `src/features/agent/agentGateway.ts`
- Modify: `src/features/agent/agentClient.ts`
- Test: `src/features/agent/mcp/mcpClient.test.ts`
- Test: `src/features/agent/llm/llmProvider.test.ts`

**Interfaces:**
- `McpClient.listTools(): Promise<McpToolDefinition[]>`
- `McpClient.callTool(name: string, input: unknown, context: AgentToolContext): Promise<ToolResponse<unknown>>`
- `McpPolicy.isAllowed(name: string, role: AgentRole): boolean`
- `LlmProvider.generateStructured<T>(input: LlmRequest): Promise<T>`
- `OpenAICompatibleProvider.generateStructured<T>(input: LlmRequest): Promise<T>`

- [ ] **Step 1: Write failing Host tests**

  Cover Tool allow-list rejection, input/output schema validation, timeout, unavailable Horizon endpoint, OpenAI-compatible provider request shape, and viewer/staff/admin policy behavior.

- [ ] **Step 2: Implement the MCP Client**

  Connect to the Horizon Preview endpoint, discover Tools, filter against the Host allow-list, attach the Supabase access token, and return structured errors without inventing data.

- [ ] **Step 3: Implement the LLM Provider Adapter**

  Keep the endpoint, model name, and API key in server-side environment variables. The Provider selects a Tool but cannot directly call Supabase or mutate application data.

- [ ] **Step 4: Integrate with the existing Agent UI**

  Route analysis questions through the MCP Client and preserve existing Korean evidence, warnings, and read-only behavior. Hide unsupported write controls.

- [ ] **Step 5: Run Host tests and build**

  Run: `npm test -- --run src/features/agent/mcp src/features/agent/llm src/features/agent/AgentPage.test.tsx`
  Run: `npm run build`
  Expected: tests and build pass.

  Commit in the dashboard repo: `feat: connect dashboard host to Horizon MCP server`.

### Task 7: End-to-end integration verification

**Files:**
- Create: `docs/mcp-host-horizon-runbook.md`
- Create: `tests/e2e/mcp-host-horizon.spec.md`
- Modify: both repositories’ README files with local test and deployment commands

- [ ] **Step 1: Verify the full flow with a Preview endpoint**

  Test: login → Host obtains token → MCP Client initializes → Tool list discovery → `get_project_investment_summary` → structured response → Korean Agent answer.

- [ ] **Step 2: Verify failure and security flows**

  Test invalid token, viewer access, unknown Tool, missing project, unavailable Supabase, safety evidence absence, workbook mismatch, and Horizon timeout.

- [ ] **Step 3: Verify mobile and desktop Agent UI**

  Confirm no horizontal scrolling, readable Tool evidence, Korean error messages, and no write/approval controls in the read-only release.

- [ ] **Step 4: Run final checks**

  Run MCP repo `pytest -q`; dashboard `npm test -- --run`; dashboard `npm run build`; `git diff --check` in both repositories.

- [ ] **Step 5: Commit runbook and create deployment handoff**

  Record Preview and Production endpoint ownership, environment variable names, rollback steps, and unresolved assumptions. Do not include credentials.

