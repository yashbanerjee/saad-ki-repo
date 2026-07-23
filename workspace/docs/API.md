# API Overview

Base URL: `/api/v1`  
Interactive docs: `/api/docs` (Swagger)

## Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register-company` | Public | Register company + admin |
| POST | `/auth/login` | Public | Login, returns tokens |
| POST | `/auth/refresh` | Public | Rotate refresh token |
| POST | `/auth/logout` | JWT | Revoke session |
| POST | `/auth/forgot-password` | Public | Send reset email |
| POST | `/auth/reset-password` | Public | Reset with token |
| POST | `/auth/verify-email` | Public | Verify email |
| GET | `/auth/me` | JWT | Current user |

## Core resources

| Resource | Prefix | Notes |
|----------|--------|-------|
| Users | `/users` | CRUD + invite |
| Roles | `/roles` | RBAC |
| Companies | `/companies` | Settings |
| Projects | `/projects` | Members, archive |
| Issues | `/issues` | Comments, transitions, watchers |
| Sprints | `/sprints` | Start / complete |
| Clients | `/clients` | CRUD |
| Onboarding | `/onboarding` | Forms, fields, public submit |
| Documents | `/documents` | Upload metadata |
| NDA | `/nda` | Templates + signing |
| Notifications | `/notifications` | List / mark read |
| Dashboard | `/dashboard` | Overview stats |
| Search | `/search` | Global search |
| Workflows | `/workflows` | Custom statuses |
| Teams | `/teams` | Departments & teams |
| Reports | `/reports` | Project / sprint / issue |
| Audit | `/audit` | Audit trail |
| Activity | `/activity` | Activity feed |
| Health | `/health` | Liveness + DB |

## Conventions

- Pagination: `?page=1&limit=20`
- Sorting: `?sortBy=createdAt&sortOrder=desc`
- Filtering: resource-specific query params
- Errors: standard NestJS exception JSON
- Versioning: URL path `v1`

## WebSockets

Namespace: `/notifications`  
Auth: JWT in `auth.token` or `Authorization` header.
