import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
// astro:content's `z` re-export is deprecated in Astro 7 and gone in 8.
// astro/zod is Zod v4.
import { z } from 'astro/zod';

/* -----------------------------------------------------------------------------
   Outstatic tolerance (PITFALLS A2).

   A Git-backed CMS writes three different kinds of "empty" and only one of them
   is `undefined`:
     - key ABSENT      — the editor never touched the field
     - EMPTY STRING    — typed into, then cleared
     - literal `null`  — hand-edited, or carried through by the YAML writer

   zod's `.optional()` accepts only `undefined`, so a bare `.optional()` here
   turns "editor cleared a field" into a red build that the editor never sees —
   they just watch the site stop updating. Every optional field goes through
   these combinators instead, and tests/content.test.ts feeds them the real
   payloads Outstatic emits.
   -------------------------------------------------------------------------- */
const text = (fallback = '') => z.preprocess((v) => (v === null || v === undefined ? fallback : v), z.string());

const list = <T extends z.ZodType>(item: T) =>
  z.preprocess((v) => (v === null || v === undefined || v === '' ? [] : v), z.array(item));

const tag = z.object({ value: z.string(), label: z.string() });

const posts = defineCollection({
  // The glob pattern may not start with '../' or '/', so content living outside
  // src/ is addressed through `base`, which resolves from the project root.
  // Pointing at the collection folder (not outstatic/content) keeps Outstatic's
  // sidecar JSON and _singletons/ out of the collection.
  loader: glob({ base: './outstatic/content/posts', pattern: '**/*.md' }),
  schema: z.looseObject({
    title: text(),
    status: z.enum(['published', 'draft']),
    slug: text(),
    // Outstatic writes publishedAt as an UNQUOTED ISO-8601 timestamp, so the
    // YAML parser hands us a Date, not a string.
    publishedAt: z.coerce.date(),
    author: z
      .preprocess(
        (v) => (v === null || v === undefined || v === '' ? {} : v),
        z.looseObject({ name: text(), picture: text() }),
      )
      .default({ name: '', picture: '' }),
    description: text(),
    coverImage: text(),
    tags: list(tag).default([]),
    lang: z.preprocess((v) => (v === null || v === undefined || v === '' ? 'en' : v), z.enum(['en', 'tr'])),
  }),
});

export const collections = { posts };
