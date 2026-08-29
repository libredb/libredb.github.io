/**
 * Renders scripts/og/template.html into public/og/default.png at 1200x630.
 *
 * The card is drawn in a real browser rather than rasterised from SVG so that
 * the shipped webfaces are used — librsvg would fall back to a system font and
 * the card would not match the site.
 *
 * Requires a built dist/ (the template loads the site's own CSS, brand lockup
 * and hero plate through it) and a local Chrome. Run from the repo root:
 *
 *     bun run build && bun run scripts/og/build-og.mjs
 */
import { createServer } from 'node:http';
import { readFile, writeFile, copyFile, unlink } from 'node:fs/promises';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { launch } from 'chrome-launcher';

const DIST = 'dist';
const OUT = 'public/og/default.png';

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('No dist/ — run `bun run build` first.');
  process.exit(1);
}

// the built stylesheet carries the tokens and the @font-face declarations
const css = readdirSync(join(DIST, '_astro')).find((f) => f.startsWith('BaseLayout') && f.endsWith('.css'));
if (!css) {
  console.error('Could not find the base stylesheet in dist/_astro.');
  process.exit(1);
}

const template = (await readFile('scripts/og/template.html', 'utf8')).replace('__CSS__', `/_astro/${css}`);
const TEMP = join(DIST, '__og.html');
await writeFile(TEMP, template, 'utf8');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
};
const server = createServer(async (req, res) => {
  const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
  const p = normalize(join(DIST, url));
  if (existsSync(p) && statSync(p).isFile()) {
    res.writeHead(200, { 'content-type': TYPES[extname(p)] ?? 'application/octet-stream' });
    res.end(await readFile(p));
    return;
  }
  res.writeHead(404).end();
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const { port } = server.address();

const chrome = await launch({
  chromeFlags: ['--headless=new', '--disable-extensions', '--no-sandbox', '--hide-scrollbars', '--disable-gpu'],
});

try {
  const targets = await fetch(`http://127.0.0.1:${chrome.port}/json/list`).then((r) => r.json());
  const ws = targets.find((t) => t.type === 'page').webSocketDebuggerUrl;
  const { WebSocket } = await import('node:worker_threads').then(() => globalThis);
  const socket = new WebSocket(ws);
  await new Promise((r) => (socket.onopen = r));

  let id = 0;
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const msgId = ++id;
      const onMessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.id !== msgId) return;
        socket.removeEventListener('message', onMessage);
        resolve(data.result);
      };
      socket.addEventListener('message', onMessage);
      socket.send(JSON.stringify({ id: msgId, method, params }));
    });

  await send('Emulation.setDeviceMetricsOverride', {
    width: 1200,
    height: 630,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send('Page.enable');
  await send('Page.navigate', { url: `http://127.0.0.1:${port}/__og.html` });
  await new Promise((r) => setTimeout(r, 2500)); // let the plate and faces settle
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  // sharp ships with astro; recompress so the card is a sane social payload
  const sharp = (await import('sharp')).default;
  const png = await sharp(Buffer.from(shot.data, 'base64'))
    .resize(1200, 630, { fit: 'cover' })
    .png({ compressionLevel: 9, palette: true, quality: 90 })
    .toBuffer();
  await writeFile(OUT, png);
  socket.close();
  console.log(`wrote ${OUT} (${Math.round(png.length / 1024)} KB)`);
} finally {
  await chrome.kill();
  server.close();
  await unlink(TEMP).catch(() => {});
}

// keep a copy inside dist so the just-built site can serve it too
await copyFile(OUT, join(DIST, 'og', 'default.png')).catch(async () => {
  const { mkdir } = await import('node:fs/promises');
  await mkdir(join(DIST, 'og'), { recursive: true });
  await copyFile(OUT, join(DIST, 'og', 'default.png'));
});
