import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import checks from './checks.js';
import navigationChecks from './navigation-checks.js';

const args = process.argv.slice(2);
if (args.some(arg => arg !== '--headless')) {
  console.error('Usage: npm run test:browser -- [--headless]');
  process.exit(1);
}
const root = fileURLToPath(new URL('../', import.meta.url));
const artifactDirectory = fileURLToPath(new URL('../browser-artifacts/', import.meta.url));
let browser;
let server;
let cleanupPromise;

function cleanup() {
  cleanupPromise ??= (async () => {
    try { await browser?.close(); }
    finally {
      if (server?.pid && server.exitCode === null && server.signalCode === null) {
        const exited = once(server, 'exit');
        server.kill();
        const force = setTimeout(() => server.kill('SIGKILL'), 3000);
        try { await exited; } finally { clearTimeout(force); }
      }
    }
  })();
  return cleanupPromise;
}
for (const [signal, code] of [['SIGINT', 130], ['SIGTERM', 143]]) {
  process.once(signal, () => {
    cleanup().finally(() => process.exit(code));
  });
}

async function startServer() {
  server = spawn('python3', ['server.py', '--port', '0'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  let errors = '';
  server.stderr.on('data', chunk => { errors = (errors + chunk).slice(-4000); });
  const baseUrl = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Local server startup timed out.')), 10000);
    const finish = (error, url) => {
      clearTimeout(timer);
      server.stdout.off('data', ready);
      if (error) reject(error); else resolve(url);
    };
    const ready = chunk => {
      output += chunk;
      const match = output.match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) finish(null, match[0]);
    };
    server.stdout.on('data', ready);
    server.once('error', error => finish(error));
    server.once('exit', code => finish(new Error(`Local server exited (${code}). ${errors}`)));
  });
  const response = await fetch(baseUrl, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Local server returned HTTP ${response.status}.`);
  return baseUrl;
}

async function runSuite(name, run, hasTouch, baseUrl) {
  console.log(`Running ${name}…`);
  const context = await browser.newContext({ locale: 'en-US', timezoneId: 'UTC', hasTouch, acceptDownloads: true });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.setDefaultNavigationTimeout(10000);
  const errors = [];
  context.on('weberror', error => { errors.push(error.error().stack ?? error.error().message); });
  let timer;
  try {
    const groups = await Promise.race([
      run(page, { baseUrl, artifactDirectory }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${name} exceeded two minutes.`)), 120000); }),
    ]);
    if (errors.length) throw new Error(`Browser errors:\n${errors.join('\n')}`);
    for (const group of groups) console.log(`  PASS ${group}`);
  } catch (error) {
    await page.screenshot({ path: `${artifactDirectory}/${name}-failure.png`, fullPage: true, timeout: 5000 }).catch(() => {});
    if (errors.length) console.error(errors.join('\n'));
    throw error;
  } finally {
    clearTimeout(timer);
    await context.close();
  }
}

try {
  await mkdir(artifactDirectory, { recursive: true });
  const baseUrl = await startServer();
  browser = await chromium.launch({ headless: args.includes('--headless') });
  await runSuite('checks', checks, false, baseUrl);
  await runSuite('navigation', navigationChecks, true, baseUrl);
  console.log(`Browser suites passed. Screenshots and JSON: ${artifactDirectory}`);
} catch (error) {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
} finally {
  await cleanup();
}
