# Test Design

Use when a suite is slow, flaky, or too shallow to catch regressions; or when adding tests to a
codebase that has few.

## The test pyramid, in practice

| Layer | Count | Speed | What it proves |
|---|---|---|---|
| Unit | many | ms | one function's logic across its input space |
| Integration | fewer | 100ms–1s | modules wired together, real boundaries |
| End-to-end | few | seconds–minutes | the user's path works at all |

The counts follow from cost, not from dogma: a thousand fast unit tests will run on every
save; ten E2E tests already take a minute. Bugs escape at the layer nobody wrote: usually
integration — each unit correct, the wiring wrong.

## What to test, and what not to

**Test:** behaviour that a caller or user depends on; every branch and boundary in complex
logic; every bug you fixed; the contract at each boundary (parsing, validation, serialisation).

**Do not test:** the language and framework; trivial getters; private helpers (test them
through the public function); implementation details that will change on every refactor.

Coverage is a diagnostic, not a target. A 100% covered module can contain zero assertions, and
a critical branch can be the only uncovered line.

## Choosing assertions

- Assert the **specific** outcome: `expect(status).toBe(409)`, not `expect(status).toBeGreaterThan(0)`.
- One logical assertion per test, even if it needs several `expect` calls to express it.
- Assert the error message or code that a caller sees, not the internal exception.
- For collections, assert the exact contents (order-insensitive when order is not part of the contract).
- Avoid snapshots for anything with logic; they are reviewed once and approved forever.

## Fixtures and isolation

- Each test creates its own state. A test that depends on another having run fails alone, and that failure looks like a product bug.
- Share expensive setup (a database container, a server) at suite level; create per-test data inside it.
- Freeze time, seed randomness, pin locale and timezone. "It fails on Tuesdays" means a date dependency.
- Clean up in a teardown, or better, make the test create a unique namespace it can abandon.

## Flakiness

A flaky test is worse than no test: it teaches the team to ignore failures.

1. Reproduce it by running the single test in a loop (`--repeat`, `for i in {1..50}`).
2. Look for the usual four causes: shared mutable state, ordering, timing (`sleep`, animations, async races), and external services.
3. Fix by removing the source of non-determinism, not by adding a retry. A retry hides the bug; it does not fix it.
4. Delete the test if it cannot be made deterministic and it tests nothing unique.

## Naming

A test name is a specification sentence: `rejects an expired token`, `returns an empty list
when no filters match`. Named after the behaviour, not the method — `test('calls parse')`
tells the next reader nothing.

## Test data

- Use the smallest realistic values: `'user@example.com'`, not 500 generated rows.
- Include the awkward ones: unicode, emoji, leading zeros, an empty string, a very long string.
- Never use production data. Ever. Generate or anonymise.

## When the suite cannot run

If the environment lacks a runtime, a dependency, or a service the suite needs, say so and
report the exact command that failed. Never mark tests as passing because the change "looks
right", and never reduce the suite to the part that happens to run without saying which part
was skipped.
