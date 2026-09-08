---
title: 'Twenty-eight models, six surfaces, eight hundred and forty runs'
status: published
author:
  name: LibreDB
  picture: ''
slug: twenty-eight-models-six-surfaces-840-runs
description: What it took to make a local model drive a database agent, and why the model was almost never the problem. Nearly every time a model failed, the ledger showed our own server holding the sentence that would have unblocked it.
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-09-08T20:30:00.000Z
---

LibreDB Studio's Agent mode does something ordinary to describe and hard to do: it reads a database and reports what it found, citing the readings it took.
It can do that with a hosted model.
The question we set out to answer was whether it could do it with a model running on a laptop, from Ollama, with no API key and no data leaving the machine.

The answer is yes, for twenty-eight models today.
Getting there took eight hundred and forty runs and, more to the point, it took admitting something uncomfortable: nearly every time a model failed, the ledger showed our own server holding the sentence that would have unblocked it.

This is that story, told from the measurements.

## The protocol, and why it is this strict

A model is not "supported" because it worked once.
Agent mode has six surfaces, investigate, optimize, assess, operate, analyze and plan, and each one asks for something different.
A model that lists tables beautifully may be unable to compare two query plans; one that compares plans may never file a report.

So a **cell** is one model on one surface, and a cell is only closed when the model passes **five consecutive runs** on it.
Six cells, thirty runs, and nothing below 30/30 ships.
Twenty-eight models at 30/30 is **840 runs, and all 840 passed.**

Three rules keep that number honest:

**A lock is never taken back.**
Once a cell reads 5/5 it is never re-measured or re-tuned.
If a later change would alter what that cell was measured under, the cell is read again from scratch rather than inherited.

**Every measured model carries an entry recording the settings its numbers were obtained under**, even when those settings are the defaults.
A shared value is what has twice cost this project a cell it had already won: a sampling temperature pinned globally won five cells and lost one; a reordering of the workflow rules won nothing and lost one.
The entry means a later change to the defaults cannot silently invalidate a measurement.

**Four out of five is variance, not a signature.**
A cell at 4/5 is re-rolled at the same settings, up to three times, before anything is changed.
Reaching for a knob at 4/5 is how you convince yourself a setting worked when the dice simply landed differently.

## The bug we found eight times

Early on the losses looked like model failures.
A run would end having produced nothing, the verdict would read `no-report`, and the obvious conclusion was that the model was not good enough.

Then we read the wire recording of a `qwen3:8b` run.

The model called `compose_report`.
The server refused it with:

> The arguments did not match the shape this tool declares.

The model called it again, unchanged.
Same sentence.
It did that for **thirty-seven turns** until the run ran out of budget and ended having reported nothing.

The sentence is true.
It is also unusable: it names no field, so there is nothing in it to act on.
The validation layer knew exactly which path had failed and what was expected there, and was throwing that away before speaking.

Naming the field fixed that run.
What it did not fix was the shape of the mistake, which we then found again, and again:

**A tool refused a recommendation thirty-two times in one run** over one field whose permitted values were `index` and `rewrite`.
The refusal said "invalid value", never the two words that would have worked.
The permitted set was in the schema, in hand, at the moment of refusal.

**A run that stopped without reading anything** was ended in silence.
The server held a sentence written for exactly that ending, *"Read it yourself. Call inspect_schema for the tables and their columns, and inspect_plan for how a statement will run"*, and sent it only to models whose profile asked for it.
One profile of twenty-eight did.
A model nobody has measured has no profile at all, so the model most in need of the sentence was the one guaranteed not to receive it.
Across one sweep: 300 runs ended `model-stopped` with `no-report`, **half of them had called no tool at all, and 94 of those were ended without the drive saying anything.**

**A reasoning model wrote its thinking into the tool-call argument field**, with valid JSON after it.
The endpoint could not parse the whole string, reported exactly that, and handed back the model's own text.
Studio threw that away and killed the run, seventeen seconds into a 630-second budget, with four tools already called.
The retry it did have was written for a broken connection: it re-sent byte-identical bytes, which asks the model to make the same mistake again, and it does.

**The largest one was the quietest.**
Across twelve hours of sweeps, `compose_report` was declined 1,530 times, and one issue was **1,110 of them**:

