# Metric Design

Use when defining a KPI, instrumenting a feature, or judging whether a reported number means
what its label claims.

## A metric needs four parts

1. **Definition** — what is counted, in words precise enough that two people would compute the same number.
2. **Denominator** — of what population, over what period. Without it a count is not a rate.
3. **Source** — which event, table or system, and who writes it.
4. **Owner and threshold** — who watches it, and at what value they act.

"Engagement" is not a metric. "Weekly active users, defined as distinct accounts with at least
one session lasting >10s in the 7-day window ending Sunday UTC, from the sessions table" is.

## Choosing what to measure

- Tie the metric to the decision it informs. If no decision changes at any value, delete the metric.
- Prefer **outcome** metrics (task completed, revenue) over **output** metrics (features shipped, lines of code). Output metrics measure effort, not value.
- Every primary metric needs a **counter-metric** that would catch it being gamed: conversion rate paired with refund rate; speed paired with error rate; ticket volume paired with resolution time.

## Rates, not counts

Counts rise with growth and say nothing. Convert to rates with an explicit denominator, and
choose the denominator deliberately: "errors per 1,000 requests" and "errors per active user"
tell different stories and one of them is misleading for your question.

## Distribution, not just the average

- Report a percentile alongside the mean. Average latency hides the 5% of users who wait seconds.
- Averages of per-entity averages are wrong unless weighted by the entity's volume.
- For skewed data (revenue per user, latency, file size), the median is the honest centre.

## Watch for definition drift

The most common metric failure is silent change: instrumentation updated, a filter added, a
timezone fixed. After any such change, the series is not comparable across the boundary.

- Version the definition, and annotate the chart at the change point.
- When someone reports "the metric dropped 20%", the first question is "did we change the definition or the instrumentation?"

## Practical instrumentation checklist

- [ ] The event fires exactly once per intended action (deduplicate the retry).
- [ ] The event carries the ids needed to join it later (account, session, experiment).
- [ ] Timestamps are in UTC and the client clock is not trusted for the event time.
- [ ] Absence of data is distinguishable from zero (a broken pipeline looks like no usage).
- [ ] Backfill is possible if the event was wrong.

## Reporting

State the value, the period, the definition version, and the comparison baseline. "Conversion
is 3.2% this month" is not a report; "checkout conversion, sessions → completed order, 3.2% in
the week ending 21 Nov, versus 3.0% the previous week (±0.3pp noise)" is.

If the change is inside the noise, say it is inconclusive. A metric that moves by less than its
natural variation has not moved.
