/**
 * Always builds the Next.js frontend (never the Nest backend).
 * Forces NODE_ENV=production — Railway's non-standard NODE_ENV causes:
 *   Error: <Html> should not be imported outside of pages/_document (on /404)
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

console.log('[frontend-build] OK');
