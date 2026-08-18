# 투자비 대시보드 MCP Host·Horizon MCP Server 설계

## 1. 문서 목적

기존 `Investment-Control-Dashboard`를 MCP Host App으로 확장하고, MCP Server는 별도 GitHub 레포지토리에서 개발해 Prefect Horizon에 배포하기 위한 설계 문서다.

현재 단계에서는 실제 MCP Server 레포지토리 생성·Horizon 배포·LLM 교체를 진행하지 않는다. 본 문서는 향후 구현 시 사용할 목표 구조와 Tool 계약을 정의한다.

## 2. 목표 구조

```text
Investment-Control-Dashboard
  └─ MCP Host App
      ├─ 자체 LLM Provider Adapter
      ├─ MCP Client
      ├─ 질문 분류·Tool 선택
      ├─ 권한·정책·감사 경계
      └─ Agent UI
              │ HTTPS / OAuth 2.1
              ▼
Investment-Control-MCP-Server
  └─ Prefect Horizon 배포
      ├─ 투자비 Tool
      ├─ 일정 Tool
      ├─ Excel 검증 Tool
      └─ 안전규정 Tool
              │
              ▼
          Supabase / 사내 시스템 / 안전문서
```

Host는 현재 Vercel 대시보드 레포지토리에 유지한다. MCP Server만 별도 레포지토리로 분리하며, 두 레포지토리는 내부 코드를 직접 import하지 않고 MCP protocol과 Tool schema로 통신한다.

## 3. 운영 위치와 기술 선택

- Host: 기존 Vercel 대시보드
- LLM: OpenAI-compatible API를 기본 Provider 규격으로 사용
- MCP Client: Host 내부에서 Horizon HTTP MCP Endpoint 호출
- MCP Server: Python/FastMCP 기반 별도 레포지토리
- MCP Server 배포: Prefect Horizon
- 데이터: MCP Server가 Supabase 또는 사내 시스템에서 조회
- 1차 범위: 조회·분석·검증 전용
- 저장·확정 Tool: 인증·승인·원자적 저장·감사로그 검증 후 별도 단계에서 추가

OpenAI-compatible 규격을 사용하면 사내 LLM이 vLLM, Ollama 또는 사내 API로 변경되어도 Host의 Provider 인터페이스를 유지할 수 있다.

## 4. 레포지토리 경계

### 기존 레포지토리: `Investment-Control-Dashboard`

- 로그인·Supabase 세션
- 대시보드·사업관리·투자비 가져오기 UI
- Agent 화면 및 플로팅 챗봇
- LLM Provider Adapter
- MCP Client
- Tool 허용 목록과 입력 검증
- 자연어 질문·답변 표시
- 사용자 역할에 따른 화면·Tool 제한

### 신규 레포지토리: `Investment-Control-MCP-Server`

```text
Investment-Control-MCP-Server/
├─ src/
│  ├─ server.py
│  ├─ config/
│  │  ├─ settings.py
│  │  └─ permissions.py
│  ├─ tools/
│  │  ├─ investment_tools.py
│  │  ├─ schedule_tools.py
│  │  ├─ workbook_tools.py
│  │  └─ safety_tools.py
│  ├─ services/
│  │  ├─ supabase_service.py
│  │  ├─ investment_service.py
│  │  ├─ workbook_service.py
│  │  └─ safety_rag_service.py
│  └─ schemas/
│     ├─ investment.py
│     ├─ schedule.py
│     └─ responses.py
├─ tests/
├─ pyproject.toml
├─ README.md
└─ .env.example
```

처음에는 하나의 MCP Server로 시작하되, 코드는 도메인별 모듈로 분리한다. 운영 규모와 보안 경계가 커지면 투자비·안전규정 Server를 별도 레포지토리로 분리할 수 있다.

## 5. 공통 Tool 응답 계약

모든 Tool은 자연어 문장이 아닌 구조화된 응답을 반환한다.

```json
{
  "success": true,
  "data": {},
  "evidence": [],
  "warnings": [],
  "errors": [],
  "metadata": {
    "toolName": "get_project_investment_summary",
    "toolVersion": "1.0.0",
    "contractVersion": "2026-08-01",
    "source": "supabase",
    "asOf": "2026-08-18"
  }
}
```

