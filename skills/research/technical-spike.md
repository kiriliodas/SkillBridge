# Technical Spike

Use when a decision depends on unknown feasibility: an unfamiliar API, a performance target, a
library that may not support the requirement.

## A spike answers one question

State it as a falsifiable sentence before starting: "Can this library parse a 200 MB CSV
without exceeding 512 MB of RAM?" Without a question, a spike becomes a half-built feature
that nobody dares delete.

Write down, before starting:

- the question, and what evidence would answer it;
- the time box (usually hours, or one day at most);
- what will be thrown away (the answer is the deliverable, not the code).

## Rules

1. **Throwaway code.** Spike code is written to be deleted: no tests, no abstractions, no error handling beyond what the experiment needs.
2. **Answer the question first.** Do not improve the prototype; the moment it becomes presentable it starts to feel like a deliverable.
3. **Measure what the question needs.** If the question is about performance, measure on realistic data volume; an empty database answers nothing.
4. **Record what you tried**, including the dead ends. A spike that "did not work" is a result, and the path is worth as much as the answer.
5. **Stop at the time box.** If the question is not answered by then, that is the finding: the risk is larger than estimated, and the decision needs that information.

## Recording the result

```
Question     — as stated before the spike
Answer       — yes / no / depends, in one sentence
Evidence     — the commands run, the numbers measured, the versions used
Limits       — what the spike did not test (scale, concurrency, edge cases)
Implication  — what this means for the decision, and the new risk if any
```

## What a spike is not

- A prototype to grow into production. The code has no tests, no error handling and no design; promoting it is how the worst parts of a codebase are born.
- A way to avoid deciding. If the answer is obvious from documentation, read it instead.
- An excuse to explore without a question. Exploration is legitimate, but it should be named as such and time-boxed too.

## Honesty

A spike often produces a negative result. Report it plainly: "the approach does not meet the
target under realistic load" is exactly the value the spike was meant to deliver. Never
present an unmeasured prototype as evidence that an approach works.
