# Systematic Debugging

Use when a test fails, a build breaks, behaviour contradicts expectations, or something
that worked before stopped working. Use it before making any speculative change.

## The rule

Stop adding features. Preserve evidence. Find the cause before editing anything. A change
made before you understand the failure converts one bug into two.

## Procedure

### 1. Reproduce deterministically

Get the failure to happen on demand, with the smallest possible input.

- Record the exact command, input, and environment (versions, flags, data).
- If it is intermittent, note the frequency and look for the shared condition (time, ordering, concurrency, cache, network).
- If it does not reproduce in isolation, you have already learned something: the bug depends on state outside the failing unit.

### 2. Read the actual error

The most common waste of a debugging session is fixing a guess. Read the full stack
trace, the first error rather than the last, and the line that raised it. Distinguish:

- **symptom** — what the user or test observes;
- **proximate cause** — where execution failed;
- **root cause** — why the state was wrong when it reached that point.

Only the root cause is worth fixing.

### 3. Form one hypothesis and test it

State the hypothesis as a falsifiable sentence: "The cache returns a stale entry because
the key omits the revision." Then predict what you will see if it is true, and check.
Change one variable per experiment. If you change two things and it works, you have
learned nothing about either.

### 4. Instrument instead of guessing

Add the smallest observation that distinguishes your hypothesis from its alternatives:
a log of the offending value, a breakpoint, an assertion on an invariant. Remove the
instrumentation before finishing.

### 5. Bisect when it used to work

If the behaviour regressed, binary-search the change history (`git bisect`) or the input
space. A bisect over 1,000 commits needs about 10 steps; reading the diff of 1,000
commits does not finish.

### 6. Fix the cause, then guard

After the fix, add a test that fails on the pre-fix code. Without it you cannot prove the
bug is fixed, only that it is not currently visible.

## Failure taxonomy

| Symptom | First thing to check |
|---|---|
| Works alone, fails in suite | Shared mutable state, test ordering, leaked handles |
| Works locally, fails in CI | Environment differences: versions, locale, timezone, case-sensitive paths |
| Fails on second run only | Cache, idempotency, unclosed resources |
| Null / undefined deep in a trace | Contract at the boundary: who allows the absent value |
| Wrong data, no error | Stale cache, wrong key, wrong join, off-by-one |
| Fast locally, times out in CI | Real network or unbounded loop, not a race |

## Rules that prevent the most rework

- Never "fix" by suppressing the error (empty catch, `any` cast, retry loop) without naming the underlying failure.
- If two explanations fit the evidence, design an experiment that distinguishes them; do not pick the convenient one.
- If you cannot reproduce it, say so and document the conditions. A fix you cannot verify is a guess, and it should be reported as one.
- Re-read the code you are about to change, including the caller. Many bugs are a violated assumption two layers up.

## Reporting

State: reproduction, root cause, the change made, and how it was verified — the exact
command and its result. If verification was not possible in the environment, say that
plainly instead of describing the fix as proven.