Host의 LLM은 구조화된 결과를 한국어 자연어로 설명하고, 화면에는 수치·근거·경고를 구조적으로 표시한다.

공통 오류 코드는 다음과 같다.

```text
UNAUTHENTICATED
FORBIDDEN
TOOL_NOT_ALLOWED
PROJECT_NOT_FOUND
ORDER_MAPPING_NOT_FOUND
WORKBOOK_RECONCILIATION_FAILED
DATA_SOURCE_UNAVAILABLE
SAFETY_EVIDENCE_NOT_FOUND
RATE_LIMITED
TIMEOUT
```

## 6. 인증·데이터 접근

```text
Supabase 로그인
  ↓ Access Token
MCP Host
  ↓ HTTPS + OAuth 2.1
Horizon MCP Server
  ↓ RLS 적용 조회
Supabase
```

- 역할은 `user_metadata`가 아니라 신뢰할 수 있는 `user_roles` 또는 `app_metadata` 기준으로 확인한다.
- `service_role` 키는 브라우저와 Host에 노출하지 않는다.
- MCP Server는 브라우저 `localStorage`를 사용하지 않는다.
- Supabase 공개 테이블에는 RLS를 적용한다.
- Tool별로 필요한 사업·행만 조회한다.
- 응답에는 기준일과 데이터 출처를 포함한다.

## 7. 1차 MCP Tool 목록

### 투자비 Tool

- `get_project_investment_summary`
- `find_investment_anomalies`
- `explain_plan_actual_variance`
- `get_executive_briefing`
- `compare_project_investment`

### 일정 Tool

- `get_schedule_variance`
- `find_schedule_risks`
- `find_missing_project_data`

### Excel 검증 Tool

- `validate_investment_workbook`
- `reconcile_workbook_detail_rows`
- `detect_duplicate_upload`
- `resolve_order_project_mapping`

### 안전규정 Tool

- `search_approved_safety_documents`
- `get_safety_document_citation`

## 8. 핵심 Tool schema

### 8.1 `get_project_investment_summary`

입력:

```json
{
  "projectId": "project-pohang-cathode-1",
  "year": 2026,
  "monthFrom": "2026-01",
  "monthTo": "2026-12",
  "includeMonthly": true,
  "includeOrders": true
}
```

반환 데이터:

- 사업 기본정보
- 승인투자비
- 누적투자비
- 잔여투자비
- 누적률
- 월별 실적·누적금액
- 투자오더별 실적

계산 규칙:

```text
잔여투자비 = 승인투자비 - 누적투자비
누적률 = 누적투자비 / 승인투자비 × 100
누적투자비 = 기준 기간까지의 월별 실적투자비 합계
```

### 8.2 `find_investment_anomalies`

탐지 유형:

- `BUDGET_EXCEEDED`
- `MONTHLY_SPIKE`
- `EXECUTION_RATE_LOW`
- `NEGATIVE_ADJUSTMENT`
- `MISSING_ORDER_MAPPING`
- `DETAIL_SUM_MISMATCH`
- `MISSING_MONTHLY_DATA`

Tool은 이상 여부와 가능한 원인을 반환하지만 원인을 확정하지 않는다. 담당자가 작성한 실제 사유가 있는 경우에만 원인 설명에 사용한다.

### 8.3 `explain_plan_actual_variance`

계산 규칙:

```text
차이금액 = 실적금액 - 계획금액
차이율 = 차이금액 / 계획금액 × 100
지연일수 = 실적일 - 계획일
```

반환 항목:

- 계획금액·실적금액·차이금액·차이율
- 월별 상태
- 담당자 사유
- 계획일·실적일·지연/단축 일수
- 데이터 출처

계획금액이 없으면 `no_plan`, 실적이 없으면 `no_actual`로 반환한다. 사유가 없으면 추정하지 않고 `null`로 반환한다.

### 8.4 `get_executive_briefing`

반환 항목:

