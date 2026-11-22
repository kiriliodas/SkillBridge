# Technical Proposal

Use to justify a piece of technical work before it is approved: a migration, a new service, a
rewrite, an infrastructure investment.

## Structure that gets read

Decision-makers read the first paragraph and the cost. Engineers read the design. Write for
both, in this order:

```
1. Recommendation — one paragraph, one sentence of decision, one of cost
2. Problem — what is broken or missing, with evidence
3. Options — at least three, including "do nothing"
4. Recommendation + why, against explicit criteria
5. Cost, effort, risks
6. Plan and how success will be measured
```

Put the recommendation first. A proposal that builds suspense until page six is rejected by
people who only read page one.

## Evidence for the problem

Quantify with what you actually have, and say what you do not have:

- incident counts and their cost
- latency, error rate, and the threshold at which it becomes user-visible
- hours spent per week on the manual workaround
- how many customers are blocked, and by what

"Technical debt" is not evidence. "Three of the last five incidents traced to the same module,
40 minutes of downtime each" is.

If the problem cannot be quantified, say so and argue from risk and reversibility instead —
without pretending a number exists.

## Options, including the null option

Include "do nothing" explicitly, with its cost. An option set without it invites the question
"why is this urgent at all", and having already answered it is what separates a proposal from
a wish.

For each option: what changes, what it costs, what it risks, what it enables, and what it
prevents later. A proposal with one option is a decision already made, presented for approval.

## Cost and effort

- Estimate in ranges with the driver: "6–10 weeks, depending on whether the importer is reusable".
- Separate one-off effort from ongoing cost. A cheap build with an expensive run is not cheap.
- Include the work that is easy to forget: migration, backfill, monitoring, documentation, training, rollback.
- Say who does the work and what is displaced. "Two engineers for six weeks" means something else was not done.

## Risks

State them with likelihood and mitigation, and include the risk of not doing it. A risk section
that lists only "might take longer than planned" is not a risk section.

## Measuring success

Define the metric before starting: what number, measured how, at what point, and what counts
as success versus failure. A project without this cannot be evaluated, only defended.

## Common failure modes

| Failure | Symptom | Fix |
|---|---|---|
| Solution-first | Opens with the technology, never states the problem | Rewrite from the problem |
| Unbounded scope | "And we could also…" | One proposal, one decision |
| Invisible cost | Only build effort listed | Add run cost and displaced work |
| False precision | "3.7 months" | Ranges with drivers |
| No counterfactual | No "do nothing" option | Add it, with its cost |
| Unfalsifiable benefit | "Better developer experience" | Name the metric and the baseline |

## Review before sending

- Does the first paragraph state the decision and the cost?
- Is every number sourced or labelled as an estimate?
- Would an engineer who disagrees with the recommendation find their objection addressed?
- Is the ask explicit: approval, budget, headcount, or a decision date?
