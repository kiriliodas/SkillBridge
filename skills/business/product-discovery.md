# Product Discovery

Use before building: to check that the problem is real, who has it, and whether the proposed
solution addresses it.

## Start from the problem, not the feature

A feature request is a proposed solution, and it carries an implicit diagnosis that is
usually untested. Extract the problem behind it:

- **What is the person trying to accomplish?** The goal, not the step.
- **What do they do today?** The current workaround is the real competitor, including "nothing" and "a spreadsheet".
- **What does the workaround cost them?** Minutes per task, errors, a person hired to do it.
- **What happens if it is not solved?** Nothing? Then it is not a problem worth building for.

"If we build this, they will use it" is a hypothesis, and the cheapest place to test it is not production.

## Evidence hierarchy

1. **Observed behaviour** (analytics, session recordings, support tickets with the actual words) — strongest.
2. **Direct interviews** about past behaviour: "the last time this happened, what did you do?" — strong.
3. **Stated preferences** about the future: "would you use X?" — weak, and systematically optimistic.
4. **Internal opinion** — weakest, and usually the loudest.

Ask about the past, not about the future. People are reliable reporters of what they did and
unreliable predictors of what they will do.

## Interviewing without leading

- Ask for a specific episode: "walk me through the last time you did X". Generality produces generalities.
- Never pitch the idea in the interview. The moment you describe it, the person starts being polite.
- Follow the cost, not the opinion: "how long did that take?", "what did you do next?", "who else was involved?"
- Count how many of the people you spoke to hit this problem unprompted. If it must be suggested, it is not painful enough.

## Sizing the problem

- **How many** people have it, and are they the ones who would pay or adopt?
- **How often** does it occur — daily pain and annual annoyance justify different investments.
- **How bad** is it: minutes, euros, a blocked task, a compliance risk?
- Multiply: frequency × cost × population is a rough upper bound, and usually an order of magnitude above the truth. State your assumptions.

## Deciding whether to build

Build when the problem is frequent, costly, and the workaround is bad. Otherwise consider, in
order of cheapness: documentation, a configuration change, an integration with an existing
tool, a manual process with a clear owner, then a product.

The strongest reason to build is that people are already paying for a worse workaround.

## What to write

```
Problem   — who, when, what they do today, what it costs
Evidence  — how many, how often, from which sources
Scope     — what is in, and explicitly what is out
Success   — the measurable change that would prove it worked
Risks     — why this might be the wrong problem
```

"The user wants X" is not a problem statement. "Support handles 40 tickets a week from users
who cannot find their invoice; each takes 12 minutes" is.

## Anti-patterns

- Validating a decision already taken (the interview becomes a demo).
- Counting feature requests without weighting by the customers who matter.
- Confusing a vocal minority with a market.
- Skipping the "do nothing" option, which is what most users will choose.
