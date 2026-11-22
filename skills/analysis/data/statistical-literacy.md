# Statistical Literacy

Use when interpreting a number, a study, a test result or a chart — yours or someone else's —
and to avoid the standard errors that make quantitative claims wrong.

## Before believing a number, ask three questions

1. **Of what?** Every percentage needs its denominator, every average needs its population.
2. **Compared to what?** A number without a reference point (baseline, previous period, control group) is uninterpretable.
3. **Measured how?** Who collected it, with what definition, by what method, over what period.

If the source cannot answer these, the number is decoration.

## Describing a distribution

- **Mean** is pulled by extremes; **median** is not. For income, latency and file sizes, the median is usually the honest summary.
- Report the **spread**, not only the centre: a mean latency of 100 ms with a p95 of 4 s is a different experience from 100 ms flat.
- Averages of already-averaged data are usually wrong (the average of per-store averages weights a corner shop like a hypermarket).
- Percentiles are not additive: the p95 of A plus the p95 of B is not the p95 of A+B.

## Uncertainty

- A point estimate without a range overstates knowledge. Report an interval and what it means.
- **Sample size drives precision**, roughly as √n: to halve the noise, quadruple the sample.
- A **confidence interval** describes the estimate's precision under the model, not the probability that this particular conclusion is right.
- A **p-value** is the probability of data this extreme if the null hypothesis were true — it is not the probability that the hypothesis is false, nor the probability that a result will replicate.
- "Statistically significant" means "unlikely under the null", not "important". With a large sample, trivial differences become significant.

## Effect size over significance

Ask how big the effect is in the units that matter: how many users, how much money, how many
seconds. A 0.2% conversion lift can be real and not worth the engineering. Report the effect
and its interval, and let the decision-maker judge relevance.

## Confounding and causation

- Two variables move together for at least four reasons: A causes B, B causes A, C causes both, or the association is an artefact of how the data was selected.
- Randomisation is the only reliable way to rule out the third and fourth. Without it, say "associated with" and name the plausible confounders.
- Watch for: survivorship bias, selection into the sample, regression to the mean (extremes at time 1 look less extreme at time 2 without any intervention), and the multiple-comparisons effect (test 20 things at p<0.05 and expect one false positive).

## Practical tests, without heavy tooling

With a calculator, `statistics` and a few lines of code:

- **Two-proportion comparison** for a conversion rate change: compute the difference, the pooled rate, and a rough standard error; compare with 1.96×SE for a 95% interval.
- **Mean comparison** with small samples: report the difference with its interval rather than a single number.
- **Bootstrap** for anything awkward: resample the data with replacement a few thousand times and look at the spread of the statistic. It needs no distributional assumptions and runs in 20 lines.

## Reporting quantitative results

- The estimate with its interval: "conversion rose 1.2 pp (95% CI: 0.4 to 2.0)".
- The sample and the period.
- What was excluded and why.
- What the result does not show.
- The decision it supports, or the fact that it is inconclusive.

An inconclusive result reported as inconclusive is a valid finding. Inventing a conclusion
from noise is the failure this skill exists to prevent.
