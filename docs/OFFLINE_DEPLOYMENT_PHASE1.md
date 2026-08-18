# 외부망 빌드·외부망 차단 실행 전환 — 1단계

이번 단계는 온라인 운영을 깨지 않고 오프라인 전환 기반과 내부 API의 첫 경계를 준비합니다.

## 추가된 구성

- `docker-compose.offline.yml`: PostgreSQL 16.4 이미지와 영구 볼륨
- `Dockerfile.api` + `api/offline-server.mjs`: 내부 로그인·bootstrap·동기화 API
- 오프라인 빌드 인자: `VITE_DATA_BACKEND=offline`
- `offline/db/init/001_schema.sql`: 사용자·사업·투자비·오더매핑·확정·안전문서 스키마
- `.env.offline.example`: 운영 서버에서 주입할 DB 환경변수 예시

온라인 모드는 기존 Supabase Auth/API를 그대로 사용합니다. 오프라인 Compose는 내부 Node API와 PostgreSQL을 사용하며, 대시보드의 로그인·bootstrap·사업/투자비 동기화가 내부 API로 전환됩니다.

## 외부망 PC에서 이미지 준비

가장 간단한 방법은 제공된 스크립트를 사용하는 것입니다.

```powershell
.\scripts\export-offline-bundle.ps1 -OutputDir .\offline-bundle
```

생성된 `offline-bundle` 폴더를 승인된 반입 절차로 운영 서버에 이동합니다.

보안을 위해 번들에는 실제 `.env.offline`을 넣지 않고 `.env.offline.example`만 포함합니다. 운영 서버에서 예시 파일을 복사하고 `POSTGRES_PASSWORD`, `JWT_SECRET`을 별도로 입력하세요.

수동으로 진행할 경우:

```powershell
Copy-Item .env.offline.example .env.offline
# .env.offline의 POSTGRES_PASSWORD를 긴 임의 값으로 변경
docker compose --env-file .env.offline -f docker-compose.offline.yml pull
docker save postgres:16.4-alpine -o postgres-16.4-alpine.tar
docker compose --env-file .env.offline -f docker-compose.offline.yml build
docker save \
  investment-dashboard-api:offline \
  investment-dashboard:offline \
  postgres:16.4-alpine \
  -o investment-dashboard-offline-images.tar
```

`postgres-16.4-alpine.tar`와 이 저장소의 소스/Compose 파일을 승인된 반입 절차로 운영 서버에 이동합니다.

## 외부망 차단 서버에서 실행

```powershell
.\scripts\import-offline-bundle.ps1 -BundleDir .\offline-bundle
```

처음 실행하면 `.env.offline.example`에서 `.env.offline`을 만들고 중단합니다. 생성된 `.env.offline`에 운영 비밀값을 입력한 후 같은 명령을 한 번 더 실행하세요.

수동으로 진행할 경우:

```powershell
docker load -i postgres-16.4-alpine.tar
docker load -i investment-dashboard-offline-images.tar
Copy-Item .env.offline.example .env.offline
# 운영 서버에서 비밀번호를 입력
docker compose --env-file .env.offline -f docker-compose.offline.yml up -d
docker compose --env-file .env.offline -f docker-compose.offline.yml ps
```

DB는 `investment_postgres_data` 볼륨에 저장됩니다. DB 데이터는 이미지에 넣지 않습니다.

## 백업·복원

```powershell
docker compose --env-file .env.offline -f docker-compose.offline.yml exec -T db `
  pg_dump -U investment_app -d investment -Fc > investment.dump

Get-Content .\investment.dump -Raw -Encoding Byte | `
  docker compose --env-file .env.offline -f docker-compose.offline.yml exec -T db `
  pg_restore -U investment_app -d investment --clean --if-exists
```

실제 운영에서는 백업 파일을 암호화하고, 비밀번호는 파일에 커밋하지 않습니다.

기본 포트는 `8080`이며, 이미 사용 중이면 `.env.offline`의 `OFFLINE_DASHBOARD_PORT`를 변경합니다.

## 현재 내부 API 범위

- `POST /api/offline/login`: 사번·비밀번호 로그인 및 역할 토큰 발급
- `GET /api/offline/bootstrap`: 사업·투자비·오더 매핑·확정 상태 조회
- `POST /api/offline/sync`: 실무담당자·관리자의 변경사항 저장
- `POST /api/offline/import-files`: 실무담당자·관리자의 원본 Excel 보관
- `GET /api/offline/import-files/{batchId}/{fileName}`: 실무담당자·관리자의 원본 Excel 다운로드
- `GET /api/offline/healthz`: 내부 API 상태 확인

## 오프라인 투자비 업로드 현재 동작

`투자비 가져오기` 화면에서 사업을 선택하고 여러 Excel 파일을 업로드하면 기존 검증 로직이 파일별 오더번호와 `C14`/`C15:C108` 정합성을 확인합니다. 확정 시 사업별 매핑과 거래 행을 브라우저 저장소에 먼저 반영한 뒤 `POST /api/offline/sync`로 PostgreSQL에 저장하므로, 폐쇄망에서도 다음 달 파일을 계속 추가할 수 있습니다. 동일한 `sourceId`·`rowId`는 중복 저장되지 않습니다.

원본 Excel은 PostgreSQL에 넣지 않고 API 컨테이너의 전용 볼륨(`investment_import_files`)에 배치별 디렉터리로 보관합니다. 파일당 기본 20MB 제한, 경로 문자 정규화, 중복 파일명 차단, staff/admin 권한 검사를 적용합니다. 메타데이터에는 파일명·크기·사업·오더·행 수·검증 건수가 포함됩니다.

저장된 원본은 인증된 staff/admin 세션에서 `/api/offline/import-files/{batchId}/{fileName}` 경로로 내려받을 수 있습니다. 존재하지 않는 배치나 파일은 서버가 오류로 처리하며 경로 상위 이동(`..`)은 허용하지 않습니다.

## 다음 단계

1. 원본 파일 다운로드·보존기간·백업 정책 추가
2. 안전규정 문서·RAG 인덱스의 내부 저장 연결
3. AI Agent의 내부 API/사내 LLM 연결
4. 실제 Supabase 데이터 백업을 PostgreSQL로 이전
5. 온라인/오프라인 통합 테스트 및 권한 검증
