/**
 * Always builds the Next.js frontend (never the Nest backend).
 */
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const frontendRoot = __dirname;

function run(command, args) {
  console.log(`[frontend-build] $ ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    cwd: frontendRoot,
    env: process.env,
    stdio: 'inherit',
    shell: true,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log('[frontend-build] dir=', frontendRoot);

if (!fs.existsSync(path.join(frontendRoot, 'package.json'))) {
  console.error('[frontend-build] package.json not found in', frontendRoot);
  process.exit(1);
}

run('npm', ['install']);
run('npm', ['run', 'build']);

if (!fs.existsSync(path.join(frontendRoot, '.next'))) {
  console.error('[frontend-build] .next was not created — build failed');
  process.exit(1);
}

console.log('[frontend-build] OK');
