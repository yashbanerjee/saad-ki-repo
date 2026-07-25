/**
 * Always builds the Next.js frontend (never the Nest backend).
 * Forces NODE_ENV=production and prepares the standalone output for Railway.
 */
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const frontendRoot = __dirname;

function run(command, args, extraEnv = {}) {
  console.log(`[frontend-build] $ ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    cwd: frontendRoot,
    env: {
      ...process.env,
      ...extraEnv,
    },
    stdio: 'inherit',
    shell: true,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return false;
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
  return true;
}

function findStandaloneServer(root) {
  const candidates = [
    path.join(root, '.next', 'standalone', 'server.js'),
    path.join(root, '.next', 'standalone', 'workspace', 'frontend', 'server.js'),
    path.join(root, '.next', 'standalone', 'frontend', 'server.js'),
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

console.log('[frontend-build] dir=', frontendRoot);
console.log('[frontend-build] incoming NODE_ENV=', process.env.NODE_ENV);

if (!fs.existsSync(path.join(frontendRoot, 'package.json'))) {
  console.error('[frontend-build] package.json not found in', frontendRoot);
  process.exit(1);
}

// Railway sets npm "production" config which can skip devDependencies needed for next build
run('npm', ['install', '--include=dev', '--no-workspaces']);

// Critical: Next.js build must see exact NODE_ENV=production
run('npx', ['next', 'build'], {
  NODE_ENV: 'production',
  NEXT_TELEMETRY_DISABLED: '1',
});

if (!fs.existsSync(path.join(frontendRoot, '.next'))) {
  console.error('[frontend-build] .next was not created — build failed');
  process.exit(1);
}

const serverJs = findStandaloneServer(frontendRoot);
if (!serverJs) {
  console.error('[frontend-build] standalone server.js missing after build');
  console.error('[frontend-build] Expected under .next/standalone/');
  process.exit(1);
}

const standaloneDir = path.dirname(serverJs);
const staticSrc = path.join(frontendRoot, '.next', 'static');
const publicSrc = path.join(frontendRoot, 'public');
const staticDest = path.join(standaloneDir, '.next', 'static');
const publicDest = path.join(standaloneDir, 'public');

if (copyDir(staticSrc, staticDest)) {
  console.log('[frontend-build] copied .next/static ->', staticDest);
} else {
  console.warn('[frontend-build] warning: .next/static not found');
}

if (copyDir(publicSrc, publicDest)) {
  console.log('[frontend-build] copied public ->', publicDest);
}

// Marker used by start script
fs.writeFileSync(
  path.join(frontendRoot, '.next', 'standalone-server-path.txt'),
  serverJs,
  'utf8'
);

console.log('[frontend-build] standalone server=', serverJs);
console.log('[frontend-build] OK');
