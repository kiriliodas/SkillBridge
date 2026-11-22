# Exploratory Data Analysis

Use to understand a dataset before modelling, before reporting, or when asked "what does
this data say" and the answer is not yet obvious.

## Sequence

### 1. Establish what a row is

Before counting anything: one row per what? One order, one order line, one user-day? A
dataset whose grain is wrong produces every summary wrong. Confirm with a uniqueness check on
the presumed key.

### 2. Check the shape, then the missing values

- Row count, column count, column types as actually stored (a numeric column stored as text is a defect, not a detail).
- Missing per column: count and percentage. Missingness is rarely random — check whether it correlates with another column or with time.
- Distinct counts per column: a column with one value carries no information; a column with as many values as rows is an identifier.

### 3. Look at the distributions

- Numeric: min, max, quartiles, mean. Compare mean and median — a large gap means skew or outliers.
- Categorical: value counts, and the long tail. Categories holding 0.1% of rows are usually dirty data, not insight.
- Time-based: plot counts over time. Sudden jumps and drops are usually collection changes, not behaviour changes.

### 4. Find the anomalies, and ask what causes them

- Negative values where negatives are impossible; dates in the future; ages over 120; zero-variance columns; duplicated rows.
- **Never delete outliers reflexively.** Determine whether they are errors, rare real events, or the most interesting part of the data.
- Check units and scales: a column mixing cents and euros looks like a bimodal distribution.

### 5. Answer the actual question

Only now compute the thing that was asked. State the denominator for every rate: "23% of
orders" means nothing without what the 23% is of, and whether the base includes cancelled ones.

## Traps that produce wrong conclusions

| Trap | Example | Check |
|---|---|---|
| Simpson's paradox | Conversion rises per segment, falls overall | Break the aggregate down before concluding |
| Survivorship | Churned users absent from the retention table | Ask who is missing from the dataset |
| Selection | Analysis only of users who completed onboarding | State the population explicitly |
| Time zone / boundary | "Day" defined differently in two systems | Confirm the time basis before comparing periods |
| Double counting | A join multiplied rows | Compare row counts before and after each join |
| Inclusive fudge | `<=` vs `<` on a date range | Check the exact boundary rows |

## Reporting

1. **The answer**, in one or two sentences, with the number and its denominator.
2. **The one chart** that supports it, if a chart is needed at all.
3. **Caveats** — the data quality issues that affect the conclusion, and those that do not.
4. **Method** — filters, join logic, exclusions, and the period covered.

Distinguish "the data shows" from "the data is consistent with". Correlations that invite a
causal reading should be labelled as correlational, with the confounders named.

## Working without the usual tooling

If pandas or a plotting library is unavailable, use the language you have: SQL aggregates,
a few dozen lines of Python with `csv` and `statistics`, or `awk`. Do the arithmetic and
report the actual numbers. Do not describe a dataset you could not load.

## Verification

- Recompute the headline number a second way (a different filter, a different aggregation) and confirm it matches.
- Check the total: do the parts sum to the whole?
- If a result implies a business fact, sanity-check it against an independent source before reporting it as a finding.
