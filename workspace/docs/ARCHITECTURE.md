# Architecture

## Overview

TaskFlow Enterprise is a modular monorepo:

```
Client (Next.js) ──REST/WS──► API (NestJS) ──► PostgreSQL
                                  │
                                  ├── Redis (cache + BullMQ)
                                  ├── S3/R2 (files)
                                  └── SMTP (email)
```

## Backend layers

1. **Controllers** – HTTP / Swagger, DTO validation  
2. **Guards** – JWT, Roles, Permissions  
3. **Services** – business logic (SOLID, single responsibility)  
4. **Prisma** – data access  
5. **Queues** – async email & notifications  
6. **Gateways** – Socket.io realtime notifications  

## Security

- Helmet, CORS, rate limiting (`@nestjs/throttler`)
- bcrypt passwords, JWT access + refresh rotation
- Permission checks per route (`@Permissions('issues:create')`)
- Input validation via `class-validator`
- Audit interceptor for sensitive actions
- File upload validation (MIME / size) – virus scan hook ready

## Frontend

- App Router with route groups `(auth)` and `(dashboard)`
- Zustand for auth session; TanStack Query for server state
- Axios interceptor refreshes tokens on 401
- Optimistic Kanban updates with `@dnd-kit`
- Dark / light theme via CSS variables (teal/slate enterprise palette)

## Multi-tenancy

All tenant data is scoped by `companyId`. Users belong to one company (except super-admin patterns). Clients are company-scoped entities.

## Future AI / integrations

Hooks prepared for: AI sprint planning, issue summary, auto-assignment, Slack/Teams/GitHub, webhooks, calendar sync.
