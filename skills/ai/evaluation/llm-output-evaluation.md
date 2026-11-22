# LLM Output Evaluation

Use when you must judge whether an LLM output is good, compare two prompts or models, or
build a repeatable check instead of an opinion.

## Separate the two questions

"Is this answer good?" is unanswerable until split:

- **Deterministic properties** — schema validity, required fields, length bounds, citation presence, unit correctness. Check these with code, never with a model.
- **Judgement properties** — correctness, relevance, tone, completeness. Check these with a rubric.

Most evaluation projects drown in model-as-judge scoring for properties that a
three-line regex would have settled.

## Build the sample before touching the rubric

1. 20–50 cases is enough to start; a thousand random cases give less signal than twenty that cover distinct failure modes.
2. Draw from **real** inputs first, then hand-write the edge cases the system fails on: empty input, adversarial input, ambiguous request, unanswerable question, the case that must be refused.
3. Attach the expected outcome or, when there is no single answer, the rubric the answer must satisfy.
4. Version the set. A changed dataset makes every previous score incomparable.

A set made of ten variations of the easy case measures nothing; spread the cases across
distinct failure modes instead.

## Writing a rubric that produces stable scores

For each criterion, define what the score levels actually mean in observable terms.

| Score | Meaning for "grounded" |
|---|---|
| 5 | Every factual claim traces to the provided context |
| 3 | Claims are grounded except one minor unsupported detail |
| 1 | Contains a claim contradicted by, or absent from, the context |

Rules that make rubrics reliable:

- 3–5 criteria, independent of each other. "Quality" and "professionalism" overlap and cannot both be scored.
- Weight by real priority: correctness at 0.5, tone at 0.1, not five equal averages.
- Anchor every level to content, never to length. If you cannot describe the difference between a 3 and a 4, the criterion is not testable.
- Score one dimension at a time; a single "overall 7/10" merges everything and explains nothing.

## Using a model as judge — and its biases

A judge is a measurement instrument with known drift. Control it or do not trust it:

| Bias | Symptom | Control |
|---|---|---|
| Verbosity | Longer answers win regardless of content | State that length must not affect the score; audit correlation with word count |
| Position | The first answer wins | Swap A/B order and require agreement both ways |
| Self-preference | A model favours its own family | Use a judge from another model family, or an ensemble |
| Formatting | Markdown and confidence are rewarded over substance | Score content only; strip formatting before judging |
| Sycophancy | The judge agrees with the stance it is shown | Never state your own preference in the judge prompt |

Practical rules: ask for the rationale before the score, use temperature 0, pin the model
version, and keep the rationales for debugging but score the structured output, not the
fluency of the rationale.

## Validating the judge against humans

1. Hand-score 30–50 examples.
2. Run the judge on the same examples.
3. Compare; compute agreement (Cohen's kappa if you want chance-corrected numbers).
4. Read every disagreement. They almost always reveal a vague rubric level rather than a bad judge.
5. Sharpen the anchors and repeat until agreement is acceptable.

A judge that was never validated against human labels is an opinion with an API bill.
Report agreement alongside the score.

## Reading the results honestly

- Report the counts: cases run, passed, failed, errored. Errors are not failures and must not be folded into the pass rate.
- Report the sample size and the confidence you actually have. 8 of 10 passing is compatible with a 50% true pass rate.
- Slice by failure type, not by average. A mean hides the class of cases that always fails.
- Compare against a baseline: the previous prompt, the unmodified model, the naive approach. An absolute score with nothing to compare it to is not evidence.

## When evaluation is not possible

If there is no way to run the system (no API access, no runtime, no data), say so. Offer a
rubric and a test plan the user can run, and label any quality claim as an estimate rather
than a measurement.
