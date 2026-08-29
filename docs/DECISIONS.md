# Implementation decisions

Every place the build departs from `design/Home.dc.html`, `README.md` or
`design-system/`, why, and what it cost. Read this alongside the handoff.

Anything not listed here is a faithful port.

---

## Stack

| Choice                                              | Why                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Astro 7.2.9, `output: 'static'`                     | Fixed by `CLAUDE_PROMPT.md`.                                                                                                                                                                                                                                                                                                                                                              |
| Outstatic 2.2.4 in `cms/`, a separate Next 16 app   | Outstatic's admin is Next-only. Keeping it a sibling package with its own `node_modules` also side-steps its exact `tailwindcss@4.1.10` peer pin, which would fight the Astro app's tree.                                                                                                                                                                                                 |
| **Vanilla TypeScript modules, no island framework** | The prompt allows either. Every interactive surface here is "toggle an attribute on server-rendered markup" — the cycler, the flow toggle, both tab sets, the engines grid, copy buttons, scroll reveal. A framework would ship a runtime to do what six `data-*` attributes already do, and it would cost hydration time on a page whose LCP is a hero image. Total shipped JS is ~6 KB. |
| GitHub Pages, custom domain, **no `base`**          | `base` is only for a project page (`user.github.io/repo`). With `public/CNAME` the site is served from the root; setting `base` would double-prefix every asset. Locked by `tests/domain.test.ts`.                                                                                                                                                                                        |

## Toolchain

Aligned with the sibling `libredb-website` repo so both sites are operated the
same way. What that alignment cost, and where it could not be met:

| Choice                                                                           | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Bun 1.4.0** (`.bun-version`, `bunfig.toml`), one `bun.lock` per app            | Matches the sibling repo; `[install] exact = true` keeps every version pinned so a `bun add` cannot silently float a minor. Both `package-lock.json` files are gone.                                                                                                                                                                                                                                                                                                                                                   |
| **TypeScript 6.0.3**, not 7                                                      | TypeScript 7's native compiler does not expose the programmatic API yet. `astro check` refuses to start against it outright, and `next build` cannot detect it as installed — it reinstalls `typescript` through yarn on every run and then the type-check worker dies with `The "id" argument must be of type string`. Dependabot holds `typescript` below 7 until both support it (withastro/roadmap#1321). Note that 7.0.2's `tsc --noEmit` _does_ run clean here, so the pin is about the two tools, not the code. |
| **`bun test`**, not vitest                                                       | Same runner as the sibling repo. `vitest.config.ts` is gone; its `globalSetup` became `tests/setup.ts`, loaded through `[test] preload` in `bunfig.toml`.                                                                                                                                                                                                                                                                                                                                                              |
| oxlint + prettier + knip + secretlint, `.githooks/`                              | The sibling repo's gate, ported whole. `prettier-plugin-tailwindcss` is the one piece left out — there is no Tailwind here.                                                                                                                                                                                                                                                                                                                                                                                            |
| Two workflows: `ci.yml` verifies, `deploy.yml` publishes on `release: published` | Production is gated on cutting a release rather than on a green `main`. **Consequence:** saving a post in the CMS commits to `main` and runs CI, but does not publish — a release (or a manual dispatch) does.                                                                                                                                                                                                                                                                                                         |
| CMS peers declared explicitly                                                    | Bun does not auto-install peer dependencies the way npm silently did. `next-themes` and `tw-animate-css` are outstatic peers and now sit in `cms/package.json`; without them the build fails with `Module not found: Can't resolve 'next-themes'`.                                                                                                                                                                                                                                                                     |

Three things the ported tools surfaced, all fixed rather than suppressed:

- `src/scripts/nav.ts` passed `panel.hidden` where a `boolean` was expected. The
  DOM lib types it `boolean | 'until-found'`, and 'until-found' still means
  hidden, so it is coerced instead of passed through.
- `src/data/home.ts` exported `demoStatus`, a verbatim duplicate of a literal
  hardcoded inside `src/scripts/sql-typing.ts`. The script now imports it, so the
  two cannot drift.
