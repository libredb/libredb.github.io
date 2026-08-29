---
title: 'TODO — see brief below'
status: draft
author:
  name: LibreDB
  picture: ''
slug: counting-databases
description: TODO — one sentence. This becomes the meta description AND the card summary, so it has to work with no context around it.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-08-30T09:00:00.000Z
---

<!--
  ============================================================================
  BRIEF — delete this whole comment before publishing.

  Topic: "How many databases does LibreDB connect to?" has no single answer,
  and the interesting part is why. Three different true numbers exist:

    16  external engines with a first-class provider (SHIPPED minus `libredb`)
    26  wire-compatible relatives, each measured by a live probe
    42  connectable products = 16 + 26  (connectableProductCount())

  Source: libredb-studio/src/lib/db/compatibility.ts. Read the comment above
  WIRE_COMPATIBLE_ENGINES before writing — it contains the sentence this post
  is really about:

    "a count is wrong when its denominator is unstated,
     not when its digit is stale"

  Tiers: full / partial / query-only. Refused after probing: Cloud Spanner's
  PostgreSQL dialect (1 of 15 surfaces), QuestDB 10.0.1.

  Rules from docs/BRAND_MESSAGING.md that apply here:
   - No competitor by name, at all. This post does not need one.
   - Never claim leadership on a count. The count is context, not the claim.
   - Say the limitation out loud; that is what makes the rest credible.
   - No emoji, no exclamation marks, no unverifiable adjectives.
  ============================================================================
-->

TODO 1 — THE OPENING (4–6 lines)
Open on the question as a user actually asks it, not as we answer it. Someone
in an issue or a sales call says "how many databases does it support?" and
expects one number. Set up why the honest answer is a question back.

Your call to make: do you open with the awkwardness of not having one number,
or do you open with the number and then take it apart? The first is more
honest and slower; the second is more readable and risks looking like a
walk-back. Pick one and commit — do not do both.

## Three numbers, three denominators

TODO 2 — THE THREE SETS (8–12 lines)
Explain 16, 26 and 42 and what separates them. The distinction that matters:
a first-class provider has its own doc page and its own integration test; a
relative is served by an existing driver and is only listed after a live probe
measured it.

Your call: how much weight to give the tiers. `query-only` means the SQL editor
works and nothing else does — Materialize, RisingWave and Databend sit there.
Is a query-only engine "supported"? Answer it directly in the post rather than
leaving the reader to work it out, because that is the sentence a reader will
quote back at us.

## What a probe refuses

TODO 3 — THE REFUSALS (6–10 lines)
Cloud Spanner and QuestDB were probed and did not earn an entry. QuestDB is the
better story: it looks compatible from the provider's side and is not, because
the editor attaches a `queryId`, the provider then issues
`SELECT pg_backend_pid()`, and QuestDB has no such function — so a direct
provider call answers three rows while pressing Run answers a 500.

Your call: what this says about how a support claim should be made at all.
There is a real point available here about the difference between "the driver
connected" and "the product works", and it is the point that makes the whole
post worth publishing rather than being a list of names.

## Why the number is published this way

TODO 4 — THE CLOSE (3–5 lines)
Land it on the counting rule. There is no "pending" state in the registry on
purpose: a reader cannot tell a pending entry from a probed one.
