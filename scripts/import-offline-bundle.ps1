param(
  [string]$BundleDir = "."
)

$ErrorActionPreference = 'Stop'
Set-Location (Resolve-Path $BundleDir)

if (-not (Test-Path 'investment-dashboard-images.tar')) {
  throw 'investment-dashboard-images.tar를 찾을 수 없습니다.'
}
if (-not (Test-Path '.env.offline')) {
  if (Test-Path '.env.offline.example') {
    Copy-Item '.env.offline.example' '.env.offline'
    Write-Warning '운영 서버의 POSTGRES_PASSWORD와 JWT_SECRET을 입력한 뒤 같은 명령을 다시 실행하세요.'
    exit 1
  }
  throw '.env.offline를 찾을 수 없습니다. .env.offline.example을 복사해 운영 비밀값을 입력하세요.'
}

docker load -i .\investment-dashboard-images.tar
docker compose --env-file .env.offline -f docker-compose.offline.yml up -d
docker compose --env-file .env.offline -f docker-compose.offline.yml ps

Write-Host '오프라인 대시보드 실행 완료: http://localhost:8080'