- `src/lib/site.ts` exported `locales`, `isLocale` and `Locale` with no consumer
  anywhere. Removed; restore them from git when locale routing actually lands.

`src/styles/ds/` and `outstatic/content/` are in `.prettierignore`: the first is
asserted byte-identical to `design-system/`, the second is written by the CMS.

knip needs one `ignore` that is a **false positive, not dead code**:
`src/scripts/reveal.ts` and `src/scripts/theme.ts` are imported by the bundled
`<script>` at the bottom of `src/layouts/BaseLayout.astro`, but knip's Astro
parser stops at that file's `<script type="application/ld+json" is:inline
set:html={...} />` tag and never reads past it. Verified by deleting that one tag
locally — knip then resolves both files.

## Fonts

The handoff overrides the design system's Geist with Plus Jakarta Sans +
JetBrains Mono "via Google Fonts", and adds "self-host with `@fontsource` if CLS
matters". It matters — this is a Lighthouse-gated production site — so both faces
are **self-hosted** from `@fontsource-variable`, and the two latin subsets are
preloaded.

Consequence: `design-system/tokens/fonts.css` is the one token file
`src/styles/global.css` does **not** import. It `@import`s Geist from Google
Fonts, which would cost a render-blocking third-party request for a family the
site never paints. The six `--font-*` variables it owns are redefined in
`global.css` instead. `tests/ds-integrity.test.ts` asserts that every _other_
token file is imported and that all six variables are redefined, so the omission
can't silently grow.

## Vendored design system

`src/styles/ds/` is a byte-for-byte copy of `design-system/` (minus the React
component references). It is vendored rather than imported across the folder
boundary because `tokens/theme.css` uses `url("../assets/lb-logo-h-dark.svg")`,
and Vite only rewrites and hashes those when the stylesheet is reachable from
`src/`. `tests/ds-integrity.test.ts` hashes both trees and fails on any drift.

The design system files themselves are **never edited**. Everything below that
changes a token value does it in a separate layer (`src/styles/a11y.css`).

## The hero product tour: a deliberate departure

`design/Home.dc.html` gives the hero iframe `max-width:1160px` and
`height:clamp(420px,62vh,660px)`, and the first build ported that faithfully.
Measured in a real browser, it does not work.

The tour is not an image. It is a page authored at **1920x1080** that scales
itself with `Math.min(innerWidth / 1920, innerHeight / 1080)`. A fixed height
therefore decides the scale, and every pixel of width beyond `height x 16/9` is
spent on black bars instead of on the product:

| Viewport  | As designed                                                                          | Now                              |
| --------- | ------------------------------------------------------------------------------------ | -------------------------------- |
| 1440x900  | 1062x558 box, tour at **51.7%**, 70px of black                                       | 1327x746 box, **69.1%**, no bars |
| 1920x1080 | same 1062px column                                                                   | 1342x755 box, **69.9%**, no bars |
| 390x844   | 333x523 box, tour at **17.3%** — a 333x187 strip with 168px of black above and below | 268x603 box, **63.5%**, no bars  |

Three changes, all departures from the handoff:

1. **`aspect-ratio: 16 / 9` replaces the height clamp.** The ratio is what makes
   the tour fill the frame; a fixed height cannot, at any width.
2. **The demo moved out of `.hero__inner`.** The hero column is 1160px wide with
   48px of padding, so the frame could never exceed 1064px no matter what
   `max-width` it carried — the 1160px on `.hero__demo` never even applied. It is
   now a sibling with its own 1440px container. It is not sized in `100vw`: that
   unit includes the scrollbar and would overflow the page by its width.
3. **A second bundle for phones.** `public/demo/libredb-studio-demo-mobile.html`
   is authored at 422x950 and scales by `min(w / 422, h / 950)`. Below 1023px —
   the site's own "not desktop" line, where `SiteHeader` also switches to the
   hamburger — that is the bundle the hero loads.

The two bundles are 439KB and 276KB, so only one is ever fetched: the iframe
ships with **no `src`**, and `src/scripts/hero-demo.ts` sets it from
`matchMedia`. A `<noscript>` copy carries the desktop tour for a reader without
JS. On mobile the frame's width is derived from a capped height
(`min(72vh, 640px)`) rather than the reverse, so the browser chrome hugs the
portrait demo instead of framing a narrow strip inside a wide bar.

`tests/dist-smoke.test.ts` locks all of it: both bundles present in `dist/`, no
server-rendered `src`, both `data-demo-*` paths on the iframe, and the noscript
fallback.

### Cropping to the card

Fitting the box was not enough — the tour was still small, and measuring inside
it showed why. Its 1920x1080 stage reserves 104px at the top for its own tab
strip and then fits 1080px of content into the 976px left over. That is where
its inner `scale(0.9037)` comes from: 976/1080. The card ends up 1735x976 at
(92.5, 104), and 1735 is exactly 1920 x 0.9037 — so 9.6% of the frame was chrome,
drawn inside the browser frame this site already draws.

The card's ratio is 1735:976, which is 16:9 to the pixel, so the frame now crops
to it: the iframe is sized `1920/1735` larger than the visible box and offset by
the card's origin, with the box clipping the rest. The four constants live as
custom properties in `Hero.astro` and `tests/dist-smoke.test.ts` asserts them, so
a re-export that moves the card fails the build rather than silently misaligning.

It is CSS width, not a transform. A transform would rasterise the iframe and
stretch it; giving it real CSS pixels makes the tour read a larger `innerWidth`
and repaint at that size, which is the whole point.

|               | Fitted | Cropped                              |
| ------------- | ------ | ------------------------------------ |
| 1920 viewport | 63.2%  | **69.9%**                            |
| 1440 viewport | 62.4%  | **69.1%**                            |
| 390 viewport  | 63.5%  | **84.7%** (phone bundle, full width) |
| 768 viewport  | 61.8%  | **100%** (phone bundle at life size) |

The phone bundle is not cropped: its inset is a drawn bezel around a 390x844
screen, which is the point of it. It caps its own scale at 1, so the frame caps
at the bundle's 422px box — past that every extra pixel was empty gutter, and the
422:950 ratio was turning a tablet's width into a 2226px-tall hero.

### Expanding it

Even cropped, a 1920-wide IDE in a 1340px hero is 69%. Fullscreen is the only
thing that buys more, and it buys less than it sounds: the scale is still
`width / 1920`, so it is 75% on a 1440px laptop and reaches life size only at 1920. It is a `<button>`, not a click handler on the frame, so it is reachable by
keyboard and announced; Escape closes it.

The fullscreen element itself cannot be sized — Chrome's UA rule forces
`inset: 0; margin: 0; width/height: 100% !important` on it, which put the black
bar straight back under the card. So `.hero__stage` is only the centring
container that goes fullscreen and `.hero__crop`, an ordinary child, carries the
ratio.

### The duplicated cursors

The desktop bundle leaks cursor arrows. Measured on the shipped file: one for the
first ~22 seconds, a second at ~26s, a third at ~30s, a fourth at ~34s, each
frozen where it was orphaned while only the newest keeps moving. Its template
declares exactly one, so this is its runtime failing to unmount the old node when
a chapter transition rebuilds the subtree around it.

`src/scripts/hero-demo.ts` sweeps them: an arrow that is still live receives
`style` mutations, an orphan never does again, so the observer stamps arrows as
they move and drops the stale ones. Two things about it are load-bearing and were
found by measurement, not by reading:

- It observes the **Document**, not `doc.body`. The bundle's loader rewrites the
  document after the iframe's first load event, and an observer bound to the body
  it had then sees zero matching mutations — which is exactly what the first
  attempt did.
- Before any arrow has been seen moving it falls back to document order, because
  the runtime appends the replacement and orphans the one already there.

This lives in our script rather than in the bundle on purpose. The bundle is
generated by Claude Design; a patch to it would be erased by the next export,
and this is not.

Unrelated and pre-existing: at 360px the page still scrolls 4px sideways, caused
by `.scene__box--studio` in the flow band. Measured identically before and after
this change.

## Accessibility: contrast lifts

`PITFALLS C3` — where design fidelity and WCAG 1.4.3 collide, accessibility wins
and the deviation gets reported. These are the reports. Every number came from
`scripts/contrast.mjs`; `tests/contrast.test.ts` keeps them true.

| Token                       | Was                      | Now                | Why                                                                                                                                                      |
| --------------------------- | ------------------------ | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--text-tertiary` (dark)    | `#767e9e`                | `#7f87a7`          | 4.40 on `--surface`, 4.01 on `--surface-elevated` — both below 4.5. Now 4.52–5.46 everywhere it lands.                                                   |
| `--text-tertiary` (light)   | `#7b8199`                | `#6c728a`          | 3.86 on white, 3.67 on `--background-subtle`. Now 4.52–4.76.                                                                                             |
| `--console-text-tertiary`   | `#5b6382`                | `#7a82a1`          | 2.90–3.25 across the console surfaces. It carries the `$` prompt, `#` comments and row counts — real information — so it has to clear AA. Now 4.52–5.06. |
| Footer legal + version chip | `--text-tertiary`        | `--text-secondary` | Small type on the darkest ground; the extra step costs nothing visually.                                                                                 |
| CTA repo link               | `rgb(255 255 255 / .75)` | `/ .82`            | 4.39 over the panel's purple end. Now 4.97.                                                                                                              |

