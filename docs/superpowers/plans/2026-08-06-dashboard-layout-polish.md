# Dashboard Layout Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 대시보드의 도넛 차트, 사업별 투자비 바 차트, 사업목록 표, 실적 사유 표시를 안정적이고 읽기 쉬운 레이아웃으로 개선한다.

**Architecture:** 기존 React 컴포넌트 구조를 유지하고 `MaterialDonut`, `DashboardPage`, `ProjectHoverList`의 렌더링 책임은 보존한다. 시각적 정렬·레이어·툴팁 위치는 `src/styles/app.css`에서 조정하고, 사유가 있는 일정만 선택 상태를 통해 표 아래 고정 설명박스로 표시한다.

**Tech Stack:** React, TypeScript, Vite, Vitest, CSS.

## Global Constraints

- 기존 한국어 UI와 샘플 데이터 구조를 유지한다.
- 도넛 hover 상세목록은 좌측 패널을 벗어나지 않는다.
- 실적 사유가 비어 있으면 hover 표식과 설명박스를 렌더링하지 않는다.
- 기존 테스트와 프로덕션 빌드를 통과해야 한다.

---

### Task 1: 도넛 차트 hover 레이어 안정화

**Files:**
- Modify: `src/features/dashboard/MaterialDonut.tsx`
- Modify: `src/features/dashboard/ProjectHoverList.tsx`
- Modify: `src/styles/app.css`
- Test: `src/features/dashboard/dashboard.test.tsx`

- [ ] **Step 1: hover 레이어 구조와 클래스의 현재 동작을 확인한다.**
- [ ] **Step 2: 도넛 SVG/요소와 상세목록을 별도 래퍼로 분리하고 상세목록에 패널 내부 제한 클래스를 부여한다.**
- [ ] **Step 3: 차트의 `border-radius`, 중앙 구멍, `overflow` 레이어를 유지하도록 CSS를 수정한다.**
- [ ] **Step 4: 기존 대시보드 테스트를 실행해 소재별 사업현황과 hover 목록이 유지되는지 확인한다.**

### Task 2: 사업별 투자비 바 차트 순서 변경

**Files:**
- Modify: `src/features/dashboard/DashboardPage.tsx`
- Modify: `src/styles/app.css`
- Test: `src/features/dashboard/dashboard.test.tsx`

- [ ] **Step 1: 바 차트 JSX의 시각 순서를 누적투자비 → 승인투자비로 변경한다.**
- [ ] **Step 2: 범례와 값 표시 순서를 같은 순서로 변경하고 색상 의미는 유지한다.**
- [ ] **Step 3: 테스트에서 두 항목의 표시 순서를 검증한다.**
- [ ] **Step 4: 대시보드 테스트를 실행한다.**

### Task 3: 사업목록 표 크기와 중앙 정렬 최적화

**Files:**
- Modify: `src/features/dashboard/DashboardPage.tsx`
- Modify: `src/styles/app.css`
- Test: `src/features/dashboard/dashboard.test.tsx`

- [ ] **Step 1: 사업목록 표에 고정 레이아웃과 명시적 열 클래스를 적용한다.**
- [ ] **Step 2: 투자비 현황 열 폭을 제한하고 금액 표시가 자연스럽게 줄바꿈되도록 조정한다.**
- [ ] **Step 3: 헤더·셀의 가로/세로 중앙 정렬, 균일한 행 높이와 패딩을 적용한다.**
- [ ] **Step 4: 화면 테스트와 프로덕션 빌드를 실행한다.**

### Task 4: 실적 사유 고정 설명박스 및 빈 사유 숨김

**Files:**
- Modify: `src/features/dashboard/DashboardPage.tsx`
- Modify: `src/styles/app.css`
- Test: `src/features/dashboard/dashboard.test.tsx`

- [ ] **Step 1: 사유가 있는 실적 날짜만 버튼/hover 대상이 되도록 조건부 렌더링한다.**
- [ ] **Step 2: 선택한 사유를 사업목록 표 아래 고정 설명박스에 표시한다.**
- [ ] **Step 3: 설명박스가 표 너비 안에서 잘리지 않도록 위치·줄바꿈 CSS를 적용한다.**
- [ ] **Step 4: 사유 있음/없음 두 상태에 대한 테스트를 추가하고 전체 테스트를 실행한다.**

### Task 5: 최종 검증 및 커밋

**Files:**
- Verify: `src/features/dashboard/*`
- Verify: `src/styles/app.css`

- [ ] **Step 1: `npm test -- --run`을 실행한다.**
- [ ] **Step 2: `npm run build`를 실행한다.**
- [ ] **Step 3: 변경 파일을 확인하고 의미 있는 커밋으로 저장한다.**

