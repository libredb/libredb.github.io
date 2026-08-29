/**
 * Accessibility gate: serves dist/ and fails the process if any audited route
 * scores below the threshold.
 *
 *   node scripts/lighthouse-gate.mjs [--min 95] [--route /blog] [--json out.json]
 *
 * Two lessons are baked in:
 *
 *  1. NEVER bind a fixed port. `sirv --port 4321` prints "Port 4321 is taken;
 *     using 58095 instead" and exits 0 — Lighthouse then audits whatever else is
 *     on 4321 and reports a score for a different website. This binds :0, reads
 *     the port the OS actually gave us, and probes the origin for a known marker
 *     before auditing.
 *  2. The lighthouse CLI exits 0 no matter the score, so the gate has to read the
 *     score itself.
 */
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
// `resolve` is aliased: these files also use Promise executors whose own
// `resolve` would shadow it, inside the very code that decides whether a
// request escapes the served directory.
import { extname, join, resolve as resolvePath, sep } from 'node:path';
import { launch } from 'chrome-launcher';
import lighthouse from 'lighthouse';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const MIN = Number(flag('min', 95));
const DIST = 'dist';
const ROUTES = args.includes('--route')
  ? args.filter((a, i) => args[i - 1] === '--route')
  : [
      '/',
      '/blog',
      '/blog/the-tool-goes-to-the-data',
      '/faq',
      '/get-started',
      // Every standalone content page is audited. /playground earns its slot
      // twice over: it is the only route with an interactive surface built by
      // script at runtime, so it is the one axe-core findings can appear on
      // without anyone touching a template.
      '/playground',
      '/databases',
      '/features',
      '/open-source',
      '/deploy',
      '/docker-compose',
      '/libredb-database',
      '/security',
      '/support',
      '/platform',
      '/compare',
      '/privacy-policy',
    ];

if (!existsSync(join(DIST, 'index.html'))) {
  console.error(`No ${DIST}/index.html — run \`bun run build\` first.`);
  process.exit(1);
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
};

/**
 * Absolute path inside {root}, or null when the request escapes it.
 *
 * A request path is attacker-controlled even on a loopback port — any process on
 * this machine can reach it while the server is up. Containment is asserted
 * AFTER resolution rather than by scrubbing `..` out of the string, because a
 * scrub has to be right about every encoding and a comparison against the
 * resolved root does not.
 */
const within = (root, ...parts) => {
  const p = resolvePath(root, ...parts);
  return p === root || p.startsWith(root + sep) ? p : null;
};

/** Request path, percent-decoded and made relative. Malformed escapes 404. */
const requestPath = (req) => {
  try {
    return decodeURIComponent((req.url ?? '/').split('?')[0]).replace(/^\/+/, '');
  } catch {
    return null;
  }
};

const ROOT = resolvePath(DIST);

/** Reads from disk on every request — no boot-time manifest to go stale. */
const server = createServer(async (req, res) => {
  const url = requestPath(req);
  const candidates =
    url === null ? [] : [within(ROOT, url), within(ROOT, `${url}.html`), within(ROOT, url, 'index.html')];
  for (const p of candidates) {
    if (p === null || !existsSync(p) || !statSync(p).isFile()) continue;
    res.writeHead(200, { 'content-type': TYPES[extname(p)] ?? 'application/octet-stream' });
    res.end(await readFile(p));
    return;
  }
  res.writeHead(404).end('not found');
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const origin = `http://127.0.0.1:${port}`;

// probe: prove we are auditing OUR build, not a stranger's dev server
const probe = await fetch(`${origin}/`).then((r) => r.text());
if (!probe.includes('LibreDB Studio')) {
  console.error(`Probe failed: ${origin}/ did not serve this project's build.`);
  server.close();
  process.exit(1);
}
console.log(`serving ${DIST} on ${origin} (probe ok)`);

const chrome = await launch({
  chromeFlags: ['--headless=new', '--disable-extensions', '--no-sandbox', '--disable-gpu'],
});

const results = [];
let failed = false;

try {
  for (const route of ROUTES) {
    const runnerResult = await lighthouse(
      `${origin}${route}`,
      { port: chrome.port, output: 'json', logLevel: 'error' },
      {
        extends: 'lighthouse:default',
        settings: {
          onlyCategories: ['accessibility'],
          formFactor: 'desktop',
          screenEmulation: { mobile: false, width: 1440, height: 900, deviceScaleFactor: 1, disabled: false },
          throttlingMethod: 'provided',
        },
      },
    );
    const lhr = runnerResult.lhr;
    const score = Math.round((lhr.categories.accessibility.score ?? 0) * 100);
    const fails = Object.values(lhr.audits)
      .filter((a) => a.score !== null && a.score < 1 && a.scoreDisplayMode === 'binary')
      .map((a) => a.id);

    results.push({ route, score, fails });
    const ok = score >= MIN;
    failed ||= !ok;
    console.log(
      `${ok ? 'PASS' : 'FAIL'}  a11y ${String(score).padStart(3)}  ${route}` +
        (fails.length ? `   (${fails.join(', ')})` : ''),
    );
  }
} finally {
  await chrome.kill();
  server.close();
}

const out = flag('json', null);
if (out) await writeFile(out, JSON.stringify(results, null, 2));

if (failed) {
  console.error(`\nAccessibility gate failed: a route scored below ${MIN}.`);
  process.exit(1);
}
console.log(`\nAll ${results.length} route(s) >= ${MIN}.`);
