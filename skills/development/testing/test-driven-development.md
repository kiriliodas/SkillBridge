# Test Driven Development

Use when implementing behaviour that has a clear expected outcome, when fixing a bug,
or when the user asks for tests first. Do not use it for exploratory spikes or pure
refactors that already have coverage.

## The cycle

Repeat in small loops. One loop should take minutes, not hours.

1. **Red.** Write the smallest test that expresses one new behaviour. Run it. It must fail **for the right reason** — assert that the failure message is the missing behaviour, not a typo or a missing import.
2. **Green.** Write the minimum production code that makes it pass. Do not add parameters, branches or abstractions the test does not require.
3. **Refactor.** With the test green, improve names and structure. Run the test after every change; it must stay green.
4. **Commit** at green, so every commit is a known-good state.

The order matters: a test written after the code proves nothing about the code's intent,
because it can only describe what the code happens to do.

## What makes a test worth keeping

A test is a specification, not a screenshot. Each test should fail if and only if one
specific behaviour breaks.

| Property | Bad | Good |
|---|---|---|
| Focused | `test('user flow works')` asserting twelve things | `test('rejects an expired token')` |
| Behavioural | Asserts a private method was called | Asserts the observable outcome |
| Deterministic | Uses `Date.now()`, random ids, real network | Injects a clock, a seed, a fake client |
| Independent | Depends on another test having run | Sets up its own state |
| Diagnosable | `expect(result).toBeTruthy()` | `expect(result.error).toBe('TOKEN_EXPIRED')` |

Use **Given / When / Then** to structure the body:

```
// Given an expired token
// When the client refreshes
// Then the refresh is rejected with TOKEN_EXPIRED
```

## Test the boundaries, not the middle

For each unit, enumerate the input space and write one case per class:

- nominal case (one is usually enough)
- empty / zero / null
- maximum and minimum allowed values
- exactly at the boundary, and one step either side
- malformed input (wrong type, wrong encoding, truncated)
- the error path, including what the caller observes

Most production bugs live at boundaries and on error paths, which is precisely where
untested code accumulates.

## Bug-fix protocol

1. Reproduce the bug as a failing test. If you cannot reproduce it, you cannot verify the fix.
2. Confirm the test fails on the current code — this proves the test targets the bug.
3. Fix the cause, not the symptom.
4. Confirm the test passes, and confirm it fails again if you revert the fix. A test that passes both before and after the fix is not a regression test.

## Anti-patterns

- **Assertion-free tests** that only check "no exception was thrown".
- **Snapshot-only tests** for logic: they pass when the behaviour is wrong and were never reviewed.
- **Over-mocking** until the test asserts the mock's behaviour instead of the code's.
- **Testing implementation details** (private functions, call order) — these break on every refactor and catch nothing.
- **One giant test file** per module where a failure points at nothing specific.
- **Chasing coverage.** Coverage shows what was executed, not what was verified. A line executed by an assertion-free test counts as covered and proves nothing.

## In constrained environments

If the project has no test runner, do not install one just to follow this skill. Write a
plain script that asserts and exits non-zero on failure, and say explicitly that you ran
it. Never report "tests pass" for tests that were not executed.

## Verification before declaring done

Run the full suite and report the actual counts (passed, failed, skipped). Skipped tests
are not passing tests. If the suite cannot run — missing runtime, missing dependency,
unavailable service — report the blocker and the exact command that failed.
