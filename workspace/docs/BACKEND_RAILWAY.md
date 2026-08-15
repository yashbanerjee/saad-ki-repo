# Backend on Railway — full checklist

Your earlier crashes happened because Railway was running the **wrong start command**
(`npm start` → old dispatcher → bad path `/app/scripts/workspace/...`).

Use **one** of the two setups below. Setup A is simplest.

---

## Setup A (recommended) — Root Directory empty

### 1) Backend service → Settings

| Setting | Exact value |
|---------|-------------|
| **Root Directory** | *(leave empty)* |
| **Builder** | Railpack |
| **Custom Build Command** | `npm run build` |
| **Custom Start Command** | `node workspace/backend/scripts/start-railway.js` |

> If Start Command still says `npm start`, **overwrite it** with the line above.

### 2) Backend service → Variables

Add these on the **backend** service (not on Postgres, not on frontend):

```env
NODE_ENV=production
SERVICE_ROLE=backend

DATABASE_URL=${{Postgres.DATABASE_URL}}

JWT_SECRET=replace-with-long-random-string-1
JWT_REFRESH_SECRET=replace-with-long-random-string-2
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

CORS_ORIGIN=https://cms.vedha.ae

# Optional — only if you added a Redis plugin
# REDIS_URL=${{Redis.REDIS_URL}}
```

How to add `DATABASE_URL`:
1. Variables → **+ New Variable** → **Add Reference**
2. Choose **Postgres**
3. Select **DATABASE_URL**

### 3) Redeploy

Deploy → **Redeploy** (prefer “Clear build cache” if shown).

### 4) Success logs look like

```text
[start-railway] Using schema .../prisma/schema.prisma
[start-railway] DATABASE_URL is set
No pending migrations to apply.
TaskFlow API running on http://0.0.0.0:****/api/v1
```

### 5) Test URLs

- `https://YOUR-BACKEND.up.railway.app/` → HTML “API is running”
- `https://YOUR-BACKEND.up.railway.app/api/v1/health` → `{"status":"healthy"...}`
- `https://YOUR-BACKEND.up.railway.app/api/docs` → Swagger

Login UI is **not** on the backend. Use the frontend URL `/login`.

---

## Setup B — Root Directory = `workspace`

| Setting | Exact value |
|---------|-------------|
| **Root Directory** | `workspace` |
| **Build Command** | `npm install && npm run prisma:generate --workspace=backend && npm run build --workspace=backend` |
| **Start Command** | `node backend/scripts/start-railway.js` |

Same variables as Setup A.

---

## Setup C — Docker (most reliable)

| Setting | Exact value |
|---------|-------------|
| **Root Directory** | `workspace` |
| **Dockerfile path** | `docker/Dockerfile.backend` |

Variables: same as Setup A (`DATABASE_URL` required).

---

## Common crash causes

| Log message | Cause | Fix |
|-------------|--------|-----|
| `Cannot find module '/app/scripts/workspace/...'` | Old / wrong Start Command | Set Start Command to `node workspace/backend/scripts/start-railway.js` |
| `Environment variable not found: DATABASE_URL` | Var missing on backend service | Add `DATABASE_URL=${{Postgres.DATABASE_URL}}` |
| `Missing dist/main.js` | Build didn’t compile Nest | Fix Build Command; check Build Logs |
| `ECONNREFUSED 6379` / Redis errors | BullMQ needs Redis | Add Redis **or** omit `REDIS_URL` (queues become no-op) |
| `cookie_parser ... is not a function` | Old build | Redeploy latest `main` commit |
| JSON `Cannot GET /` | You’re on API URL | That’s OK — open frontend `/login` |

---

## Frontend (separate service)

| Setting | Value |
|---------|--------|
| Root Directory | `workspace/frontend` |
| Build | `npm install && npm run build` |
| Start | `npm run start` |

```env
SERVICE_ROLE=frontend
NEXT_PUBLIC_API_URL=https://YOUR-BACKEND.up.railway.app/api/v1
```

Open: `https://YOUR-FRONTEND.up.railway.app/login`  
Super admin: `info@vedha.ae` / `S@ad1002`

---

## After you change settings

1. Commit + push latest code from this repo  
2. Confirm GitHub has `workspace/backend/scripts/start-railway.js`  
3. In Railway backend: Start Command = `node workspace/backend/scripts/start-railway.js`  
4. Confirm `DATABASE_URL` reference exists on backend  
5. Redeploy and read **Deploy Logs** (not only Build Logs)
