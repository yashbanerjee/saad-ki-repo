# PowerShell deploy helper for Windows
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "Deploying TaskFlow Enterprise..."

docker compose -f docker/docker-compose.yml up -d postgres redis
Start-Sleep -Seconds 5

Set-Location backend
npx prisma migrate deploy --schema=../prisma/schema.prisma
npm run prisma:seed
Set-Location $Root

docker compose -f docker/docker-compose.yml up -d --build backend frontend

Write-Host "Frontend: http://localhost:3000"
Write-Host "API:      http://localhost:4000/api/v1"
Write-Host "Swagger:  http://localhost:4000/api/docs"
