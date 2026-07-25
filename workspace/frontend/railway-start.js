/**
 * Always starts the Next.js frontend, regardless of Railway Root Directory.
 * Invoked as: node workspace/frontend/railway-start.js  (repo root)
 *         or: node railway-start.js                     (Root Directory = workspace/frontend)
 */
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const frontendRoot = __dirname;
const nextBin = path.join(frontendRoot, 'node_modules', 'next', 'dist', 'bin', 'next');
const port = process.env.PORT || '3000';

console.log('[frontend] Starting Next.js');
console.log('[frontend] dir=', frontendRoot);
console.log('[frontend] PORT=', port);

if (!fs.existsSync(path.join(frontendRoot, '.next'))) {
  console.error('[frontend] ERROR: .next folder missing. Frontend build did not run.');
  console.error('[frontend] In Railway set Build Command to build workspace/frontend (see railway.toml).');
  process.exit(1);
}

const args = ['start', '--hostname', '0.0.0.0', '--port', String(port)];
const cmd = fs.existsSync(nextBin) ? process.execPath : 'npx';
const cmdArgs = fs.existsSync(nextBin) ? [nextBin, ...args] : ['next', ...args];

const result = spawnSync(cmd, cmdArgs, {
  cwd: frontendRoot,
  env: process.env,
  stdio: 'inherit',
  shell: !fs.existsSync(nextBin),
});

process.exit(result.status ?? 1);
