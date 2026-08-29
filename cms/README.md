# LibreDB Studio — content dashboard

The Outstatic admin for [libredb.org](https://libredb.org). It is a small Next
app that exists only to edit Markdown and commit it into this repository. It is
**never deployed** — the published site is static and carries no admin surface.

## Run it

```sh
bun install
cp .env.local.example .env.local     # fill in the two GitHub OAuth values
bun run dev                          # http://localhost:3000/outstatic
```

### GitHub OAuth app

Settings → Developer settings → OAuth Apps → New OAuth App:

| Field                      | Value                                          |
| -------------------------- | ---------------------------------------------- |
| Homepage URL               | `http://localhost:3000/`                       |
| Authorization callback URL | `http://localhost:3000/api/outstatic/callback` |

One OAuth app supports exactly one callback URL. If you ever need the dashboard
on a deployed URL as well, that is a second app with its own id and secret.

## What it writes

`../outstatic/content/posts/<slug>.md`, in the repository root — which is exactly
where the Astro site's content loader reads from. Images go to
`../public/images/`.

The commit goes **straight to the remote branch** through the GitHub API; it does
not touch your working tree. `git pull` before you expect the local dev server to
see it.

## Things that will bite you

- `OST_MONOREPO_PATH` must stay unset. It is a prefix prepended to every repo
  path, so setting it to `cms` would write content to `cms/outstatic/content/`
  instead of the root.
- `OST_REPO_BRANCH` has no working default in 2.2.4 despite the docs. Unset, the
  dashboard silently shows no content.
- `<body id="outstatic">` in `app/layout.tsx` is required, not decoration —
  every utility class in `outstatic.css` is nested inside `#outstatic { … }`.
- `moduleResolution: "bundler"` is required in `tsconfig.json`, or
  `outstatic/client` and `outstatic/server` fail to resolve.
- `tailwindcss` is pinned to exactly `4.1.10` by Outstatic's peer range. That is
  one reason this app keeps its own `node_modules` instead of sharing the Astro
  app's.
- `outstatic@canary` on npm is **older** than `latest`. Do not install it.
- Bun does not auto-install peer dependencies the way npm does, so outstatic's
  peers (`next-themes`, `tw-animate-css`, and `tailwindcss` at its exact pinned
  version) are declared here directly. Dropping them fails the build with
  `Module not found: Can't resolve 'next-themes'`.
- `typescript` stays on 6.x: `next build` cannot detect the 7.x native compiler
  as installed and reinstalls it on every run, then crashes.
