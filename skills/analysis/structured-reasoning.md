# Structured Reasoning

Use for problems where a wrong conclusion has real cost: decisions with trade-offs,
diagnoses, quantitative estimates, arguments that must hold under scrutiny.

## Make the question precise first

Vague questions produce vague answers that feel like reasoning. Convert the request into a
testable form before solving anything:

- **What decision does this feed?** An answer nobody acts on is an exercise.
- **What is being compared?** "Which database?" is not a question; "which database for a workload of 200 writes/s with strong consistency and a one-person ops team?" is.
- **What would make the answer wrong?** State the falsifier up front; a claim with no possible counter-evidence is not a claim.
- **What is unknown?** List what you would need and do not have. Then decide whether to state an assumption or stop and ask.

## Decompose before solving

Break the problem into parts that can each be checked independently. A single leap to a
conclusion is not checkable; five steps where each can be verified are.

- Use a tree when the structure is a decomposition: costs into components, causes into classes, arguments into premises.
- Use a table when the structure is a comparison: options × criteria, with explicit weights.
- Use a sequence when the structure is causal: what causes what, and what would break the chain.

Whatever the form, name every assumption you inject. Most disagreements are about an
unstated premise, not about the logic.

## Reasoning that survives review

- **State the inference rule.** "Because the lockfile pins 4.2 and the advisory covers <4.5, this version is affected." A conclusion whose inference is implicit cannot be checked.
- **Distinguish fact from estimate from opinion**, visibly. Mark estimates with their basis ("~30% based on the two comparable projects I know of").
- **Quantify when it changes the answer.** "Large" versus "2 KB" decides differently.
- **Consider the base rate.** "This test failed, so the code is broken" ignores how often tests fail for environmental reasons.
- **Check the extremes.** Does the conclusion still hold at the minimum and maximum of every quantity? Most errors hide at the boundaries.
- **Invert it.** Try to argue the opposite conclusion with the same evidence. If you can, the evidence is too weak to support either.

## Common failure modes

| Failure | Looks like | Fix |
|---|---|---|
| Confirmation | Only evidence for the preferred answer is listed | Actively list the two strongest points against |
| Anchoring | The first estimate survives every adjustment | Re-estimate from scratch, then compare |
| False precision | "47.3% likely" from no data | Use ranges and say the basis |
| Single cause | Complex outcome attributed to one factor | List at least three candidate causes, then rank |
| Conflation | Two related quantities treated as one | Name both and separate them |
| Absent base rate | A vivid case overrides the general frequency | Ask "how often does this class of thing happen?" |

## Communicating the result

1. **Answer first**, in one or two sentences.
2. **Key reasons**, three at most, each falsifiable.
3. **What would change the answer** — the evidence or threshold that flips it.
4. **Confidence**, with its basis rather than a bare number.
5. **Open questions** that you could not resolve.

If the honest answer is "this cannot be decided with the information available", say that and
name the specific missing information. A confident wrong answer costs more than an honest gap.

## Verifying your own reasoning

- Recompute every arithmetic step independently.
- Check units and orders of magnitude; a factor-of-1000 error is the most common quantitative mistake.
- Re-read the original question and confirm you answered *that* question.
- If a conclusion depends on a single unverified fact, single it out in the output.
