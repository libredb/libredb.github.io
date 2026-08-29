# libredb.org

The LibreDB Studio marketing site: a static Astro build, with the blog edited
through Outstatic and committed back into this repository as Markdown.

The design handoff it was built from is still here — `README.md`,
`design/Home.dc.html` and `design-system/` are reference input, not build input.
Deviations from them are listed in **[DECISIONS.md](DECISIONS.md)**.

---

## Run it

```sh
bun install            # bun 1.4.0 — the version in .bun-version is what CI uses
bun run dev            # http://localhost:4321
```

## The gate

```sh
bun run gate           # typecheck -> format -> lint -> knip -> build -> tests  (must be green)
bun run verify         # gate + secret scan + Lighthouse accessibility >= 95
```

Order matters: the tests read `dist/`, so they run after the build. A missing
build fails loudly rather than passing vacuously — `bunfig.toml` preloads
`tests/setup.ts`, which is the bun equivalent of vitest's `globalSetup`.

`.githooks/` runs the cheap half on commit (`secrets`, `format`) and the whole
gate on push. `prepare` points `core.hooksPath` at it on install.

| Script                | What it does                                                                                                                                                                      |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun run typecheck`   | `astro check` — types across `.astro` and `.ts`                                                                                                                                   |
| `bun run build`       | static build into `dist/`                                                                                                                                                         |
| `bun run build:clean` | `astro build --force`; use it when a content-schema change seems to have no effect — the real store is `node_modules/.astro/data-store.json`, and deleting `.astro/` does nothing |
| `bun test`            | 62 assertions over `dist/`, the tokens, the content and the CMS config                                                                                                            |
| `bun run lint`        | `oxlint` — correctness as errors, suspicious as warnings                                                                                                                          |
| `bun run format`      | `prettier --check .`; `format:fix` writes                                                                                                                                         |
| `bun run knip`        | dead files, exports and dependencies                                                                                                                                              |
| `bun run secrets`     | `secretlint` over the whole tree                                                                                                                                                  |
| `bun run audit`       | `bun audit`; advisory in CI, never blocking                                                                                                                                       |
| `bun run a11y`        | serves `dist/` on a free port and runs Lighthouse over five routes                                                                                                                |
| `bun run cms`         | starts the Outstatic dashboard (see below)                                                                                                                                        |

`.github/workflows/ci.yml` runs this gate on every PR and push to `main`, plus a
second job that builds the CMS app. It never deploys. `.github/workflows/deploy.yml`
publishes to GitHub Pages, and it only runs when a **GitHub release is published**
(or when dispatched by hand).

> Saving a post in the CMS commits Markdown to `main`, which runs CI but does not
> publish. Cut a release to put new posts live.

### Why TypeScript 6, not 7

`typescript` is pinned to `6.0.3` in both apps. TypeScript 7's native compiler
does not expose the programmatic API yet, and two things here need it: `astro
check` refuses to start against it, and `next build` cannot see it as installed
(it re-installs `typescript` on every run through yarn and then its worker
crashes with `The "id" argument must be of type string`). Dependabot is
configured to hold `typescript` below 7 until both land support —
see https://github.com/withastro/roadmap/discussions/1321.

## Layout

```
site.config.json        domain, repo, links, routes — the single source of truth
astro.config.mjs        derives `site` from it; sets no `base` (custom domain)

src/
  styles/
    ds/                 VERBATIM copy of design-system/ — never edited
    global.css          the entry: ds tokens + font override + site base
    console.css         terminal palette the design system has no tokens for
    a11y.css            the contrast lifts, each with its measured ratio
    diagram.css         shared by the two network diagrams
    prose.css           long-form article body (16px/1.75 at a 680px measure)
  data/                 all page copy, lifted from the prototype
  components/
    layout/             SiteHeader, SiteFooter
    home/               one component per homepage section
    blog/               PostCard, TableOfContents
    common/             CopyBox, BrowserFrame, Icon
  scripts/              vanilla TS: switcher, reveal, theme, nav, copy, toc,
                        arch-steps, sql-typing
  layouts/              BaseLayout (head, SEO, JSON-LD), StubPage
  content.config.ts     the posts collection, reading outstatic/content/posts
  pages/