**Gradient headlines.** axe-core skips any element painted with
`background-clip: text; color: transparent`, so Lighthouse would never have
flagged an unreadable headline — these were measured by hand. All clipped text
on the site is ≥26px, so the bar is the large-text 3:1.

| Where                                            | Failing stop      | Fix                                                                   |
| ------------------------------------------------ | ----------------- | --------------------------------------------------------------------- |
| `--gradient-brand` on dark `--background-subtle` | `#4f46e5` at 2.94 | dark theme clips with `--primary-500 → --secondary-500` (4.13 / 4.67) |
| `--gradient-data` on light backgrounds           | `#10b981` at 2.41 | light theme clips with `--accent-600 → --data-600` (3.58 / 4.91)      |
| `--gradient-data` on the CTA panel               | 2.62 / 1.81       | the panel clips with `--accent-300 → --data-300` (3.46–5.26)          |

Only _clipped text_ uses these; the decorative gradients — the CTA panel fill,
the section rules, the hexagon rings, the stat numbers' source gradient — keep
their design values untouched. A solid-colour fallback ships under
`@supports not (background-clip: text)`.

### The one audit that still fails

`/` scores **97**; every other route scores **100**. The single finding is
`color-contrast` inside `.how__scene`, the sticky diagram in "How it works".
Its layers sit at `opacity: .14` until the reader reaches the matching step, and
axe folds opacity into the effective foreground.

