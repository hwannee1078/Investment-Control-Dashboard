# 투자비 대시보드 프로토타입

사업별 승인투자비, 누적투자비, 집행률과 주요 일정을 조회하고 엑셀 투자비를 사업에 연결하는 React 프로토타입입니다. 로그인, 대시보드, 사업 상세, 사업 관리, 투자비 가져오기 흐름을 브라우저 저장소 기반으로 제공합니다.

## 실행 환경과 설치

- Node.js 20 이상
- npm 10 이상

```bash
npm install
```

## 개발 서버

```bash
npm run dev
```

터미널에 표시되는 로컬 주소를 열고 임의의 공백이 아닌 아이디와 비밀번호로 로그인합니다. 현재 로그인은 프로토타입용이므로 실제 계정 검증을 하지 않습니다.

## 테스트와 프로덕션 빌드

전체 테스트를 한 번 실행하려면 다음 명령을 사용합니다.

```bash
npm test -- --run
```

변경 사항을 감시하며 테스트하려면 `npm test` 또는 `npm run test:watch`를 사용합니다. 타입 검사와 프로덕션 번들 생성을 함께 확인하려면 다음 명령을 실행합니다.

```bash
npm run build
```

빌드 결과는 `dist/`에 생성되며 Git에는 포함되지 않습니다.

## 샘플 데이터 초기화

사업과 투자비는 브라우저의 `localStorage`, 로그인 상태는 `sessionStorage`에 저장됩니다. 브라우저 개발자 도구의 콘솔에서 아래 코드를 실행한 뒤 페이지를 새로 고치면 최초 샘플 사업 4건과 빈 투자비 상태로 돌아갑니다.

```js
localStorage.removeItem('investment-dashboard.projects.v1')
localStorage.removeItem('investment-dashboard.transactions.v1')
localStorage.removeItem('investment-dashboard.order-mappings.v1')
sessionStorage.removeItem('investment-dashboard.authenticated')
location.reload()
```

사업 저장 키가 없으면 `src/domain/sampleData.ts`의 샘플 사업이 다시 생성됩니다. 투자비와 오더 연결은 빈 상태로 시작합니다.

## 투자비 엑셀 형식

첫 번째 워크시트의 첫 행을 헤더로 사용하며 `.xlsx`와 `.xls` 파일을 여러 개 선택할 수 있습니다. 헤더 앞뒤 공백, 헤더 내부 공백, UTF-8 BOM은 정규화됩니다.

필수 헤더는 다음과 같습니다.

| 헤더 | 필수 여부 | 값 형식 |
| --- | --- | --- |
| `투자오더번호` | 필수 | 비어 있지 않은 문자열 |
| `투자금액` | 필수 | 엑셀 숫자 셀 |
| `기준월` | `투자일`이 없을 때 필수 | `YYYY-MM`, `YYYY.MM`, `YYYY/MM` |
| `투자일` | `기준월`이 없을 때 필수 | 엑셀 날짜 또는 `YYYY-MM-DD`, `YYYY.MM.DD`, `YYYY/MM/DD` |

예시:

| 투자오더번호 | 기준월 | 투자금액 |
| --- | --- | ---: |
| ORDER-2026-001 | 2026-01 | 150000000 |
| ORDER-2026-001 | 2026-02 | 230000000 |

금액이 문자열이거나 월·날짜가 올바르지 않은 행은 검증 오류로 제외됩니다. 오더번호·기준월·금액이 같은 행은 선택한 여러 파일 전체에서 중복으로 판정되어 첫 행만 유지됩니다.

## 오더와 사업 연결

1. 상단 메뉴에서 **투자비 가져오기**를 선택하고 엑셀 파일을 고릅니다.
2. 미리보기에서 유효 행, 검증 오류, 중복 행을 확인합니다.
3. **미연결 오더** 표에서 각 투자오더번호에 해당하는 사업을 선택합니다.
4. **가져오기 확정**을 누르면 연결된 유효 행만 저장됩니다.

확정 시 오더-사업 연결은 `investment-dashboard.order-mappings.v1`에 저장되고 해당 사업의 `orderIds`에도 반영됩니다. 연결하지 않은 오더의 행은 저장되지 않으므로 확정 전에 미연결 오더가 0건인지 확인해야 합니다. 이후 대시보드와 사업 상세 화면은 저장된 오더 연결을 기준으로 월별·누적 투자비와 집행률을 계산합니다.

## 실제 시스템 연동 교체 지점

### 사내 SSO

- `src/features/auth/LoginPage.tsx`: 임의 자격 증명 입력 폼을 사내 SSO 로그인 시작 또는 리디렉션 UI로 교체합니다.
- `src/features/auth/authStore.ts`: `sessionStorage` 플래그를 SSO 세션·토큰 확인과 로그아웃 처리로 교체합니다.
- `src/App.tsx`의 `ProtectedLayout`: 동기 플래그 확인을 SSO 초기화, 로딩, 인증 실패 처리까지 포함하는 인증 가드로 교체합니다.

### 사내 투자비·사업 API

- `src/data/ProjectRepository.ts`: `localStorage` 기반 사업 조회·저장을 사내 사업 API 호출로 교체합니다.
- `src/data/InvestmentRepository.ts`: 투자비와 오더 연결의 브라우저 저장을 사내 투자비 API 조회·등록으로 교체합니다.
- `src/features/dashboard/DashboardPage.tsx`, `src/features/projects/ProjectDetailPage.tsx`, `src/features/manage/ProjectManagePage.tsx`, `src/features/import/InvestmentImportPage.tsx`: 저장소가 비동기 API가 되면 로딩·오류·재시도와 저장 후 재조회 흐름을 연결합니다.
- `src/services/investmentImport.ts`와 `src/services/investmentAggregation.ts`: 엑셀 검증과 집계 규칙을 클라이언트에 유지할 수 있습니다. 회사 API가 검증·집계를 담당한다면 이 서비스의 입출력 계약을 API 응답 모델에 맞추고 동일한 테스트 사례로 결과를 검증합니다.

SSO와 회사 API를 연결할 때는 브라우저에 인증 비밀정보를 저장하지 않고, 권한 검사와 투자비 검증을 서버에서도 수행해야 합니다.
