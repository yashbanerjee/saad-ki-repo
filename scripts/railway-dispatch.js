/**
 * Dispatches Railway start based on service name / SERVICE_ROLE.
 * Prevents frontend from accidentally running the backend (which needs DATABASE_URL).
 */
const { spawnSync } = require('child_process');
const path = require('path');

const service = (
  process.env.SERVICE_ROLE ||
  process.env.RAILWAY_SERVICE_NAME ||
  ''
).toLowerCase();

const root = path.join(__dirname);

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    env: process.env,
    stdio: 'inherit',
    shell: true,
  });
  process.exit(result.status ?? 1);
}

const isFrontend =
  process.env.SERVICE_ROLE === 'frontend' ||
  service.includes('frontend') ||
  service.includes('web') ||
  service.includes('next');

if (isFrontend) {
  console.log('[railway-dispatch] Starting FRONTEND (Next.js)');
  const frontendDir = path.join(root, 'workspace', 'frontend');
  run('npm', ['run', 'start'], frontendDir);
}

console.log('[railway-dispatch] Starting BACKEND (NestJS)');
run('node', [path.join(root, 'workspace', 'backend', 'scripts', 'start-railway.js')], root);
