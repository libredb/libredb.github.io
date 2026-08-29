import type { APIRoute } from 'astro';
import { redirects, type Redirect } from '../../data/redirects';
import { canonicalUrl, site } from '../../lib/site';

/**
 * One tombstone per retired URL — see src/data/redirects.ts for the map and for
 * why these are temporary.
 *
 * GitHub Pages serves static files and cannot issue a 301, so this is the best
 * a static host has: a zero-delay meta refresh for the visitor, a
 * `location.replace` so the dead URL never enters the back-button history, and
 * a canonical link so a crawler consolidates the ranking signal onto the page
 * that replaced it. All three are needed — the script alone misses crawlers and
 * clients without JS, the refresh alone leaves a history trap, and neither one
 * tells a crawler which URL is now the real one.
 *
 * This is an endpoint writing literal bytes rather than a .astro page, and the
 * route is `[...legacy]/index.html` rather than `[...legacy]`, so the file
 * lands at dist/<old-path>/index.html and GitHub Pages serves it as the
 * directory index. Written as an .astro page instead, the build extracted the
 * inline <style> into a render-blocking stylesheet and injected the prefetch
 * module — two network requests on a page that exists for one frame, both of
 * them slower than the redirect they were delaying. The page below is under a
 * kilobyte and requests nothing.
 */
export function getStaticPaths() {
  return redirects.map((r) => ({
    // getStaticPaths params are path segments, so the leading slash comes off.
    params: { legacy: r.from.replace(/^\//, '') },
    props: r,
  }));
}

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * `to` reaches three different parsers — an HTML attribute, a JS string literal
 * and the href — so it is escaped for HTML and JSON-encoded for the script. The
 * values are ours and contain nothing exotic today; the encoding is here so
 * that stays true of whatever gets added to the map later.
 */
const page = ({ to, canonical, label }: Redirect) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<!-- Zero delay: WCAG 2.2.1 exempts an instant refresh, which is a redirect rather than a time limit. -->
<meta http-equiv="refresh" content="0; url=${escape(to)}">
<link rel="canonical" href="${escape(canonicalUrl(canonical))}">
<title>Moved &mdash; ${escape(label)} | ${escape(site.name)}</title>
<style>:root{color-scheme:dark}body{margin:0;min-height:100vh;display:grid;place-content:center;gap:.75rem;padding:2rem;background:#0b0d10;color:#c8cdd6;font:15px/1.6 ui-sans-serif,system-ui,sans-serif;text-align:center}a{color:#7aa2ff}</style>
</head>
<body>
<p>This page moved.</p>
<p><a href="${escape(to)}">Continue to ${escape(label)}</a></p>
<script>location.replace(${JSON.stringify(to)})</script>
</body>
</html>
`;

export const GET: APIRoute = ({ props }) =>
  new Response(page(props as Redirect), { headers: { 'content-type': 'text/html; charset=utf-8' } });
