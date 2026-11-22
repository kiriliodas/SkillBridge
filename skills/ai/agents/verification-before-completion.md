# Verification Before Completion

Use before claiming that any work is done, fixed, passing or working — in a code task, a
document, an analysis or an answer.

## The rule

**No completion claim without fresh evidence from this session.**

If the verification command was not run in this session, the work is not verified. A previous
run, a plausible-looking code change and a confident report from another agent are not evidence.

## The gate

Before writing any claim of success:

1. **Identify the check.** What command, test or reading would prove this specific claim?
2. **Run it, fully.** Not a subset, not a linter standing in for a test.
3. **Read the output.** Exit code, failure count, skipped count, warnings that matter.
4. **Compare.** Does the output actually support the claim? Partially supported is not supported.
5. **Only then, claim it** — attaching the evidence.

Skipping a step turns verification into a performance of verification.

## Claim → required evidence

| Claim | Requires | Not sufficient |
|---|---|---|
| Tests pass | Test output with 0 failures, and skipped count | A previous run; "should pass" |
| Build succeeds | Build command, exit 0 | Lint passing; logs that look fine |
| Bug fixed | The original symptom reproduced and now gone | Code changed, appears correct |
| Regression test added | The test fails on the pre-fix code | The test passes once |
| Types check | `tsc`/mypy exit 0 with the project config | No red squiggles in the editor |
| Lint clean | Linter output, 0 errors | A partial file check |
| Performance improved | Before and after measurement, same conditions | Reasoning about complexity |
| Dependency safe | A scanner's output for the installed versions | Memory of advisories |
| Document accurate | Each claim traced to its source | The document reads well |
| File written | The file exists and its content was read back | The tool reported success |

## Red flags in your own output

Stop and verify when you notice yourself:

- Writing "should", "probably", "seems to", "ought to work".
- Saying "perfect", "done", "all set" before running anything.
- Reporting a number you did not see in an output (a test count, a size, a duration).
- Summarising a long output without checking its failing lines.
- Trusting a tool's success message without reading what it produced.
- Extending a pass from one module to the whole project.

## Partial and failed verification

Verification can legitimately be impossible: no runtime, no network, no browser, no database,
no API access. In that case:

- Say exactly which check could not be run and why.
- State what you did verify instead, and what it does and does not cover.
- Label unverified output as unverified — do not let it inherit credibility from the verified parts.
- Never convert "not tested" into "works" through confident phrasing.

## Reporting format

> `npm test` → 274 passed, 0 failed, 18 files (exit 0).
> Build not run: the sandbox has no Node toolchain after reset.

Compare with the failure mode this prevents:

> Everything looks good now, tests should pass.

The first can be trusted or challenged. The second wastes the reader's time twice: once
believing it, once discovering it was false.

## Why this is not pedantry

An unverified claim propagates. Someone builds on it, ships it, and the false claim becomes
someone else's unexplained bug. The cost of running the command is seconds; the cost of a
false "done" is measured in hours of someone else's debugging.
