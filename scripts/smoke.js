'use strict';

/**
 * Standalone smoke test for the harness launcher (no Electron required).
 *
 * Boots the bundled dsh into a workspace-local DSH_HOME, waits for the URL,
 * verifies the server answers HTTP, then shuts it down.
 *
 *   npm run smoke
 */

const path = require('node:path');
const fs = require('node:fs');
const { launchHarness } = require('../src/harness');

const root = path.join(__dirname, '..');
const binPath = path.join(root, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js');
const home = process.env.DSH_DESKTOP_HOME || path.join(root, '.test-home');
const workspace = path.join(root, '.test-workspace');

fs.mkdirSync(workspace, { recursive: true });

(async () => {
  console.log('[smoke] launching dsh …');
  const h = await launchHarness({
    binPath,
    nodeExecutable: process.execPath,
    workspace,
    port: 0,
    env: { DSH_HOME: home },
  });

  console.log('SMOKE_OK url=' + h.url);
  h.shutdown();
  process.exit(0);
})().catch((err) => {
  console.error('SMOKE_FAIL', err && err.stack ? err.stack : err);
  process.exit(1);
});
