/**
 * Starts the Next.js frontend using standalone output.
 * Invoked as: node workspace/frontend/railway-start.js  (repo root)
 *         or: node railway-start.js                     (Root Directory = workspace/frontend)
 *
 * Do NOT use `next start` when next.config has output: "standalone".
 */
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const frontendRoot = __dirname;
const port = process.env.PORT || '3000';

function findStandaloneServer() {
  const marker = path.join(frontendRoot, '.next', 'standalone-server-path.txt');
  if (fs.existsSync(marker)) {
    const marked = fs.readFileSync(marker, 'utf8').trim();
    if (marked && fs.existsSync(marked)) return marked;
  }

  const candidates = [
    path.join(frontendRoot, '.next', 'standalone', 'server.js'),
    path.join(frontendRoot, '.next', 'standalone', 'workspace', 'frontend', 'server.js'),
    path.join(frontendRoot, '.next', 'standalone', 'frontend', 'server.js'),
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

console.log('[frontend] Starting Next.js (standalone)');
console.log('[frontend] dir=', frontendRoot);
console.log('[frontend] PORT=', port);

if (!fs.existsSync(path.join(frontendRoot, '.next'))) {
  console.error('[frontend] ERROR: .next folder missing. Frontend build did not run.');
  console.error('[frontend] In Railway set Build Command to: node workspace/frontend/railway-build.js');
  process.exit(1);
}

const serverJs = findStandaloneServer();
if (!serverJs) {
  console.error('[frontend] ERROR: standalone server.js not found.');
  console.error('[frontend] Rebuild with railway-build.js so static assets are copied.');
  process.exit(1);
}

const standaloneDir = path.dirname(serverJs);
console.log('[frontend] server=', serverJs);
console.log('[frontend] cwd=', standaloneDir);

const result = spawnSync(process.execPath, [serverJs], {
  cwd: standaloneDir,
  env: {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(port),
    HOSTNAME: '0.0.0.0',
    NEXT_TELEMETRY_DISABLED: '1',
  },
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
