# Planning And Execution

Use when a task is too large for one step, when progress stalls, or when asked for a plan.

## The plan is a decision tool, not a document

A useful plan answers three questions: what is the end state, what is the next action, and
how will we know it worked. Everything else is optional.

## Decompose to actions, not to topics

"Research the API, design the schema, implement the backend" is a list of topics — nothing
in it can be started. A work item is ready when:

- it has a verb and an artefact ("write the migration for the `orders` table");
- it can be done in one sitting (under a few hours);
- its completion is observable without asking anyone;
- its dependencies are already done.

Stop decomposing when the item is that size. Decomposing further produces ceremony.

## Order the work

1. **Unknowns first.** The item that could invalidate the plan goes first, while changing direction is still cheap.
2. **Then the critical path.** The longest chain of dependent work determines the end date; anything not on it can wait.
3. **Then the cheap wins** that unblock other people.

Flag anything that is a guess. "The API supports batch updates — to verify" is honest; a plan
built on unverified assumptions is a hypothesis wearing a Gantt chart.

## Estimate with ranges and reasons

Give a range and the driver: "2–4 days, depending on whether the legacy importer can be
reused". A single number implies precision you do not have, and the first thing that happens
to an over-confident estimate is that it is wrong.

When the estimate exceeds a week, split the item: long items hide unknowns and delay feedback.

## Execute

- **Work in small increments** that leave the system working. A half-finished refactor with the tests red is not progress you can pause.
- **One thing in flight.** Parallel work is for independent items with different owners, not for one person interleaving.
- **Track blocked, not busy.** A task waiting on someone else is the information worth surfacing.
- **Update the plan when reality changes.** A plan kept as originally written after the first surprise is fiction; keep the history so the change in understanding is visible.

## The single next action rule

If you cannot name the next concrete action, the item is not ready. That means the item needs
to be clarified, split, or researched — do that instead of starting and stalling.

## Review rhythm

- **Daily**: what moved, what is blocked, what is the next action.
- **At each milestone**: is the end state still the right one? Plans drift because the goal changes and nobody re-decides it.
- **At the end**: what took longer than expected and why. Without this, the next plan repeats the same error.

## Reporting progress honestly

- "Done" means verified complete, by the definition stated in the plan — not "code written".
- "80% done" is not information; say which parts are complete and which remain.
- Report the blocker and its owner, not "waiting".
- If a deadline is at risk, say so at the earliest moment. Late warning is a second failure.

## Anti-patterns

- A plan with more than one level of nesting: it is a schedule, and it will be wrong.
- Estimating in "ideal days" and reporting in calendar days, without stating the conversion.
- Big-bang delivery where nothing is testable until the end.
- Tasks assigned to nobody.
- A plan that lists only the work, never the verification.
