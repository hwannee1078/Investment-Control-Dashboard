# 외부망 빌드·외부망 차단 실행 전환 — 1단계

이번 단계는 온라인 운영을 깨지 않고 오프라인 전환 기반을 준비합니다.

## 추가된 구성

- `docker-compose.offline.yml`: PostgreSQL 16.4 이미지와 영구 볼륨
- `offline/db/init/001_schema.sql`: 사용자·사업·투자비·오더매핑·확정·안전문서 스키마
- `.env.offline.example`: 운영 서버에서 주입할 DB 환경변수 예시

현재 프론트엔드는 기존 Supabase Auth/API를 사용하므로, 이 단계의 PostgreSQL은 아직 화면과 직접 연결하지 않습니다. 다음 단계에서 내부 Node API를 추가한 후 프론트엔드 연결 대상을 바꿉니다.

## 외부망 PC에서 이미지 준비

```powershell
Copy-Item .env.offline.example .env.offline
# .env.offline의 POSTGRES_PASSWORD를 긴 임의 값으로 변경
docker compose --env-file .env.offline -f docker-compose.offline.yml pull
docker save postgres:16.4-alpine -o postgres-16.4-alpine.tar
```

`postgres-16.4-alpine.tar`와 이 저장소의 소스/Compose 파일을 승인된 반입 절차로 운영 서버에 이동합니다.

## 외부망 차단 서버에서 실행

```powershell
docker load -i postgres-16.4-alpine.tar
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

## 다음 단계

1. 내부 Node API 컨테이너 추가
2. 로그인·권한을 `app_users` 기반 JWT로 전환
3. `projects`, `investment_transactions` 등 API 구현
4. 프론트엔드의 Supabase 직접 호출을 내부 API 호출로 전환
5. 온라인/오프라인 통합 테스트