No opacity below ~0.8 passes — measured:

```
                0.14   0.25   0.35   0.45   0.55   0.65   0.75
text-primary    1.47   2.12   2.95   4.01   5.35   6.92   8.79
text-secondary  1.28   1.63   2.04   2.55   3.22   3.95   4.80
```

At 0.8 the "not yet reached" state no longer reads as ghosted, which is the
entire point of the device. WCAG 1.4.3 exempts both cases this falls under —
inactive user interface components, and text that is incidental to a picture —
so the design stands and the finding is recorded here rather than worked around.
It was **not** hidden from the checker (`filter: opacity()` would have done
that); 97 clears the required ≥95 with the failure visible.

## Accessibility: other changes

- **A mobile menu was added.** The prototype's header wraps its six nav items
  plus the CTA with `flex-wrap`, which at 390px produces a four-row header. Below
  1024px the nav collapses into a disclosure panel. Per `PITFALLS C1` the panel
  is a **sibling** of `<header>`, not a child, so no future `backdrop-filter` can
  trap its `position: fixed`.
- **Auto-cycling respects WCAG 2.2.2.** The why-diagram (2.6s) and the flow
  toggle (3.6s) auto-advance forever. They now pause while the pointer is over
  the component or focus is inside it, pause when scrolled out of view, and never
  start at all under `prefers-reduced-motion`. The designed 9s pin-on-click is
  unchanged. No new visible control was added.
- **Touch targets.** Footer links, the header GitHub link and the CTA repo link
  were ~12–20px tall; each now has `min-height: 24px` (WCAG 2.5.8). Inline links
  inside a sentence are exempt and were left alone.
