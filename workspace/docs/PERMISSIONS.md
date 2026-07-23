# Roles & Permissions

## System roles

| Role | Slug | Typical access |
|------|------|----------------|
| Super Admin | `super_admin` | Full permission set |
| Company Admin | `company_admin` | Full company permission set |
| Project Manager | `project_manager` | Projects, issues, sprints, clients, documents, reports |
| Team Lead | `team_lead` | Issues, team visibility, dashboard |
| Developer | `developer` | Create/manage issues, read projects |
| QA | `qa` | Manage issues/bugs, read sprints |
| Client | `client` | Read projects/issues/docs + NDA |
| Viewer | `viewer` | Read-only projects, issues, dashboard, search |

## Permission slugs (seeded)

```
users:manage | users:read | users:invite
roles:manage | roles:read
company:manage | company:read
projects:create | projects:manage | projects:read
issues:create | issues:manage | issues:read
sprints:manage | sprints:read
onboarding:manage | onboarding:read
documents:manage | documents:read
nda:manage | nda:read
clients:manage | clients:read
workflows:manage | workflows:read
teams:manage | teams:read
reports:read | dashboard:read | audit:read | search:read
```

Defined in `backend/src/common/constants/permissions.constants.ts`.

Guards: `@Roles('company_admin')` and/or `@Permissions('issues:create')` on NestJS controllers.
