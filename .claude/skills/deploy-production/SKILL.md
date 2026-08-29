---
name: deploy-production
description: Use when publishing libredb.org to production — cutting a GitHub release, tagging a version, deploying to GitHub Pages, verifying the live site after a deploy, or rolling one back. For the Netlify test site, use deploy-test instead.
---

# Deploy to production (libredb.org)

Production is **GitHub Pages at `https://libredb.org`**, and it publishes on one event only: a **published GitHub release**. `.github/workflows/deploy.yml` is triggered by `release: published`.

**Pushing to `main` does not publish.** Merging a pull request does not publish. That separation is deliberate and `tests/domain.test.ts` asserts it from the workflows' `on:` blocks — production has no `push:` trigger, the test workflow has no `release:` trigger.

Creating a release changes the live site. Confirm with the user before cutting one unless they asked for it in the current turn.

## Before tagging

1. **Be on `main`, clean, and in sync.** A tag on a commit that is not pushed publishes something nobody can see in the repo.

   ```sh
   git status --short                         # must be empty
   git rev-parse HEAD origin/main | uniq | wc -l   # must print 1
   ```

2. **Verify the exact commit you are about to tag.** Do not trust a green CI run from an earlier commit — check `git log` for commits you have not seen, read them, then:

   ```sh
   bun run verify      # gate + secretlint + Lighthouse a11y on every route
   ```

3. **Pick the version, and keep the tag and `package.json` in step.** `package.json` is the declared intent; if it already says the next version, tag that. If they disagree, fix one before tagging — a tag that does not match the package version makes every later "what shipped when" question ambiguous.

   Existing tags are `vMAJOR.MINOR.PATCH`. Release titles follow `v1.0.0 — a lowercase phrase saying what changed`.

## Cutting it

```sh
gh release create v<version> --target main \
  --title "v<version> — <what changed>" \
  --notes-file <path>
```

Write the notes as prose about what a reader gains, not a commit list. `git log --oneline v<previous>..HEAD` is the input, not the output.

Then watch the deploy — the workflow is named exactly `Deploy to GitHub Pages`:

```sh
gh run list --limit 5 --json workflowName,event,conclusion,status,databaseId \
  -q '.[] | "\(.conclusion // .status)\t\(.event)\t\(.workflowName)\t\(.databaseId)"'
gh run watch <id> --exit-status --interval 10
```

## After it goes live — check these, in this order

A green workflow proves the job ran. These are the things that have actually been at risk:

**1. The Helm chart repository still resolves.** `https://libredb.org/libredb-studio/` is a _separate_ Pages deployment, published from the `libredb-studio` repo's own `gh-pages` branch, and it is what `helm repo add` points at in the docs, the README and the OpenShift operator manifests. It should be untouched by this deploy — verify that it is, rather than assuming:

```sh
helm repo add libredb-verify https://libredb.org/libredb-studio/ && \
  helm search repo libredb-verify -o table && \
  helm repo remove libredb-verify
```

**2. `noindex` did not leak from the test host.** The Netlify test site sends `X-Robots-Tag: noindex`. If that ever appears on production it removes the whole site from search results:

```sh
curl -sSI -L https://libredb.org/ | grep -i x-robots-tag   # must print nothing
curl -sS -L https://libredb.org/ | grep -o '<meta name="robots"[^>]*>'   # must print nothing
```

**3. The retired URLs still redirect.** They are the reason old links and search results do not 404:

```sh
for p in /providers /manifesto /docker-compose-example /database \
         /database-architecture /database-reliability /tech-stack; do
  printf "%-26s " "$p"
  curl -sS -L "https://libredb.org$p" | grep -o 'content="0; url=[^"]*"' | head -1
done
```

**4. `.well-known/` is served.** `org.flathub.VerifiedApps.txt` is Flathub's ownership proof and `security.txt` is referenced by the security policy. The deploy workflow needs `include-hidden-files: true` on the artifact upload for these to survive; without it they 404 with no error anywhere.

**5. The sitemap holds the real pages and no tombstones.**

```sh
curl -sS https://libredb.org/sitemap-0.xml | grep -o '<loc>[^<]*</loc>' | sed 's/<[^>]*>//g'
```

Do not use `grep -c` for this — it counts lines, and the sitemap is one line, so it will report `1`.

## Rolling back

There is no undo on a Pages deploy, but `deploy.yml` also accepts `workflow_dispatch`, and a dispatch can name a ref. Re-publishing an earlier tag republishes that build:

```sh
gh workflow run deploy.yml --ref v<previous>
```

Fix forward when you can — a rollback republishes the old site including its old bugs, and the release list will not explain why.