- **The network diagrams are `aria-hidden`.** Both illustrations restate what the
  adjacent rows, status line and caption already say in words. (This does not
  silence axe's contrast rule, which reads visibility, not the a11y tree — it is
  about not narrating the same fact twice.)
- **Site chrome is marked `lang="en"`.** The header, footer and skip link are
  always English. Without this, the Turkish article page (`<html lang="tr">`)
  applies Turkish casing and `text-transform: uppercase` renders "Light" as
  "LİGHT".

## Design-system components: none were ported

`CLAUDE_PROMPT.md` §1 asks to port `components/**/*.prompt.md` into
`src/components/`, and milestone 3 adds "delete unused ports". The needed set
turned out to be **empty**, so `src/components/ui/` does not exist.

`design/Home.dc.html` does not use the design system's component library. It
styles every surface directly from tokens — its buttons are `<a>` elements with
`--action-primary` and `--radius-m`, its chips are spans with `--radius-pill`,
its cards are divs with a `--border` hairline. Shipping `Button.astro` next to
markup that never calls it would be an unused port, which is exactly what the
milestone says to delete.

What the specs _do_ govern is the rules, and those are followed. The blog
components are the only cards on the site that are not in the prototype, and
they are built to `core/Card.prompt.md` and `core/Tag.prompt.md`:

| Rule                                                                                | Where                                                                 |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `--surface` fill, 1px `--border`, `--radius-l`, `--card-padding`, no shadow at rest | `PostCard.astro`                                                      |
| exactly one hover movement — the lift, not lift _and_ zoom _and_ arrow              | `PostCard.astro` (`--hover-lift` + `--shadow-l`, nothing else)        |
| a clickable card is **one** link surface, never two                                 | the title's `::after` covers the card; there is no second link inside |
| tags are read-only metadata, not chips                                              | `.pcard__tag` is a `<span>`, never a button                           |
| buttons: hover darkens one step, press adds `scale(0.98)`, no hover shadow          | every CTA on the site                                                 |
| focus is `--focus-ring` at 2px with 2px offset via `:focus-visible`                 | inherited from `tokens/base.css`, never removed                       |

If a form or a dialog is added later, that is the point at which `FormField`,
`Input` and `Dialog` become needed ports.

## The console palette

The prototype paints its terminal chrome, code boxes and the mock IDE with a
fixed dark palette that does **not** flip with `[data-theme]` — a terminal is a
terminal in both themes. The design system has no tokens for that surface, so
`src/styles/console.css` names them (`--console-bg`, `--console-surface`,
`--console-text`, …) with the values lifted verbatim from the prototype.

