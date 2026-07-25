/**
 * Railway / production start for TaskFlow backend.
 * Fails fast with a clear message if DATABASE_URL is missing.
 */
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const backendDir = path.join(__dirname, '..');
const workspaceDir = path.join(backendDir, '..');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

// Local .env fallback. Railway must inject DATABASE_URL via Variables.
loadEnvFile(path.join(backendDir, '.env'));

if (!process.env.DATABASE_URL) {
  console.error(`
============================================================
FATAL: DATABASE_URL is not set on this service.

Fix in Railway (backend service → Variables):
  1. Click "+ New Variable" → "Add Reference"
  2. Select your Postgres service
  3. Choose DATABASE_URL
  4. Save → Redeploy

Or paste manually:
  DATABASE_URL=postgresql://postgres:...@....railway.app:..../railway

Required vars for backend:
  DATABASE_URL
  JWT_SECRET
  JWT_REFRESH_SECRET
  CORS_ORIGIN   (your frontend URL)
  REDIS_URL     (optional but recommended)
============================================================
`);
  process.exit(1);
}

function run(cmd, args, cwd) {
  const result = spawnSync(cmd, args, {
    cwd,
    env: process.env,
    stdio: 'inherit',
    shell: true,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const schemaCandidates = [
  path.join(workspaceDir, 'prisma', 'schema.prisma'),
  path.join(backendDir, 'prisma', 'schema.prisma'),
  path.join(backendDir, '..', 'prisma', 'schema.prisma'),
];
const schema = schemaCandidates.find((p) => fs.existsSync(p));
if (!schema) {
  console.error('[start-railway] Prisma schema not found. Tried:\n' + schemaCandidates.join('\n'));
  process.exit(1);
}

console.log('[start-railway] Using schema', schema);
console.log('[start-railway] DATABASE_URL is set');
run('npx', ['prisma', 'migrate', 'deploy', `--schema=${schema}`], backendDir);

// Always rebuild so Railway never starts a stale dist/ from a previous image layer
console.log('[start-railway] Building NestJS app...');
run('npx', ['prisma', 'generate', `--schema=${schema}`], backendDir);
run('npm', ['run', 'build'], backendDir);

const mainJs = path.join(backendDir, 'dist', 'main.js');
if (!fs.existsSync(mainJs)) {
  console.error('[start-railway] Missing dist/main.js — build failed or Root Directory wrong.');
  process.exit(1);
}
console.log('[start-railway] Starting API (buildId=2026-07-25-verify)');
run('node', [mainJs], backendDir);
