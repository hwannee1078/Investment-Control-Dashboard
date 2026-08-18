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
- `GET /api/offline/healthz`: 내부 API 상태 확인

## 다음 단계

1. 오프라인 투자비 업로드 API와 원본 파일 저장소 추가
2. 안전규정 문서·RAG 인덱스의 내부 저장 연결
3. AI Agent의 내부 API/사내 LLM 연결
4. 실제 Supabase 데이터 백업을 PostgreSQL로 이전
5. 온라인/오프라인 통합 테스트 및 권한 검증
