# TaskFlow Enterprise

AI-Powered Project Management & Client Onboarding Platform (Jira-like).

Monorepo under `workspace/` with NestJS backend, Next.js 15 frontend, shared Prisma schema, Docker, and seed data.

## Stack

| Layer | Technology |
|-------|------------|
| Backend | NestJS, Prisma, PostgreSQL, Redis, BullMQ, Socket.io, JWT, Swagger |
| Frontend | Next.js 15 (App Router), Tailwind, Shadcn-style UI, TanStack Query, Zustand, Framer Motion |
| Storage | AWS S3 / Cloudflare R2 |
| Deploy | Docker, Railway, DigitalOcean, Vercel (frontend) |

## Quick Start

```bash
cd workspace
npm run setup

# Start Postgres + Redis only
docker compose -f docker/docker-compose.yml up -d postgres redis

# Configure backend/.env then:
npm run prisma:migrate
npm run prisma:seed

npm run dev:backend   # :4000
npm run dev:frontend  # :3000
```

- **API:** http://localhost:4000/api/v1  
- **Swagger:** http://localhost:4000/api/docs  
- **App:** http://localhost:3000  

### Demo accounts (after seed)

| Email | Role | Password |
|-------|------|----------|
| admin@acme.demo | Company Admin | Password123! |
| pm@acme.demo | Project Manager | Password123! |
| dev@acme.demo | Developer | Password123! |
| qa@acme.demo | QA | Password123! |
| client@acme.demo | Client | Password123! |

## Structure

```
workspace/
  backend/     NestJS API (api/v1)
  frontend/    Next.js 15 App Router
  shared/      Shared types & enums
  prisma/      Schema + seed
  docker/      Compose + Dockerfiles
  docs/        Architecture & API notes
  scripts/     Setup & deploy helpers
  uploads/     Local file storage
```

## Modules

- Authentication (JWT + refresh, invite, email verify, password reset, 2FA-ready)
- RBAC (8 roles, granular permissions)
- Client onboarding (dynamic form builder, drafts, secure links)
- Digital NDA (draw / type / upload signature, audit)
- Projects, sprints, milestones
- Jira-style issues (Epic, Story, Task, Bug, …) with Kanban / Scrum boards
- Documents, notifications (in-app + Socket.io), audit & activity logs
- Admin panel, client portal, reports, global search

## Full stack Docker

```bash
cd workspace
cp backend/.env.example backend/.env
docker compose -f docker/docker-compose.yml up --build
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [API Overview](docs/API.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Permissions](docs/PERMISSIONS.md)

## License

UNLICENSED – proprietary.
