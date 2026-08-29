# LibreDB Studio — Design System

LibreDB Studio is a data-infrastructure practice: database architecture, zero-downtime migration, managed database operations and observability for enterprise customers. The brand speaks to CTOs, data platform leads and engineering managers — people who buy on evidence, not adjectives.

This system covers five surfaces:

- **Marketing website** — corporate/service pages, case studies, campaign landing pages
- **Product UI** — managed-database console (clusters, metrics, incidents)
- **Dashboard / data product** — tables, filters, status, empty and error states
- **Blog / content** — long-form engineering writing
- **Landing pages** — single-goal conversion pages

Documentation prose is Turkish (the team's working language); every token, component and prop name is English.

## Sources

- Brand marks supplied by the user as SVG: vertical / horizontal / icon lockups in colour, white and second-white variants (`uploads/*.svg`).
  **Note:** the uploaded SVGs arrived with their CSS fill declarations stripped, so every shape rendered black. The marks in `assets/` are rebuilt from the same path data with explicit fills — the geometry is untouched.
- A written UX/UI master component checklist supplied by the user (100 sections), which defined the scope of this system.
- No codebase, Figma file or existing production site was provided. Everything below is derived from the marks, the checklist, and decisions confirmed with the user (Geist + Geist Mono, soft 8–12px corner language, equal light/dark support).

## The mark

The symbol is a hexagonal frame containing three horizontal data rows and a pair of chevrons — a database record between two brackets. Frame and rows carry the indigo→purple brand gradient; the chevrons carry the emerald→blue data gradient. The wordmark reads **LibreDB Studio**.

- Clear space: 50% of the symbol's height on every side.
- Minimum size: horizontal lockup 140px digital / 32mm print; symbol alone 24px.
- Never stretch, rotate, recolour, add shadow/outline, or place on a low-contrast ground.
- On brand gradient, photography or video: the single-colour white lockup only.

---

## CONTENT FUNDAMENTALS

**Voice: net, doğrudan, kanıtlı, abartısız.** Technical subject matter explained without jargon piling up; claims backed by a number, metric or case.

- **Person.** "Biz" for the company, "siz" for the reader — always formal-plural. Never "sen".
- **Tense.** Present, active, committed. "Düşürüyoruz" not "düşürebiliriz"; "olur" not "olabilir".
- **Casing.** Sentence case everywhere — headings, buttons, labels, table headers. ALL-CAPS only for the mono eyebrow/overline styles, and only with wide tracking.
- **Emoji.** Never. Not in UI, not in marketing, not in error messages.
- **Exclamation marks.** Never in UI copy.
- **Numbers.** Turkish convention — `₺48.000`, `4,2 TB`, `12.03.2026`. Metrics are specific: "40 dakikadan 3 dakikaya" beats "çok daha hızlı".
- **Length.** Headline ≤ 60 characters. Card description ≤ 140. Button label 1–3 words.

| Slot | Yes | No |
| --- | --- | --- |
| Button | `Teklif al` · `Projeyi incele` · `Görüşme ayarla` | `Gönder` · `Tıkla` · `Daha fazla bilgi` |
| Headline | `Veritabanınız büyürken yavaşlamak zorunda değil` | `Veri çözümlerinde lider iş ortağınız` |
| Form error | `Telefon numarası 10 haneli olmalı: 5XX XXX XX XX` | `Geçersiz giriş` |
| Empty state | `Henüz küme eklenmedi — ilk kümenizi bağladığınızda metrikler burada görünecek` | `Veri yok` |
| Success | `Talebiniz alındı. Referans numaranız #LB-4821.` | `Başarılı!` |
| Label | `Şirket adı` (always visible) | placeholder-as-label |

Error copy always has two parts: what happened + how to fix it. Empty states always have two parts: the state + the next action. Turkish text needs `lang="tr"` so ı/İ casing is correct.

---

## VISUAL FOUNDATIONS

**Overall feel.** Quiet, engineered, dense-but-breathable. Hairline borders instead of heavy shadows; a single saturated accent against a cool near-neutral canvas; monospace as a functional signal, not decoration. Closer to a developer console than to a marketing site — and the marketing site inherits that discipline.

**Colour.** One brand colour does the work: indigo `--primary-600` (#4f46e5). Purple only appears inside the brand gradient or in data visualisation. Emerald + blue are the "data" pair from the chevrons — used for the data gradient, charts and info/success states. Neutrals are cool-tinted so they sit under indigo without going muddy. **Maximum two background tones per page** (`--background` and `--background-subtle`), plus at most one accent surface. Status colours are never decorative.

**Gradients.** Two, both 135°: `--gradient-brand` (indigo→purple) and `--gradient-data` (emerald→blue). Permitted on: the mark, a single CTA surface per page, a stat number (background-clip: text), a thin section rule, a progress fill. **Never** a page background, never behind body text, never a hero wash.

**Typography.** Geist for everything readable, Geist Mono for tokens, metrics, code, IDs, dates and eyebrows. Display and heading sizes carry tight negative tracking (−2.2% to −3%); body is neutral. Weights used: 400 body, 500 UI/labels, 600 headings. Long-form body runs 16px/1.75 at a 680px measure; standard body 620px; short intro 520px.

**Backgrounds.** Flat colour. No photographic hero washes, no noise, no full-bleed texture. The only patterned surface is the brand's own graphic device — repeating horizontal rules echoing the data rows of the mark — used sparingly as a section separator or empty-state ground. Image placeholders are diagonal-striped grey blocks with a mono caption stating what belongs there.

**Imagery.** Cool-toned, low-contrast, real working environments — screens, racks, teams at desks. No stock "success handshake", no lens flare, no warm orange grade. Product shots are straight-on UI captures at 4:3 or 16:9 with generous margin. Illustration, where it appears, is 1.5px single-stroke line work in one colour plus one accent — never filled, never isometric.

**Corner radii.** 4 badge · 6 chip · 8 button/input · 12 card · 16 modal · 24 section media · 999 pill · 50% avatar. The system ships `sharp` (2–4px) and `round` (8–36px) alternates but soft is canonical.

**Cards.** `--surface` fill, 1px `--border` hairline, 12px radius, 24px padding (16px compact), no shadow at rest. Shadow appears only on hover or when the card floats. A card is never a rounded box with a coloured left border.

**Borders.** 1px is the default and does most of the visual structuring: `--border-subtle` inside a component, `--border` between components, `--border-strong` for an interactive outline. 2px is focus only. 3px is the active-tab / emphasis rail. Dashed 1.5px marks a dropzone. Nothing thicker.

**Shadow system.** Six steps, outer only, cool-black, never coloured: none / xs input hover / s card hover / m dropdown / l drawer+popover / xl modal. No inner shadows, no glows. In dark mode shadows get softer and blacker while the **surface lifts a tone** (`--surface` → `--surface-elevated`) — elevation is read from the surface, not the shadow.

**Transparency and blur.** Almost never. Permitted: modal backdrop `rgba(11,13,24,.55)`, an image protection gradient at the bottom of a media hero, a 92%-white circular play button over video. No frosted-glass panels, no translucent navigation.

**Protection.** Text over imagery sits on a bottom-up linear gradient (`rgba(11,13,24,.82)` → `.15`), not a capsule. Small labels over media use a solid `rgba(11,13,24,.7)` mono chip.

**Animation.** Fast and short. 80ms colour, 150ms hover/focus/tap, 240ms dropdown/accordion/card lift, 360ms modal/drawer/page, 400ms image zoom. Easing is `--ease-out` for nearly everything; `--ease-spring` only for a scale pop. Scroll reveal is 20px up + fade with 60ms stagger. Counters count up over 900ms. No bounce, no parallax on text, no scroll-jacking. `prefers-reduced-motion` zeroes every duration and distance — opacity only.

**Hover states.** One movement per element, never stacked. Buttons darken one step (600→700). Outline/ghost gain `--surface-hover`. Cards lift −4px and pick up `--shadow-l`. Media zooms 1.06–1.12. Arrow links translate 4px right. Underlines thicken from 1px to 2px. Nav items get a surface, not a colour change.

**Press states.** `scale(0.98)` plus one more colour step (700→800). No shadow change. On touch there is no hover — a pressed state is designed instead.

**Focus.** `--focus-ring` 2px with 2px offset, via `:focus-visible`. Inputs additionally get a 3px `--surface-brand` halo. Outline is never removed without a replacement.

**Layout rules.** 12/8/4 column grid; 1280px default container; 480/640/768/1024 content containers by text length. Section padding 48/64/80–96px by breakpoint, 120–160px for heroes. Page gutter 20/32/48/64px. Sibling groups are laid out with flex/grid + `gap` — never margins between items. Fixed elements: header (sticky, 72px → 60px on scroll, gains a hairline and `--shadow-s`), mobile sticky CTA, back-to-top, sticky table-of-contents on articles.

**Density.** Two modes. `comfortable` (24px card padding) is default; `compact` (16px) is for data-dense product screens.

**Dark mode.** Equal citizen, not an inversion. Canvas #0b0d18, surface #141829, elevated #1b2038. Brand indigo stays #4f46e5 for fills but hover goes *lighter* (600→500) instead of darker. Tinted surfaces move to #252163; hover tints must never be light-theme values — that is the one bug this system has already had.

---

## ICONOGRAPHY

- **Set:** [Lucide](https://lucide.dev) — 24px grid, **1.5px stroke**, round caps and joins, no fill. Load from CDN (`lucide` / `lucide-static`) or inline the SVG. **This is a substitution, flagged:** no icon set was supplied with the brand assets. Lucide was chosen because its stroke weight and geometric-but-humanist construction match the wordmark. Swap it if the brand has its own set.
- **Colour:** always `currentColor`. There are no fixed-colour icons and no multicolour icons.
- **Sizes:** 12 meta · 16 inline · 20 button · 24 default · 32 card · 40 feature · 48 empty state.
- **States:** default `--text-primary` · hover `--primary-600` · active `--primary-800` · disabled `--text-disabled` · inverse `--text-inverse`.
- **Icon-only controls** always carry `aria-label` and pad out to a 44px hit area.
- **Categories in use:** navigation, actions, status, communication, data (database/table/chart/server/terminal), file & media, user, location & time.
- **Emoji:** never used as an icon or anywhere else.
- **Unicode:** the arrow glyphs → ← ↑ ↓ ↗ and × are used as type, not icons, in links, dismiss controls and pagination. `< >` set in Geist Mono is the brand's chevron device.
- **Brand marks** live in `assets/` as SVG and are the only illustrative artwork shipped here.

---

## Index

| Path | What it is |
| --- | --- |
| `styles.css` | Global CSS entry point — `@import` list only. Link this one file. |
| `tokens/` | fonts · colors · theme · typography · spacing · shape · elevation · motion · layout · base |
| `assets/` | Brand marks: lb-icon, lb-icon-white, lb-icon-ink, lb-logo-h-{dark,light,white}, lb-logo-v-{dark,light,white} |
| `guidelines/` | Foundation specimen cards (Design System tab) |
| `components/core/` | Button, IconButton, Badge, Tag, Avatar, Card |
| `components/forms/` | FormField, Input, Textarea, Select, Checkbox, Radio, Switch |
| `components/navigation/` | Tabs, Breadcrumb, Pagination |
| `components/feedback/` | Alert, Toast, Dialog, Tooltip, Accordion, Spinner, Skeleton, EmptyState |
| `ui_kits/website/` | Marketing site recreation — home, service detail, blog detail |
| `ui_kits/console/` | Managed-database console — cluster list, cluster detail |
| `LibreDB Design System.dc.html` | The full browsable specification (32 sections, live light/dark) |
| `SKILL.md` | Agent Skill wrapper for use in Claude Code |

### Intentional additions

No source defined a component inventory, so the standard primitive set was authored and sized to the checklist the user supplied. Beyond that set, four additions:

- **FormField** — label + required marker + helper + error wrapper. The checklist makes visible labels and below-field errors mandatory; wrapping it stops that being re-invented per form.
- **Spinner / Skeleton** — the loading section of the checklist is explicit about both.
- **EmptyState** — the checklist's three-part empty-state rule (state, reason, next action) is easy to get wrong freehand.

## Caveats

- Geist and Geist Mono load from Google Fonts; no font binaries are bundled. Supply licensed `.woff2` files if you need self-hosting and swap `tokens/fonts.css`.
- Icon set is a flagged substitution (Lucide).
- All imagery is a striped placeholder. Real product shots, team photography and client logos are needed before the UI kits can be considered final.
