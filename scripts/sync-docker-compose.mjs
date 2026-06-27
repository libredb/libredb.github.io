// =============================================================================
// Sync libredb-studio's docker-compose.example.yml into the website.
// =============================================================================
// The canonical file lives in the separate `libredb-studio` repo. We pull a
// copy into this repo at build time so the /docker-compose-example/ page can
// render it and visitors can download it raw from libredb.org.
//
// Writes the same content to two committed destinations:
//   - src/data/docker-compose.example.yml      (imported by the page as ?raw)
//   - public/docker-compose.example.yml         (served verbatim for curl/wget)
//
// Resolution order (first that succeeds wins). On total failure we keep any
// existing committed copy and warn — the build must never fail because the
// upstream repo is briefly unreachable.
//   1. Remote raw GitHub URL (works on CI; libredb-studio is public)
//   2. Local sibling checkout ../libredb-studio/... (fast local dev)
//   3. Existing committed copy (offline / upstream not yet pushed)
// =============================================================================

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const REMOTE_URL =
  'https://raw.githubusercontent.com/libredb/libredb-studio/main/docker-compose.example.yml';
const LOCAL_SIBLING = resolve(ROOT, '../libredb-studio/docker-compose.example.yml');

const DEST_DATA = resolve(ROOT, 'src/data/docker-compose.example.yml');
const DEST_PUBLIC = resolve(ROOT, 'public/docker-compose.example.yml');

async function fromRemote() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(REMOTE_URL, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (!text.trim()) throw new Error('empty response');
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

async function fromLocalSibling() {
  if (!existsSync(LOCAL_SIBLING)) throw new Error('local sibling not found');
  return readFile(LOCAL_SIBLING, 'utf8');
}

async function resolveContent() {
  try {
    const text = await fromRemote();
    console.log('[sync-docker-compose] using remote source:', REMOTE_URL);
    return text;
  } catch (err) {
    console.warn(
      `[sync-docker-compose] remote fetch failed (${err.message}); trying local sibling`,
    );
  }

  try {
    const text = await fromLocalSibling();
    console.log('[sync-docker-compose] using local sibling:', LOCAL_SIBLING);
    return text;
  } catch (err) {
    console.warn(`[sync-docker-compose] local sibling unavailable (${err.message})`);
  }

  return null;
}

async function writeBoth(content) {
  await mkdir(dirname(DEST_DATA), { recursive: true });
  await writeFile(DEST_DATA, content, 'utf8');
  await writeFile(DEST_PUBLIC, content, 'utf8');
  console.log('[sync-docker-compose] wrote', DEST_DATA);
  console.log('[sync-docker-compose] wrote', DEST_PUBLIC);
}

const content = await resolveContent();

if (content) {
  await writeBoth(content);
} else if (existsSync(DEST_DATA) && existsSync(DEST_PUBLIC)) {
  console.warn('[sync-docker-compose] keeping existing committed copy — no fresh source available');
} else {
  console.error('[sync-docker-compose] FATAL: no source available and no committed copy exists');
  process.exit(1);
}
