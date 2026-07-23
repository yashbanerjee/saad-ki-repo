#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "Deploying TaskFlow Enterprise..."

# Infra
docker compose -f docker/docker-compose.yml up -d postgres redis
sleep 5

# Migrations
cd backend
npx prisma migrate deploy --schema=../prisma/schema.prisma
npm run prisma:seed || true
cd ..

# App containers
docker compose -f docker/docker-compose.yml up -d --build backend frontend

echo "Deployed."
echo "Frontend: http://localhost:3000"
echo "API:      http://localhost:4000/api/v1"
echo "Swagger:  http://localhost:4000/api/docs"
