# 프론트엔드 Docker 실행 가이드

이 프로젝트는 React/Vite 정적 프론트엔드를 Docker와 Nginx로 실행할 수 있습니다. API와 Supabase는 기존 Vercel·Supabase 환경을 계속 사용합니다.

## 사전 조건

- Docker Desktop 설치
- 저장소 루트에서 명령 실행

## 실행

```bash
docker compose up --build -d
```

브라우저에서 다음 주소로 접속합니다.

- 대시보드: http://localhost:8080/
- 로그인: http://localhost:8080/login
- 사업관리: http://localhost:8080/manage
- 투자비 가져오기: http://localhost:8080/import
- 안전규정 Agent: http://localhost:8080/safety
- 상태 확인: http://localhost:8080/healthz

Nginx의 history fallback 설정으로 `/login`, `/dashboard` 등의 URL을 직접 열거나 새로고침해도 SPA 404가 발생하지 않습니다.

## 종료 및 재빌드

```bash
docker compose down
docker compose up --build -d
```

## 구조

```text
Docker build stage: node:20-alpine → npm run build → dist/
Runtime stage: nginx:1.27-alpine → dist 정적 파일 제공
API/Auth/Data: 기존 Vercel API + Supabase 사용
```

## 운영 전 확인사항

- Vite 환경변수는 빌드 시점에 번들에 포함되므로 운영용 값은 이미지 빌드 전에 주입해야 합니다.
- Supabase `anon key`는 공개 클라이언트 키지만, service role key나 LLM 비밀키는 이미지에 넣지 않습니다.
- API까지 사내망으로 이전할 때는 별도 Node API 컨테이너를 추가합니다.
