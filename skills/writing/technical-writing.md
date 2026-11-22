# Technical Writing

Use for documentation, READMEs, API references, design documents, runbooks and any prose
whose reader needs to act on it.

## Decide the document's job first

Every document has one primary job. Mixing jobs is why most documentation is unusable.

| Job | Reader's question | Shape |
|---|---|---|
| Tutorial | "How do I start?" | Linear steps on a known-good path |
| How-to | "How do I do X?" | Steps for one goal, prerequisites stated |
| Reference | "What does this parameter do?" | Exhaustive, structured, scannable |
| Explanation | "Why is it built this way?" | Prose, trade-offs, context |

A README is usually all four in sequence. A design doc is explanation plus a decision record.
Pick the order, and do not bury the steps inside the rationale.

## Structure that survives skimming

1. **First sentence states the purpose and the audience.** "This service authenticates API clients and issues short-lived tokens." Not "In this document we will discuss…".
2. **The answer comes before the reasoning.** A reader who stops after two paragraphs should still have the actionable part.
3. **Headings are a table of contents.** Someone reading only the headings should understand the argument.
4. **One idea per paragraph**, ~4 lines maximum. Technical readers skim; dense blocks are skipped.
5. **Examples before abstractions.** Show the concrete call, then explain the rule.

## Sentences that carry weight

| Weak | Why | Strong |
|---|---|---|
| "It should be possible to configure…" | Passive, uncertain | "Set `TIMEOUT=30` in `.env`." |
| "Various options are available" | Names nothing | "Three options: A, B, C." |
| "Simply run the command" | "Simply" is accurate only for the author | "Run `make build`." |
| "Note that… / Please note…" | Filler | Delete it and state the thing. |
| "In order to" | Wordy | "To" |
| "Utilise" | Pretentious | "Use" |

Cut hedges unless the uncertainty is real: "typically", "generally", "should work" all
signal that the author did not verify. If you did not verify, say what you did verify.

## Code in documentation

- Every code block runs as written. A snippet with `...` in the middle is a fragment, and should be labelled as one.
- Show the expected output, so a reader can tell success from silent failure.
- Pin versions in examples when behaviour differs across versions, and say which version the example targets.
- One concept per block. A fifteen-line block that does five things is not an example, it is a program.

## Writing the README that people actually read

Order: what it is (one sentence) → why it exists → install (copy-pasteable) → minimal
working example → configuration table → limitations → license. Put the limitations early
enough that a reader does not discover them after integrating.

## Editing pass — do this before delivering

1. Delete the first paragraph and re-read. If nothing is lost, the paragraph was throat-clearing.
2. Replace every "this" and "it" whose referent is more than one sentence back.
3. Read the headings alone: do they form a coherent outline?
4. Run every command and every code sample. Report what happened.
5. Check the claims that another document, a README badge, a version number, or a benchmark figure could contradict.
6. Read one paragraph aloud; anything you stumble on gets rewritten.

## Honesty in technical claims

- Distinguish "tested on X" from "should work on X". Only the first is a claim you can defend.
- A benchmark without its environment, sample and method is a marketing number.
- Never describe a design as validated because it compiles.

## Formats

- Markdown: ATX headings (`##`), fenced code with a language tag, tables only for short cells, one sentence per line is acceptable for diffs.
- Link text describes the destination: "the retry policy" not "here".
- Avoid screenshots of text; they cannot be searched, copied or read by a screen reader.
