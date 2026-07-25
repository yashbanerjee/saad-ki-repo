/**
 * Runs ../prisma/seed.ts with backend/node_modules on the resolve path (Windows-safe).
 */
const path = require('path');
const Module = require('module');

const backendRoot = __dirname.replace(/[\\/]scripts$/, '') || path.join(__dirname, '..');
const nm = path.join(backendRoot, 'node_modules');

process.chdir(backendRoot);

const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  try {
    return originalResolve.call(this, request, parent, isMain, options);
  } catch (err) {
    if (err.code !== 'MODULE_NOT_FOUND') throw err;
    try {
      return require.resolve(request, { paths: [nm] });
    } catch {
      throw err;
    }
  }
};

require('ts-node/register/transpile-only');
require(path.join(backendRoot, '..', 'prisma', 'seed.ts'));