- 전체 승인투자비·누적투자비·잔여투자비·집행률
- 주요 투자비 이상 사업
- 일정 지연 사업
- 데이터 품질 이슈
- 기준일과 근거 목록

Tool은 수치와 이슈 목록을 반환하고, 경영진용 자연어 문장 생성은 Host LLM이 담당한다.

### 8.5 `validate_investment_workbook`

검증 규칙:

1. 투자오더번호 확인
2. 기준 월 확인
3. 사업·투자오더 매핑 확인
4. `C14` 월별 실적 추출
5. `C15~C108` 상세행 합계 계산
6. `C14`와 상세행 합계 비교
7. 동일 파일·월·투자오더 중복 확인
8. 복수 투자오더 월별 합산

상태값:

- `valid`: 검증 통과
- `warning`: 음수 환입·조정 등 확인 필요하지만 반영 가능
- `error`: 검증 실패
- `duplicate`: 중복 업로드 의심

오류 파일이 하나라도 있으면 전체 반영 가능 여부를 `false`로 반환한다. 1차 서버에는 반영·확정 기능을 넣지 않는다.

### 8.6 `search_approved_safety_documents`

- `status = approved` 문서만 검색
- `pending`, `rejected`, `expired` 제외
- 문서명·본문·섹션·키워드·공정 검색
- 문서명·조항·페이지·출처일·원문 URL 반환
- 근거가 없으면 `answerable: false`와 `SAFETY_EVIDENCE_NOT_FOUND` 반환
- 법적 판단이나 최종 안전 승인을 대신하지 않음

## 9. Host MCP Client 정책

- 연결 후 `listTools`로 Tool과 입력 schema 확인
- Host 허용 목록에 없는 Tool은 실행하지 않음
- 입력값과 응답 schema 검증
- timeout·재시도·rate limit 적용
- 사용자 역할과 사업 범위를 MCP 요청에 포함
- Tool 요청·응답·오류를 감사 메타데이터로 기록
- 서버 장애 시 임의 답변 대신 명확한 오류 반환

## 10. 배포 흐름

```text
MCP Server feature branch
  ↓ Pull Request
Horizon Preview Endpoint
  ↓ Tool schema·권한·응답 테스트
main merge
  ↓
Horizon Production Endpoint
```

- Host 개발 환경은 Preview Endpoint 사용
- Host 운영 환경은 Production Endpoint 사용
- Tool 계약 변경 시 Preview에서 Host 호환성 확인
- 필드 추가는 호환 가능한 minor 변경
- 필드 삭제·의미 변경은 major 변경
- 중단 Tool은 `deprecated` 표시 후 제거

## 11. 단계적 적용 계획

### 1단계: 현재 프로젝트 안정화

- Vercel·Supabase 인증 및 실제 데이터 조회 검증
- 기존 Agent의 읽기·분석 기능 검증
- 운영 데이터 기준 투자비·일정 정합성 확인

### 2단계: MCP Server 시범 구축

- 별도 `Investment-Control-MCP-Server` 레포지토리 생성
- FastMCP 기본 Server와 공통 응답 schema 구축
- `get_project_investment_summary`부터 구현
- 단위 테스트와 Preview Endpoint 검증

### 3단계: 분석·검증 Tool 확장

- 이상 탐지
- 계획 대비 실적 설명
- 경영진 브리핑
- Excel 정합성 검증
- 승인 안전문서 검색

### 4단계: Host 연결

- OpenAI-compatible LLM Provider Adapter
- MCP Client
- Tool 선택·허용 정책
- 실제 자연어 질문과 구조화 응답 표시

### 5단계: 운영 확장

- 사내 LLM 연결
- 사내 시스템 투자오더 연동
- 저장·확정 workflow
- 원자적 저장과 감사로그
- 추가 사내 업무 Tool 확장

## 12. 현재 적용 여부

- 기존 투자비 대시보드와 AI Agent: 적용됨
- 안전규정 RAG: 적용됨
- 자체 LLM Provider: 설계 단계
- MCP Client: 설계 단계
- 별도 MCP Server 레포지토리: 아직 생성하지 않음
- Horizon 배포: 아직 진행하지 않음
- MCP Tool 1차 목록과 schema: 설계 완료

