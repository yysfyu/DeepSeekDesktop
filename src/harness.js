'use strict';

/**
 * Pure-Node launcher for the DeepSeek Harness Web profile.
 *
 * Kept free of Electron imports so it can be exercised with plain `node`
 * (see scripts/smoke.js) and reused verbatim from the Electron main process.
 *
 * The harness prints its canonical URL once the HTTP server is bound:
 *
 *     dsh web: http://127.0.0.1:<port>   (optionally:  (LAN: ...))
 *
 * We spawn `dsh web --host 127.0.0.1 --port 0` so the OS assigns a free port,
 * then parse that line and wait until the server actually answers HTTP.
 */

const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const http = require('node:http');

const URL_LINE_RE = /dsh web:\s+(https?:\/\/[^\s]+)/;

/** Default location of the bundled dsh CLI entry (node_modules/@deepseek-ai/dsh/lib/bin.js). */
function defaultDshBin() {
  return path.join(__dirname, '..', 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js');
}

/**
 * Locate a Node.js executable to run the harness under.
 *
 * The harness loads native addons (node-addon-require-builtin, node-pty, koffi)
 * that are ABI-bound to the Node they were installed against, so it must run
 * under the machine's Node — NOT under Electron's bundled Node (a different
 * major/ABI). We probe known absolute locations first because a Finder-launched
 * app inherits a minimal PATH that omits /opt/homebrew.
 *
 * @returns {string} path to a node binary (falls back to `node` on PATH).
 */
function detectNode() {
  const candidates = [
    process.env.DSH_NODE,
    '/opt/homebrew/bin/node',
    '/usr/local/bin/node',
    '/opt/homebrew/opt/node/bin/node',
    '/usr/bin/node',
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch {}
  }
  return 'node';
}

/** Poll an HTTP URL until it answers, or reject after the timeout. */
function waitForHttp(url, timeoutMs = 15000, intervalMs = 200) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const attempt = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve({ url, status: res.statusCode });
      });
      req.on('error', () => {
        if (Date.now() > deadline) {
          reject(new Error(`server at ${url} did not become ready within ${timeoutMs}ms`));
        } else {
          setTimeout(attempt, intervalMs);
        }
      });
      req.setTimeout(1500, () => req.destroy());
    };
    attempt();
  });
}

/**
 * Launch the DeepSeek Harness Web profile and resolve once it is serving HTTP.
 *
 * @param {object} [options]
 * @param {string} [options.binPath]  Absolute path to dsh's bin.js.
 * @param {string} [options.nodeExecutable]  Executable to run the script with.
 *   Defaults to a detected system Node (see {@link detectNode}); the harness's
 *   native addons are ABI-bound to system Node, so Electron's own Node must not
 *   be used here.
 * @param {string} [options.workspace]  Working directory (the harness "workspace root").
 * @param {number} [options.port]  Listen port; 0 lets the OS pick a free one.
 * @param {string} [options.host]  Bind host.
 * @param {object} [options.env]  Extra environment variables for the child.
 * @param {number} [options.readyTimeoutMs]
 * @param {(code:number|null, signal:string|null) => void} [options.onExit]
 * @returns {Promise<{url:string, child:import('node:child_process').ChildProcess, shutdown:()=>void, stdout:()=>string, stderr:()=>string}>}
 */
function launchHarness(options = {}) {
  const {
    binPath = defaultDshBin(),
    nodeExecutable = detectNode(),
    workspace = os.homedir(),
    port = 0,
    host = '127.0.0.1',
    env = {},
    readyTimeoutMs = 30000,
    onExit = () => {},
  } = options;

  return new Promise((resolve, reject) => {
    if (!fs.existsSync(binPath)) {
      reject(new Error(`dsh binary not found: ${binPath}`));
      return;
    }

    const args = ['web', '--host', host, '--port', String(port)];

    // Finder-launched GUI apps often inherit a minimal PATH; give the harness's
    // bash tool a usable default while still honoring any existing PATH.
    const defaultPath = '/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin';
    const childEnv = {
      ...process.env,
      ...env,
      PATH: process.env.PATH || defaultPath,
    };

    const child = spawn(nodeExecutable, [binPath, ...args], {
      cwd: workspace,
      env: childEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let url = null;
    let settled = false;

    const settle = (fn) => {
      if (settled) return;
      settled = true;
      clearInterval(urlTimer);
      clearTimeout(hardTimer);
      fn();
    };

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
      if (!url) {
        const m = URL_LINE_RE.exec(stdout);
        if (m) url = m[1];
      }
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (err) => {
      const msg =
        err && err.code === 'ENOENT'
          ? new Error(
              `Could not launch node (${nodeExecutable}). Install Node.js 22+ and try again, or set DSH_NODE to a node binary. Original: ${err.message}`
            )
          : err;
      settle(() => reject(msg));
    });

    child.on('exit', (code, signal) => {
      onExit(code, signal);
      if (!settled && !url) {
        settle(() =>
          reject(
            new Error(
              `dsh exited before announcing its URL (code=${code}, signal=${signal})\nstderr:\n${stderr.slice(-4000)}`
            )
          )
        );
      }
    });

    const urlTimer = setInterval(() => {
      if (!url || settled) return;
      settle(() => {
        waitForHttp(url, readyTimeoutMs)
          .then(() =>
            resolve({
              url,
              child,
              shutdown,
              stdout: () => stdout,
              stderr: () => stderr,
            })
          )
          .catch(reject);
      });
    }, 100);

    const hardTimer = setTimeout(() => {
      if (settled) return;
      settle(() => {
        try {
          child.kill('SIGKILL');
        } catch {}
        reject(
          new Error(
            `dsh did not announce a URL within ${readyTimeoutMs}ms\nstdout:\n${stdout.slice(-4000)}\nstderr:\n${stderr.slice(-4000)}`
          )
        );
      });
    }, readyTimeoutMs);

    function shutdown() {
      clearInterval(urlTimer);
      clearTimeout(hardTimer);
      if (child.exitCode === null && !child.killed) {
        try {
          child.kill('SIGTERM');
        } catch {}
        const killer = setTimeout(() => {
          if (child.exitCode === null) {
            try {
              child.kill('SIGKILL');
            } catch {}
          }
        }, 3000);
        if (killer.unref) killer.unref();
      }
    }
  });
}

module.exports = { launchHarness, waitForHttp, defaultDshBin, detectNode, URL_LINE_RE };
