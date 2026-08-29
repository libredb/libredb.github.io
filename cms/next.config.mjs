/** @type {import('next').NextConfig} */
// `withOutstatic` is typegen for Next consumers only — Astro reads the Markdown
// directly, so it is deliberately not used here.
//
// Next warns that it inferred the workspace root from the parent directory,
// because two lockfiles live in this tree (the Astro site's and this app's), and
// suggests pinning `turbopack.root`. DO NOT. Pinning it to this directory makes
// Turbopack fail to resolve `outstatic/outstatic.css`:
//
//   Error: Cannot find module 'outstatic/outstatic.css'  -> /outstatic 500
//
// Verified with both `import.meta.dirname` and an explicitly resolved URL, so it
// is not a path bug. The warning is cosmetic; the inferred root is what works.
const nextConfig = {
  transpilePackages: ['outstatic'],
};

export default nextConfig;