Values that _do_ have a token are aliased rather than restated: `#a5b4fc` →
`--primary-300`, `#6ee7b7` → `--accent-300`, `#93c5fd` → `--data-300`,
`#10b981` → `--accent-500`, `#3b82f6` → `--data-500`, `#0b0d18` →
`--neutral-1000`. Two values have no equivalent anywhere in the scale and are
kept as documented literals: `#f59e0b` (the amber slow-query bar) and `#8b5cf6`
(the middle stop of the hero frame's gradient ring).

Section washes use `color-mix(in srgb, var(--token) N%, transparent)` rather than
the prototype's raw `rgba()`, which is the same composite through the token.

## Engine marks

All sixteen logos are **self-hosted** in `public/engines/` (the prototype
hot-linked jsDelivr and `cdn.simpleicons.org`). `scripts/fetch-engine-logos.sh`
re-downloads them with devicon pinned to `v2.17.0`; `@latest` is a moving target
that can restructure a path and break a production build.

Two ids deliberately differ from their upstream slug — `libsql` is served as
`turso`, `druid` as `apachedruid`. Renaming them to match breaks the fetch.

**Open question for design.** Four marks are near-invisible on the white hexagon
plate the design specifies:

```
1.19:1  duckdb      #FFF000
1.34:1  libsql      #4FF8D2
1.39:1  druid       #29F1FB
1.51:1  clickhouse  #FFCC01
```

They are shipped **in brand colour anyway**. These are third-party trademarks and
vendor brand guidelines forbid recolouring; the engine name is rendered as text
directly beneath each mark, so the logo is decorative (`alt=""`) and carries no
WCAG requirement. Recolouring them was tried and reverted. If this matters
visually the fix belongs in the design — a darker plate for those four, or
licensed alternate marks. `node scripts/logo-contrast-report.mjs` prints the
current numbers.

## Copy and content

- **Copy is verbatim**, including straight apostrophes as written in the
  prototype. `src/data/home.ts` is the single source; nothing is retyped into a
  template.
- **Deploy tab labels follow the prototype**, not `README.md` §4. The README
  lists "Docker / Compose / Helm / Binary"; the markup ships "Docker / npx / Helm
  / Embed / One-click". The markup is the higher-fidelity source.
- **Copy buttons were added to the deploy code blocks.** The prototype has none;
  README §4 asks for them.
- **`/features`, `/databases`, `/deploy`, `/open-source`, `/playground`** are thin
  pages that carry the section's own copy, link to the matching homepage anchor,
  and then render the real section component. That is the prompt's "can anchor to
  homepage sections for now", made non-404.
- **`/get-started` and `/faq` are real pages.** The footer links to
  `libredb.org/get-started` and `libredb.org/faq`, so leaving them 404 was not an
  option. Both are assembled **only** from claims already made elsewhere on the
  site — the four deploy steps, the install commands, the engine list, the
  licence position. Nothing about the product is invented. Every internal link is
  checked by `tests/dist-smoke.test.ts`.
- **Two seed posts**, one English and one Turkish, in Outstatic's exact
  frontmatter format. The Turkish one uses Turkish date and number conventions
  per the design system.

## Traps that were hit during the build

Each of these was a live failure here, not a hypothetical. Each has a test.

1. **`compressHTML` defaults to `'jsx'` in Astro 7**, which strips
   newline-containing whitespace between inline elements. The hero headline
   shipped as `Youcreatedthedatabase.` Fixed with `compressHTML: true` plus
   explicit space text nodes between the animated words.
   → `tests/dist-smoke.test.ts` asserts the rendered headline string.
2. **A light-theme token overrode the dark one.** `:root` and
   `[data-theme='dark']` have identical specificity (0,1,0), so source order
   decides. Declaring the dark block first painted dark mode with the light
   value and dropped the footer headings to 4.06:1 — caught by Lighthouse, not by
   the eye. → `tests/contrast.test.ts` asserts the declaration order.
3. **A function `assetsInlineLimit` inlined the entire stylesheet.** Returning
   `true` for non-font files told Vite to inline _everything_; the fix is `false`
   for fonts and `undefined` (fall back to the size heuristic) for the rest.
   Before the fix the fonts were base64'd into the render-blocking CSS, tripling
   it.
4. **`sirv` caches its file manifest at boot.** A component's stylesheet 404'd
   after a rebuild and the page looked like it had lost its CSS — measurement
   error, not a code error (`PITFALLS E2`). The a11y gate now serves from disk on
   every request and probes the origin before auditing.
5. **A fixed preview port is a false pass.** Port 4321 was already taken on this
   machine. `scripts/lighthouse-gate.mjs` binds `:0`, reads the port the OS gave
   it, and refuses to audit an origin that doesn't serve this project's build.
6. **`getStaticPaths` runs as a separate module** (`PITFALLS B5`), so
   `src/pages/blog/[...id].astro` imports everything it needs _inside_ the
   function. Content-layer ids can contain `/`, which is why the route is a rest
   param.
7. **Outstatic writes three kinds of empty** — absent key, `''`, and `null` — and
   `.optional()` accepts only `undefined` (`PITFALLS A2`). The schema uses
   tolerant combinators; `tests/content.test.ts` feeds it all three.

## Known limits

- `app.libredb.org` and the two Netlify demo iframes are third-party embeds; if
  they go down the frames go blank. The design specifies them.
- The product tour, mobile and SQL-editor panels are the design's own mock
  content, not live product data.
- `/playground` currently points at the hosted demo. If a dedicated playground
  ships it should replace that page.
