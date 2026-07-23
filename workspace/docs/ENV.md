# Environment Variables

## Backend (`backend/.env`)

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection | `postgresql://taskflow:taskflow_secret@localhost:5432/taskflow?schema=public` |
| `REDIS_URL` | Redis for BullMQ | `redis://localhost:6379` |
| `JWT_SECRET` | Access token secret | long random string |
| `JWT_REFRESH_SECRET` | Refresh token secret | long random string |
| `JWT_EXPIRES_IN` | Access TTL | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh TTL | `7d` |
| `PORT` | API port | `4000` |
| `CORS_ORIGIN` | Frontend origin | `http://localhost:3000` |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | Email | provider values |
| `MAIL_FROM` | From address | `noreply@taskflow.local` |
| `S3_ENDPOINT` | R2/S3 endpoint | optional |
| `S3_REGION` | Region | `auto` |
| `S3_BUCKET` | Bucket name | `taskflow` |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | Credentials | optional |
| `STORAGE_PUBLIC_URL` | CDN/base URL | optional |

## Frontend (`frontend/.env.local`)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Backend API base (`http://localhost:4000/api/v1`) |