> the fields that did not match, claims: expected array

True, and still not enough.
A model that serialized `claims` as a JSON *string* reads that and agrees with it: what it sent is an array, as far as it can tell.
Nothing in the sentence contradicts it, so it sends the same bytes again.
We were stating one side of a comparison and calling it a message.

The fix was to name what arrived as well as what was expected:

> claims: expected array, received string

After that change, that error stopped appearing entirely; the failures moved one level deeper into the schema, where the message was already specific enough to act on.

## What the fixes were worth

The clearest single measurement: `gpt-oss:20b` on the assessment surface.
Four separate sweeps and two different per-model settings had it at 1/5, 1/5, 2/5, 2/5.
The cell would not open.
The cause was not the model, it was the parse failure above, killing runs that had already read what they needed.

With the fix, and **with no per-model setting at all**, the same cell read **5/5 on its first reading.**

Then there is `deepseek-r1:8b`, which our own notes had written off in plain language: *a thinking model spends the turn thinking and never calls a tool.*
Re-measured on the corrected build, it locked **five of six surfaces, four of them on the first attempt.**

The same thing shows up in the roster we shipped.
`cogito:32b` spent weeks recorded as unsupported over one cell it could not close, and the cell turned out to be the server's.

That is the finding underneath all of this.
We had been grading models against a harness that was withholding half of what it knew.

## What a model still has to bring

None of this means every model can do the job, and the measurements are just as clear about that.

Some cannot participate at all.
Ollama reports no tool capability for `gemma3`, and a planning run drives to `succeeded` having called nothing: the model a reader would most expect on this list is one that cannot drive an agent surface.

Some produce the intent without the protocol.
`mistral:7b` receives the instruction, understands it, restates it, *"I will first use the `inspect_schema` function... then `inspect_plan`... finally `compose_report`"*, and then writes the call as prose inside a code fence instead of making it.
Across twenty-five agent runs it called **zero** tools.
That is a wall no sentence reaches.

And some are held by the clock rather than by ability.
One model's optimization runs began calling tools the moment its per-turn ceiling was raised, going from zero tool calls to three, four, five, and then spent the entire run budget without finishing.
That is an honest "not supported at this standard", not a knob to keep turning.

## The hardware, stated plainly

Memory is the binding constraint on a laptop, and it is not the number on the download page.
**RAM costs roughly twice the size on disk** with a default context window.

We learned that the expensive way.
A 42 GB model loaded into 86 GB on a 64 GB machine: free memory reached 5%, 782,000 pages went to swap, and the machine was seconds from locking up while its owner was using it.
The proven ceiling on that hardware is a 27 GB model.
Capping the context (`OLLAMA_CONTEXT_LENGTH=32768`) is what keeps the larger ones inside it.

For calibration, from the passing runs:

| Position | Model | Median run |
| --- | --- | --- |
| Fastest measured | `qwen2.5:7b` | **6s** |
| Fastest hosted | `gemini-3.5-flash-lite` | 10s |
| Slowest | `muse-glimmer:latest` | 115s |

A nineteen-fold spread across models that all score identically.
Every one of them is 30/30; what separates them is how long you wait.

## Twenty-eight, from eight vendors

The roster spans Google, IBM, NVIDIA, Alibaba, Mistral AI, Deep Cogito and others, from 2.5 GB to 27 GB on disk.
The smallest model on the list, `qwen3:4b` at 2.5 GB, holds all six surfaces.
So does a 27 GB one.
Size predicts speed here far better than it predicts capability.

What the roster does not span is our opinion.
A model is on it because thirty runs passed, and off it because they did not.

## The part worth taking away

We began by asking which models were good enough.
We ended up rewriting our own server five times, and the pattern was the same on every one of them: **the answer was in the server's hand and it refused without saying it.**

A refusal that names no remedy is not a safety feature.
It is a wall the model cannot climb, and the run it ends was going to fail anyway, so saying the missing half costs nothing and is sometimes the entire difference between 1/5 and 5/5.

If you are building something a model drives, that is the question worth asking of every error path you own: *does this sentence tell the model what to do differently?*
If it does not, you are not measuring the model.
You are measuring your own silence.

Every figure here comes from the run ledger.
The per-model settings, the protocol, and what each model was measured under are in the repository under `docs/llms/`.
