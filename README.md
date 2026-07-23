# TaskFlow Enterprise

Full-stack AI-powered project management & client onboarding platform.

The application lives in [`workspace/`](./workspace/README.md).

```bash
cd workspace
npm run setup
docker compose -f docker/docker-compose.yml up -d postgres redis
npm run prisma:migrate && npm run prisma:seed
npm run dev:backend
npm run dev:frontend
```

- App: http://localhost:3000  
- API / Swagger: http://localhost:4000/api/docs  
- Demo: `admin@acme.demo` / `Password123!`
