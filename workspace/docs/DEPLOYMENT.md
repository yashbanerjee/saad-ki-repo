# Deployment

## Local Docker

```bash
cd workspace
cp backend/.env.example backend/.env
# set JWT secrets, SMTP optional
docker compose -f docker/docker-compose.yml up --build
```

Or infra only + local Node:

```bash
docker compose -f docker/docker-compose.yml up -d postgres redis
bash scripts/deploy.sh   # Linux/macOS
```

## Environment

### Backend (`backend/.env`)

- `DATABASE_URL` – PostgreSQL connection string  
- `REDIS_URL` – Redis for BullMQ  
- `JWT_SECRET` / `JWT_REFRESH_SECRET`  
- `CORS_ORIGIN` – frontend origin  
- `S3_*` or R2 credentials for file storage  
- `SMTP_*` for Nodemailer  

### Frontend (`frontend/.env.local`)

- `NEXT_PUBLIC_API_URL=https://api.example.com/api/v1`

## Vercel (frontend)

1. Root directory: `workspace/frontend`  
2. Framework: Next.js  
3. Set `NEXT_PUBLIC_API_URL`  
4. Enable `output: 'standalone'` if using Docker runner  

## Railway / DigitalOcean / VPS

1. Deploy Postgres + Redis managed services  
2. Build backend from `docker/Dockerfile.backend`  
3. Run migrations: `npx prisma migrate deploy --schema=prisma/schema.prisma`  
4. Seed optionally in staging only  
5. Point frontend env to API URL  
6. Configure CORS and cookie domains for production  

## Health checks

- `GET /api/v1/health` – API + database  
- Postgres / Redis Docker healthchecks in compose  

## Production checklist

- [ ] Strong JWT secrets (≥32 chars)  
- [ ] HTTPS / TLS termination  
- [ ] Restrict CORS origins  
- [ ] Enable rate limiting  
- [ ] Configure S3/R2 (no local uploads in prod)  
- [ ] SMTP provider  
- [ ] Database backups  
- [ ] Redis persistence  
- [ ] Log aggregation  
