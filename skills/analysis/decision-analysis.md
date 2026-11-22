# Decision Analysis

Use to choose between options under uncertainty where the choice matters and is hard to
reverse — architecture, hiring, vendor selection, prioritisation.

## Define the decision before comparing options

- **What exactly is being decided?** A decision that can be split is worth splitting: "which database" may really be "what access pattern do we need".
- **Who decides, and by when?** A decision without an owner and a date is a discussion.
- **Reversible or not?** Reversible decisions deserve speed and a rollback plan; irreversible ones deserve the analysis below.
- **What is the cost of being wrong?** This sets how much analysis is worth doing. Analysis that costs more than the mistake is waste.

## Build the comparison, not the argument

A table forces the trade-offs into the open:

| Criterion | Weight | Option A | Option B | Option C |
|---|---|---|---|---|
| Meets the hard requirement | gate | pass/fail | | |
| Operating cost | 0.3 | 2 | 4 | 3 |
| Migration effort | 0.3 | 4 | 2 | 3 |
| Team familiarity | 0.2 | 3 | 3 | 1 |
| Exit cost | 0.2 | 2 | 3 | 4 |

Rules that keep the table honest:

- **Gates first.** A requirement that is pass/fail is not a weighted criterion; an option that fails it is out, whatever its score.
- **5–6 criteria maximum.** Twenty criteria average out into meaninglessness.
- **Weights before scores.** Choosing weights after seeing the scores is how the preferred option wins retroactively.
- **Define the score meanings.** What is a 2 versus a 4 — and who decided. Otherwise two people score the same option differently and the table proves nothing.
- **Show the spread.** If two options are within noise of each other, the decision is a tie and should be made on a different basis (cost, reversibility, team preference).

## Handle uncertainty explicitly

- For each key assumption, ask: what is the range, and does the decision change anywhere inside it? If not, the uncertainty does not matter — say so and move on.
- Prefer a robust option (acceptable under most assumptions) over an optimal one that wins narrowly under one.
- For irreversible decisions with high uncertainty, buy information: a small trial, a spike, a pilot. The cheapest way to reduce uncertainty is usually to test, not to think longer.

## Avoid the standard traps

| Trap | Sign | Counter |
|---|---|---|
| Sunk cost | "We have already invested" | Judge only future costs and benefits |
| Anchoring | The first option wins every comparison | Evaluate each option against the criteria independently |
| False binary | "A or B" when C exists | Ask what a third option would look like |
| Analysis paralysis | The decision misses its deadline | Set a deadline; decide on the best available evidence |
| Groupthink | No dissent recorded | Ask for the strongest argument against the leading option |

## Communicate the decision

1. **The decision**, in one sentence, with the date and the owner.
2. **Why** — the criteria that drove it and the ones that were traded away.
3. **What was rejected and why** — so the same options are not re-litigated next month.
4. **Assumptions** that, if wrong, reopen the decision. This is the trigger for review.
5. **Reversal cost** — what it takes to undo, and when that stops being possible.

A decision record that omits the rejected options is a justification, not a decision.
