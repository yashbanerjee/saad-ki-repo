# Deploy TaskFlow on Railway

## Backend crash: `Cannot find module '.../scripts/workspace/backend/...'`

Railway was using a bad start path. **Do not use** `npm start` from the repo root.

### Backend service — set these EXACTLY

| Setting | Value |
|---------|--------|
| **Root Directory** | `workspace` |
| **Build Command** | `npm install && npm run prisma:generate --workspace=backend && npm run build --workspace=backend` |
| **Start Command** | `node backend/scripts/start-railway.js` |

**Variables:**
```env
SERVICE_ROLE=backend
DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_SECRET=<long-random>
JWT_REFRESH_SECRET=<long-random>
CORS_ORIGIN=https://<frontend>.up.railway.app
```

Then **Redeploy** (clear build cache if Railway offers it).

You should see logs like:
```text
[start-railway] Using schema ...
[start-railway] DATABASE_URL is set
TaskFlow API running on http://0.0.0.0:...
```

---

## Fix: Frontend deploy shows `DATABASE_URL` / Prisma errors

That means the **frontend** service is starting the **backend** script by mistake.

Frontend is Next.js. It must **never** run `start:railway` or Prisma.

### Correct frontend service settings (recommended)

| Setting | Value |
|---------|--------|
| **Root Directory** | `workspace/frontend` |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm run start` |

### Or if Root Directory is empty / repo root

Add this variable on the **frontend** service:

```env
SERVICE_ROLE=frontend
NEXT_PUBLIC_API_URL=https://saad-ki-repo-production.up.railway.app/api/v1
```

On the **backend** service:

```env
SERVICE_ROLE=backend
DATABASE_URL=${{Postgres.DATABASE_URL}}
```

### Frontend variables (only this for UI)

```env
NEXT_PUBLIC_API_URL=https://saad-ki-repo-production.up.railway.app/api/v1
SERVICE_ROLE=frontend
```

Do **not** add `DATABASE_URL` to the frontend.

### Also rename the service

Name the Railway service **`frontend`**. Then **Redeploy**.

Login URL after deploy:

```text
https://<frontend-domain>.up.railway.app/login
```

---

## Fix: `Environment variable not found: DATABASE_URL` (backend only)

Your **backend** is crashing because **DATABASE_URL is not set on the backend Railway service**.

Postgres having a URL is not enough — the **backend service** must receive it.

### Steps (Railway dashboard)

1. Open your project → click the **backend** service (the Node app, not Postgres).
2. Open the **Variables** tab.
3. Click **+ New Variable** → **Add Reference** (or “Shared Variable” / variable reference).
4. Select your **Postgres** plugin/service.
5. Choose **`DATABASE_URL`**.
6. Save.
7. Also add (Raw / Shared):

```env
JWT_SECRET=<long-random-string>
JWT_REFRESH_SECRET=<another-long-random-string>
CORS_ORIGIN=https://<your-frontend>.up.railway.app
REDIS_URL=${{Redis.REDIS_URL}}
NODE_ENV=production
```

8. **Redeploy** the backend.

### Check it worked

In backend → Variables you should see something like:

```text
DATABASE_URL  ${{Postgres.DATABASE_URL}}
```

Deploy logs should then show `No pending migrations` / `TaskFlow API running…` — not `P1012`.

---

## Login page not showing / JSON 404 on `/`

`https://…up.railway.app` for the **backend** service is the **API only**.  
There is no login UI on that service. Nest responds with JSON (`Cannot GET /`) unless you open:

| URL | What it is |
|-----|------------|
| `https://<backend>/api/docs` | Swagger API docs |
| `https://<backend>/api/v1/health` | Health check |
| `https://<frontend>/login` | **Login page (UI)** |

### Deploy the frontend (required for login UI)

1. In the same Railway project: **+ New** → **GitHub Repo** (same repo) → name it `frontend`.
2. Settings:

| Setting | Value |
|---------|--------|
| **Root Directory** | `workspace/frontend` |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm run start` |

3. Variables on frontend:

```env
NEXT_PUBLIC_API_URL=https://saad-ki-repo-production.up.railway.app/api/v1
```

(Use your real backend domain.)

4. Generate a public domain for **frontend**, then open:

```text
https://<your-frontend>.up.railway.app/login
```

5. On **backend**, set:

```env
CORS_ORIGIN=https://<your-frontend>.up.railway.app
```

Redeploy backend after changing CORS.

### Demo admin login

| Field | Value |
|-------|--------|
| Email | `admin@acme.demo` |
| Password | `Password123!` |

---

## Fix: "Railpack could not determine how to build the app"

That error means Railway is building from the **repo root** (`README.md` + `workspace/`) where there was no Node app detected.

### Do this in Railway (required)

Open your **backend** service → **Settings** → **Build**:

| Setting | Value |
|---------|--------|
| **Root Directory** | `workspace` |
| **Builder** | Railpack (default) **or** Dockerfile |

Then set:

| Setting | Value |
|---------|--------|
| **Build Command** | `npm install && npm run prisma:generate --workspace=backend && npm run build --workspace=backend` |
| **Start Command** | `cd backend && npx prisma migrate deploy --schema=../prisma/schema.prisma && node dist/main.js` |

**Or use Dockerfile** (Root Directory still `workspace`):

| Setting | Value |
|---------|--------|
| **Root Directory** | `workspace` |
| **Dockerfile path** | `docker/Dockerfile.backend` |

Redeploy after saving.

For the **frontend** service:

| Setting | Value |
|---------|--------|
| **Root Directory** | `workspace/frontend` |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm run start` |

