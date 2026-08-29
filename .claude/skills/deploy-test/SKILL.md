---
name: deploy-test
description: Use when putting a change on the libredb.org TEST site (Netlify) or checking what is currently deployed there — pushing to main, watching the test deploy, or verifying a change actually reached the test host. Not for production; releasing to libredb.org is deploy-production.
---

# Deploy to the test site

The test site is **Netlify at `https://libredb-website.netlify.app`**. It deploys itself: `.github/workflows/deploy-test.yml` fires on every push to `main`.

**Pushing to `main` IS the test deploy.** There is no separate deploy step to run, and there is nothing to approve. Production is untouched by this — it publishes only on a released tag.

## The normal path

```sh
bun run gate                      # never push a red gate; CI runs the same thing
git add -A && git commit -m "…"
git push origin main              # this deploys
```

Then watch it. The workflow is named exactly `Deploy test site (Netlify)`:

```sh
gh run list --branch main --limit 5 \
  --json workflowName,conclusion,status,databaseId \
  -q '.[] | "\(.conclusion // .status)\t\(.workflowName)\t\(.databaseId)"'

gh run watch <id> --exit-status --interval 10
```

It takes about 25 seconds. `deploy-test.yml` deliberately does not run the gate — `ci.yml` runs it on the same push in parallel, and the only thing that can break the deploy is `bun run build`, which is in the job.

## Verify the content, not the checkmark

**A green workflow proves the job ran. It does not prove the page changed.** Always fetch the thing that was supposed to change:

```sh
curl -sS -L https://libredb-website.netlify.app/<page> | grep -o '<pattern>'
```

Two grep traps that have already produced a false alarm in this repo:

- **`grep -c` counts matching lines, not matches.** `sitemap-0.xml` and compressed HTML are one long line, so `grep -c '<loc>'` returns `1` for seventeen URLs. Use `grep -o … | wc -l`.
- **Astro appends a scoped class to every styled element.** `class="ftr__title"` is emitted as `class="ftr__title astro-abc123"`, so a pattern ending in `ftr__title">` matches nothing. Use `ftr__title[^>]*>`.

A "0 results" is more often a wrong question than a broken page. Confirm the pattern against a page you know is unchanged before concluding anything.

## Deploying without pushing

To look at a local build on the real host without committing:

```sh
bun run build
netlify deploy --dir=dist --no-build --prod
```

`--prod` is correct here — it means the production of the _test site_, not libredb.org. The site id comes from `.netlify/state.json`, which is gitignored; on a fresh clone run `netlify link` first. Note this overwrites whatever the last push deployed, so the test host stops matching `main` until the next push.

## Checking locally instead

```sh
bun run build && bun run serve      # http://localhost:4321
```

**`sirv` reads `dist/` once at startup.** After a rebuild, kill and restart it — otherwise the newly hashed stylesheet 404s silently and the page renders with correct HTML and no styles, which looks exactly like a broken CSS rule. To tell the two apart, `fetch()` the stylesheet href from the page and read `r.status`.

## The test host is noindexed

`netlify.toml` sends `X-Robots-Tag: noindex, nofollow` on every path there. That file lives at the repo root and never enters `dist/`, so GitHub Pages — which has no config file — cannot pick it up. If a check ever finds that header on `libredb.org`, stop and fix it before anything else: it removes the site from search results.
