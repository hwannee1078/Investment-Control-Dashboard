param(
  [string]$OutputDir = "offline-bundle"
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

if (-not (Test-Path '.env.offline')) {
  Copy-Item '.env.offline.example' '.env.offline'
  Write-Warning '.env.offline가 생성되었습니다. 실제 비밀번호와 JWT_SECRET을 입력한 뒤 다시 실행하세요.'
  exit 1
}

New-Item -ItemType Directory -Force $OutputDir | Out-Null

docker compose --env-file .env.offline -f docker-compose.offline.yml build
docker pull postgres:16.4-alpine
docker save investment-dashboard-api:offline investment-dashboard:offline postgres:16.4-alpine `
  -o (Join-Path $OutputDir 'investment-dashboard-images.tar')

Copy-Item 'docker-compose.offline.yml' $OutputDir -Force
# Do not transfer build-machine secrets. Enter them on the isolated server.
Copy-Item '.env.offline.example' (Join-Path $OutputDir '.env.offline.example') -Force
Copy-Item 'Dockerfile' $OutputDir -Force
Copy-Item 'Dockerfile.api' $OutputDir -Force
Copy-Item 'nginx.conf' $OutputDir -Force
Copy-Item 'offline' $OutputDir -Recurse -Force

Write-Host "오프라인 반입 패키지 생성 완료: $((Resolve-Path $OutputDir).Path)"
Write-Host '운영 서버에서 import-offline-bundle.ps1을 실행하세요.'
