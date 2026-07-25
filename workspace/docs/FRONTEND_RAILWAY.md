# FRONTEND Railway setup (wonderful-love service)

## Why it kept starting the backend

With **Root Directory empty**, Railway runs commands from the **repo root**.

Root `package.json` has:
```json
"build": "... backend ...",
"start": "node workspace/backend/scripts/start-railway.js"
```

So if build/start are `npm run build` / `npm run start`, you get the **backend**.

Config-as-code alone does not change the working directory.

## Fix (exact settings for frontend service)

### Settings → Config-as-code
```
workspace/frontend/railway.toml
```

### Settings → Build → Root Directory
```
(leave completely EMPTY / blank)
```

### Do not set custom Build/Start in the UI
Let them come from `railway.toml` (or set them to the same values):

| Field | Value |
|-------|--------|
| Build | `node workspace/frontend/railway-build.js` |
| Start | `node workspace/frontend/railway-start.js` |

### Variables
```env
SERVICE_ROLE=frontend
NEXT_PUBLIC_API_URL=https://YOUR-BACKEND.up.railway.app/api/v1
```

No `DATABASE_URL`.

### Redeploy
Push latest code, then Redeploy (clear build cache if available).

## Success logs
```text
[frontend-build] dir=.../workspace/frontend
[frontend-build] OK
...
[frontend] Starting Next.js
✓ Ready
```

If you still see `start-railway`, Prisma, or `DATABASE_URL`, the Start Command is still wrong.

## Login
`https://YOUR-FRONTEND.up.railway.app/login`  
`admin@acme.demo` / `Password123!`
