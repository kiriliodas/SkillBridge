# Code Review

Use when reviewing a diff, a pull request, or your own changes before committing, and
when asked to assess code quality.

## The standard

Approve a change that definitely improves the code, even if it is not how you would have
written it. Block a change that introduces a defect, an unverified claim, or a contract
that callers cannot rely on. "I would have done it differently" is not a review finding.

## Order of review — cheap and irreversible first

Read the diff in this order; stop and report as soon as a blocking issue is found.

1. **Intent.** Does the change do what its description claims? Is the description true about the code?
2. **Correctness.** Boundaries, error paths, empty and null inputs, concurrency. Is the failure mode of each new branch defined?
3. **Security.** Untrusted input reaching a sink (query, shell, path, HTML, deserialisation). Secrets in code or logs. Authorisation checked at the boundary that matters.
4. **Contracts.** Public behaviour changes, signature changes, migrations, wire formats. Is the old contract still honoured, or is the break deliberate and documented?
5. **Test evidence.** Do the tests fail when the behaviour is broken? Are the assertions about outcomes rather than internals?
6. **Readability.** Names, structure, dead code, comments that restate the code.
7. **Performance.** Only where a hot path or an unbounded operation is evident. Speculative optimisation is noise.

## Blocking versus non-blocking

Label every comment so the author knows what is required:

- **blocking** — a defect, a security issue, an unverified claim, a broken contract.
- **suggestion** — an improvement the author may decline.
- **question** — you lack context; ask before asserting.
- **nit** — cosmetic; never blocks a merge.

Unlabelled complaints are the main reason reviews waste time.

## What to look for — concrete signals

**Correctness**

- A branch whose failure case is unspecified.
- An `await` missing, or sequential awaits that should run concurrently.
- A numeric boundary: `>` versus `>=`, empty collection, zero, first and last element.
- A resource acquired without a release path on error.

**Change size**

- A new conditional bolted onto an unrelated flow: push the logic into its own helper rather than tangling an existing path.
- The same shape of conditional repeated three times: a missing model or dispatcher, not three fixes.
- A refactor that relocates complexity instead of removing it. If the number of concepts a reader must hold is unchanged, it is not simpler.

**Tests**

- Asserts only that no exception was thrown.
- Snapshot or golden files with no reviewable content change.
- A test named after the function instead of the behaviour.
- Coverage claimed as evidence of correctness.

**Content and claims**

- Comments, docs or commit messages that state something the code does not do.
- Removed validation "because it was in the way" without a replacement.

## Writing the review

1. Lead with the verdict and the one or two things that matter.
2. Quote the specific lines; do not paraphrase them from memory.
3. For each blocking item: what breaks, under which input, and why the current code allows it.
4. Say what you verified and what you did not. A review of a diff is not a review of the system.
5. Do not restate the diff back to the author; spend the words on judgement.

## Reviewing your own change

Before requesting review, read your own diff as if it were someone else's: remove
debugging leftovers, revert unrelated formatting, confirm every claim in the description,
and run the test suite yourself. State the command and the result, including skipped tests.

## Limits

A reviewer who cannot run the code should not approve on the basis of "it looks right".
Say that verification was not possible and let the author or CI provide it.
