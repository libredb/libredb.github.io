---
title: VictoriaMetrics through the Prometheus provider
status: published
author:
  name: LibreDB
  picture: ''
slug: victoriametrics-through-the-prometheus-provider
description: 'LibreDB Studio reads VictoriaMetrics over the Prometheus HTTP API it already speaks. Measured against a live server: what answers, what fails and why, and the one parameter that took the Tables tab from ten metrics to fifty.'
coverImage: ''
tags:
  - value: engineering
    label: Engineering
  - value: databases
    label: Databases
publishedAt: 2026-09-27T09:00:00.000Z
---

VictoriaMetrics answers the Prometheus querying API, so LibreDB Studio does not
need a driver of its own for it. A connection of type Prometheus pointed at port
`8428` is a VictoriaMetrics connection, and once that type is chosen the
connection dialog says so: the Prometheus driver also serves VictoriaMetrics,
and the pairing is verified.

"Answers the same API" is a claim about paths, though, not about behaviour. We
probed a single-node VictoriaMetrics scraping the same targets as a Prometheus
server in the same pass, surface by surface, and counted a surface as working
only where it passed and held data wherever Prometheus did. By that rule 20 of the 36 surfaces outside the editor answer.
That is why the compatibility table lists VictoriaMetrics as a partial relative
rather than a full one. Here is what the other sixteen are, and why.

## The editor runs PromQL, and MetricsQL passes through

Instant vectors, range selectors, subqueries and scalars all answer, the three
refusals end the way they do on Prometheus, and Cancel stops a running query.
The provider sends the expression to `/api/v1/query` exactly as typed, so
nothing stands between MetricsQL and the server. We ran six MetricsQL
expressions through the provider and every one answered:

```
WITH (r = rate(prometheus_http_requests_total[5m])) sum(r) by (handler)
rate(prometheus_http_requests_total)
rollup_rate(prometheus_http_requests_total[5m])
rate(prometheus_http_requests_total[5m]) keep_metric_names
topk_avg(3, rate(prometheus_http_requests_total[5m]))
median_over_time(up[10m])
```

The results are what MetricsQL promises. `rate()` with no window picks one
itself. `rollup_rate` answers three rows per series, one each for `min`, `max`
and `avg`, told apart by a `rollup` label. `keep_metric_names` keeps
`__name__` in the result where a plain `rate()` drops it, and `topk_avg(3, ...)`
answers three series.

Two limits apply. The highlighter knows Prometheus's own grammar, so a
MetricsQL-only function such as `rollup_rate` or `median_over_time` is shown as
a plain identifier rather than as a function. And our compatibility claim is for
PromQL: the six expressions above are a check that MetricsQL reaches the
server, not a measurement of MetricsQL itself.

## Three paths VictoriaMetrics does not serve

The monitoring dashboard's Overview and Storage tabs fail, and so does the
Scrape pools folder. Each reads one of three paths that VictoriaMetrics answers
with HTTP 400 and the text `unsupported path requested`:
`/api/v1/status/runtimeinfo`, `/api/v1/status/flags` and
`/api/v1/scrape_pools`. That is not a bug on either side. VictoriaMetrics' own
documentation lists the handlers it serves for Prometheus clients, and those
three are not among them.

What we could decide was how the failure reads. The message names the path and
the status, and it offers the causes such an answer can have without choosing
one: a proxy or a login page in front of the server, or a server that does not
serve the path. The last is what answered here.

The Storage tab has a second reason to stay empty. It reads the head block
statistics from the TSDB status, and VictoriaMetrics' TSDB status carries its
own statistics (`totalSeries`, `totalLabelValuePairs` and the ranked lists) but
no `headStats`. The provider refuses a status without them as unmeasured rather
than draw an empty head.

## The Tables tab, and a parameter with two names

The Tables tab lists the metrics with the most series, read from
`/api/v1/status/tsdb`. On Prometheus the provider asks for the top fifty with
`limit=50`. On VictoriaMetrics the same request answered ten.

The reason is a parameter name. VictoriaMetrics cuts that answer at `topN`, and
without it returns its default top ten, whatever `limit` says: `limit=3` and
`limit=50` each answered ten, and `limit=50&topN=50` answered fifty. Prometheus,
for its part, ignores `topN`. We compared its four ranked lists with and without
the parameter and they were identical.

So the provider now sends the cut under both names. On VictoriaMetrics the
Tables tab lists fifty metrics, and 49 of the fifty series counts matched
Prometheus's for the same metric; the fiftieth,
`prometheus_engine_query_duration_seconds`, read 9 series there and 12 on
Prometheus. The change is merged and ships with the next release; until then the
tab still shows ten.

## Small differences in what the server sends

A metric's Source tab shows its type and help and no unit, because
VictoriaMetrics' `/api/v1/metadata` entries carry no `unit`. The provider leaves
the member out rather than invent an empty one.

A target's Source tab has no `scrapeInterval` or `scrapeTimeout`.
VictoriaMetrics keeps them as `__scrape_interval__` and `__scrape_timeout__`
among the discovered labels, and the tab shows those.

A target VictoriaMetrics has not scraped yet reads as down. It reports such a
target with health `down`, no error and a last scrape of
`1970-01-01T00:00:00Z`, where Prometheus reports health `unknown`.

## Empty rule folders are a configuration, not a failure

The Rule groups, Recording rules and Alerting rules folders are empty. A
single-node server evaluates no rules, so `/api/v1/rules` answers no group, and
VictoriaMetrics answers that path from vmalert only when it is started with
`-vmalert.proxyURL`. We did not probe a server started that way.

## Three answers that differ from Prometheus's

A string expression such as `"libredb"` returns no rows: VictoriaMetrics answers
it with an empty vector, where Prometheus answers a string.

A subquery's points are counted back from its evaluation time, with both ends of
the window kept. `avg_over_time(up[5m])[30m:1m]` answered 31 points ending at
that time, where Prometheus answers 30 on whole minutes.

PromQL infos and warnings do not appear beside a result. `rate(up[5m])` came
back with no notice, where Prometheus attaches "PromQL info: metric might not be
a counter", and no other answer we measured carried one either.

## Read-only on both

None of this changes what the connection can do to the server. The Prometheus
provider never calls the admin API (series deletion, snapshots, tombstones) or
the lifecycle endpoints, on Prometheus or on anything that answers like it. A
VictoriaMetrics connection is a query and a browse surface, and every
difference above is about what the server reports, never about what the
connection could change.

The full list, with every caveat and the captured answers behind it, is in the
[Prometheus provider documentation](https://github.com/libredb/libredb-studio/blob/main/docs/providers/prometheus.md#victoriametrics).