outstatic/content/      what the CMS writes; what Astro reads
cms/                    the Next app that hosts the Outstatic dashboard
scripts/                contrast maths, the a11y gate, logo fetch, OG card
tests/                  the gate
```

### Where a change goes

| Change                            | File                                                             |
| --------------------------------- | ---------------------------------------------------------------- |
| Homepage wording                  | `src/data/home.ts`                                               |
| An engine's description or limits | `src/data/engines.ts`                                            |
| A blog post                       | the CMS, or `outstatic/content/posts/*.md`                       |
| Domain, repo, external links      | `site.config.json`                                               |
| A design token                    | `design-system/` **and** `src/styles/ds/` — the test hashes both |
| A contrast lift                   | `src/styles/a11y.css`, with the measured ratio in a comment      |

## Design system

`src/styles/ds/` is a byte-identical copy of `design-system/`; it is vendored so
Vite can resolve the relative `url()` references inside `tokens/theme.css`.
`tests/ds-integrity.test.ts` fails on any drift between the two.

Styling uses `var(--token)` only. The two exceptions — the console palette and
the a11y lifts — are separate, documented files with their own tests.

`tokens/fonts.css` is deliberately not imported; see DECISIONS.md § Fonts.

## The blog and the CMS

Astro reads `outstatic/content/posts/**/*.md` through the content layer at build
time. There is no database and no runtime CMS.

### Editing

```sh
cd cms && bun install
cp .env.local.example .env.local     # then fill in the two GitHub OAuth values
bun run dev                          # http://localhost:3000/outstatic
```

You need a GitHub OAuth app (Settings → Developer settings → OAuth Apps):

- Homepage URL: `http://localhost:3000/`
- Authorization callback URL: `http://localhost:3000/api/outstatic/callback`

One OAuth app supports exactly one callback URL. Keeping the dashboard
localhost-only means the credentials never leave your machine, and the published
site never carries an admin surface.

**Saving commits straight to the remote branch** via the GitHub API — it does not
touch your working tree. After a save:

- CI picks up the commit and republishes the site.
- Locally, `git pull` before you expect `astro dev` to see the change.

### Post fields

`title`, `status`, `slug`, `publishedAt` and `author` are Outstatic built-ins.
`description`, `coverImage`, `lang` and `tags` are custom fields, already defined
in `outstatic/content/posts/schema.json` — a collection created from scratch in
the dashboard starts with none of them.

`lang` (`en` / `tr`) drives the page's `lang` attribute, the date format
(`21.08.2026` in Turkish, `21 August 2026` in English) and the reading-time and
table-of-contents labels.

### If a save does not appear on the site

In this order:

1. GitHub → Actions → the run for that commit.
2. Did the **gate** step fail? Broken content is blocked _before_ deploy, by
   design — the site keeps serving the last good build, which from the editor's
   side looks like "my change vanished".
3. Read the failure. A schema error names the file and the field.

## Deploying

Push to `main`. The workflow runs the gate and, if green, publishes `dist/` to
GitHub Pages.

The custom domain lives in `public/CNAME`; `site.config.json` is what everything
else derives from, and `tests/domain.test.ts` fails if any copy of the domain
drifts out of step.

## Regenerating assets

```sh
./scripts/fetch-engine-logos.sh          # the sixteen engine marks
node scripts/logo-contrast-report.mjs    # how each reads on the white plate
bun run build && bun run scripts/og/build-og.mjs   # public/og/default.png
node scripts/contrast.mjs "#7f87a7" "#141829"   # one contrast pair
```

## Browser support

Baseline modern browsers. The site uses `color-mix()`, `text-wrap: balance`,
`:has()`-free selectors and CSS nesting-free syntax. Everything is server
rendered: with JavaScript disabled every panel's first tab is visible, the
diagrams show their finished state, and nothing is hidden behind a script.
