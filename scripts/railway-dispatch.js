/**
 * Railway monorepo dispatcher for build + start.
 *
 * Set on each service:
 *   SERVICE_ROLE=frontend   OR   SERVICE_ROLE=backend
 *
 * Also auto-detects from RAILWAY_SERVICE_NAME (contains "frontend" / "backend").
 */
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const mode = process.argv[2] || 'start'; // build | start
const repoRoot = path.resolve(__dirname, '..');

const serviceHint = (
  process.env.SERVICE_ROLE ||
  process.env.RAILWAY_SERVICE_NAME ||
  ''
).toLowerCase();

function exists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function firstExisting(paths) {
  return paths.find(exists);
}

function run(command, args, cwd) {
  console.log(`[railway-dispatch] (${mode}) $ ${command} ${args.join(' ')}  [cwd=${cwd}]`);
  const result = spawnSync(command, args, {
    cwd,
    env: process.env,
    stdio: 'inherit',
    shell: true,
  });
  process.exit(result.status ?? 1);
}

const backendDir = firstExisting([
  path.join(repoRoot, 'workspace', 'backend'),
  path.join(repoRoot, 'backend'),
]);

const frontendDir = firstExisting([
  path.join(repoRoot, 'workspace', 'frontend'),
  path.join(repoRoot, 'frontend'),
]);

const backendStartScript = backendDir
  ? path.join(backendDir, 'scripts', 'start-railway.js')
  : null;

const wantsFrontend =
  process.env.SERVICE_ROLE === 'frontend' ||
  serviceHint.includes('frontend') ||
  serviceHint.includes('web') ||
  serviceHint.includes('next') ||
  serviceHint.includes('ui');

const wantsBackend =
  process.env.SERVICE_ROLE === 'backend' ||
  process.env.SERVICE_ROLE === 'api' ||
  serviceHint.includes('backend') ||
  serviceHint.includes('api') ||
  serviceHint.includes('nest');

// If unclear, prefer frontend when Next build artifacts exist and backend dist does not
const hasNext = frontendDir && exists(path.join(frontendDir, '.next'));
const hasBackendDist = backendDir && exists(path.join(backendDir, 'dist', 'main.js'));

let role = 'backend';
if (wantsFrontend && !wantsBackend) role = 'frontend';
else if (wantsBackend && !wantsFrontend) role = 'backend';
else if (wantsFrontend && wantsBackend) {
  // both matched — honor SERVICE_ROLE first, else frontend if named frontend
  role = process.env.SERVICE_ROLE === 'backend' ? 'backend' : wantsFrontend ? 'frontend' : 'backend';
} else if (hasNext && !hasBackendDist) role = 'frontend';
else role = 'backend';

console.log(`[railway-dispatch] repoRoot=${repoRoot}`);
console.log(`[railway-dispatch] serviceHint="${serviceHint}" role=${role}`);
console.log(`[railway-dispatch] backendDir=${backendDir || '(missing)'} frontendDir=${frontendDir || '(missing)'}`);

if (role === 'frontend') {
  if (!frontendDir) {
    console.error('[railway-dispatch] FRONTEND selected but workspace/frontend not found.');
    console.error('Set Root Directory to workspace/frontend OR keep repo root and set SERVICE_ROLE=frontend');
    process.exit(1);
  }
  if (mode === 'build') {
    run('npm', ['install'], frontendDir);
    run('npm', ['run', 'build'], frontendDir);
  }
  run('npm', ['run', 'start'], frontendDir);
}

// backend
if (!backendDir || !backendStartScript || !exists(backendStartScript)) {
  console.error('[railway-dispatch] BACKEND start script not found.');
  console.error('Expected: workspace/backend/scripts/start-railway.js');
  console.error('Tried repoRoot:', repoRoot);
  process.exit(1);
}

if (mode === 'build') {
  const workspaceDir = firstExisting([
    path.join(repoRoot, 'workspace'),
    repoRoot,
  ]);
  run('npm', ['install'], workspaceDir);
  run('npm', ['run', 'prisma:generate', '--workspace=backend'], workspaceDir);
  run('npm', ['run', 'build', '--workspace=backend'], workspaceDir);
  process.exit(0);
}

run('node', [backendStartScript], repoRoot);
