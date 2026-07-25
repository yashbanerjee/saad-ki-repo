/**
 * Ultra-simple Railway entrypoint.
 * Resolves paths from process.cwd() AND __dirname so Root Directory
 * (repo root OR workspace) both work.
 */
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const cwd = process.cwd();
const here = __dirname;
const hint = `${process.env.SERVICE_ROLE || ''} ${process.env.RAILWAY_SERVICE_NAME || ''}`.toLowerCase();

function exists(p) {
  return !!p && fs.existsSync(p);
}

function runNode(scriptPath) {
  console.log(`[start] cwd=${cwd}`);
  console.log(`[start] script=${scriptPath}`);
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: path.dirname(path.dirname(scriptPath)), // backend/
    env: process.env,
    stdio: 'inherit',
  });
  process.exit(result.status ?? 1);
}

function runNpmStart(dir) {
  console.log(`[start] frontend cwd=${dir}`);
  const result = spawnSync('npm', ['run', 'start'], {
    cwd: dir,
    env: process.env,
    stdio: 'inherit',
    shell: true,
  });
  process.exit(result.status ?? 1);
}

const isFrontend =
  hint.includes('frontend') ||
  hint.includes('web') ||
  hint.includes('next') ||
  hint.includes('ui');

if (isFrontend) {
  const frontendDirs = [
    path.join(cwd, 'workspace', 'frontend'),
    path.join(cwd, 'frontend'),
    path.join(here, '..', 'workspace', 'frontend'),
    path.join(here, '..', 'frontend'),
  ];
  const dir = frontendDirs.find((d) => exists(path.join(d, 'package.json')));
  if (!dir) {
    console.error('[start] Frontend package.json not found. Tried:\n', frontendDirs.join('\n'));
    process.exit(1);
  }
  runNpmStart(dir);
}

const backendScripts = [
  path.join(cwd, 'workspace', 'backend', 'scripts', 'start-railway.js'),
  path.join(cwd, 'backend', 'scripts', 'start-railway.js'),
  path.join(here, '..', 'workspace', 'backend', 'scripts', 'start-railway.js'),
  path.join(here, '..', 'backend', 'scripts', 'start-railway.js'),
  path.join(here, 'workspace', 'backend', 'scripts', 'start-railway.js'), // legacy bad path — only if someone nested wrong
];

const script = backendScripts.find(exists);
if (!script) {
  console.error('[start] Backend start-railway.js not found.');
  console.error('[start] cwd=', cwd);
  console.error('[start] __dirname=', here);
  console.error('[start] tried:\n' + backendScripts.join('\n'));
  console.error(`
Set Railway Start Command explicitly:

  If Root Directory is empty / repo root:
    node workspace/backend/scripts/start-railway.js

  If Root Directory is "workspace":
    node backend/scripts/start-railway.js

Also set SERVICE_ROLE=backend and DATABASE_URL.
`);
  process.exit(1);
}

runNode(script);