---

## What you already have

- Postgres is provisioned on Railway.
- Schema migration `20260725052634_init` has been applied.
- Demo seed data can be loaded with `npm run prisma:seed`.

**Security:** Keep `DATABASE_URL` and passwords only in Railway Variables / local `.env`. Never commit `.env`.

---

## Architecture on Railway

Create **one Railway project** with these services:

| Service | Purpose |
|---------|---------|
| **PostgreSQL** | Primary database |
| **Redis** | BullMQ queues + caching (recommended) |
| **backend** | NestJS API — Root Directory `workspace` |
| **frontend** | Next.js — Root Directory `workspace/frontend` |

```
Browser → Frontend (Next.js)
              ↓ NEXT_PUBLIC_API_URL
         Backend (NestJS) → Postgres
                          → Redis
```

---

## 1. Push code to GitHub

```bash
git add .
git commit -m "Fix Railway Railpack root directory config"
git push origin main
```

Ensure `workspace/backend/.env` is **not** committed.

---

## 2. Create / open the Railway project

1. Go to [railway.app](https://railway.app) → your project.
2. Confirm **PostgreSQL** exists.
3. Optional: **+ New** → **Database** → **Redis**.

---

## 3. Deploy the backend

1. **+ New** → **GitHub Repo** → select this repository (or use existing service).
2. Rename the service to `backend`.
3. Set **Root Directory** = `workspace` (critical).
4. Use Build/Start commands from the top of this doc, or Dockerfile path `docker/Dockerfile.backend`.

### Backend variables

```env
NODE_ENV=production
PORT=${{PORT}}

DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}

JWT_SECRET=<long-random-string>
JWT_REFRESH_SECRET=<another-long-random-string>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

CORS_ORIGIN=https://<your-frontend>.up.railway.app
```

Generate secrets (PowerShell):

```powershell
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])
```

### Public domain (backend)

**Settings → Networking → Generate Domain**  
Health: `https://<backend>/api/v1/health`  
Swagger: `https://<backend>/api/docs`

---

## 4. Deploy the frontend

1. **+ New** → same GitHub repo → rename to `frontend`.
2. **Root Directory** = `workspace/frontend`
3. Build / Start as in the table above.

### Frontend variables

```env
NEXT_PUBLIC_API_URL=https://<your-backend-domain>/api/v1
```

Generate a public domain, then set backend `CORS_ORIGIN` to that URL and redeploy backend.

---

## 5. Migrations

Initial migration is already applied. On each deploy the start command runs:

```bash
npx prisma migrate deploy --schema=../prisma/schema.prisma
```

### Local against Railway Postgres

```bash
cd workspace/backend
# .env DATABASE_URL = Railway URL
npx prisma migrate deploy --schema=../prisma/schema.prisma
npm run prisma:seed
```

---

## 6. Demo logins (after seed)

Password: `Password123!`

| Email | Role |
|-------|------|
| `admin@acme.demo` | Company Admin |
| `pm@acme.demo` | Project Manager |
| `dev@acme.demo` | Developer |

---

## Common issues

| Issue | Fix |
|-------|-----|
| Railpack cannot determine how to build | Set **Root Directory** to `workspace` (backend) or `workspace/frontend` |
| CORS errors | `CORS_ORIGIN` must match frontend URL exactly |
| DB timeout | Use `${{Postgres.DATABASE_URL}}` private URL between Railway services |
| Redis / queue errors | Add Redis and set `REDIS_URL` |
| Prisma schema not found | Root Directory must be `workspace` so `prisma/` is available |

---

## Config files in repo

| File | Purpose |
|------|---------|
| `workspace/railway.toml` | Backend defaults when Root Directory = `workspace` |
| `workspace/backend/railway.toml` | Optional if Root Directory = `workspace/backend` |
| `workspace/frontend/railway.toml` | Frontend service |
| `workspace/docker/Dockerfile.backend` | Docker build alternative |
| Root `package.json` | Fallback Node detection if Root Directory is left empty |
