# Technical Note Taking

Use when documenting an investigation, capturing decisions from a meeting or a session, or
building a knowledge base that stays useful months later.

## Write for the reader you will be

The note is for someone with no memory of the context, usually future-you. Anything that
relies on "everyone knows" will be lost.

## The four things worth capturing

| What | Why it survives | Where it goes |
|---|---|---|
| **Decision + rationale** | Prevents re-litigating the same choice | ADR / decision log |
| **How something works** | The map, not the territory | Runbook / architecture note |
| **Problem → cause → fix** | The exact case that recurs | Troubleshooting entry |
| **Why it does not work** | Saves days of repeating a dead end | Inline comment at the dead end |

What is not worth capturing: transcripts, meeting play-by-play, anything derivable from the
code in one read, and opinions with no decision attached.

## Structure of a useful technical note

```
Title: one line stating the question or the outcome
Date, author, status (draft / decided / superseded)

Context    — the situation and why it mattered
Question   — what we needed to answer
Answer     — the conclusion first
Evidence   — the commands, measurements, links that support it
Consequences / next steps
```

Answer before evidence: a reader looking for the conclusion should not have to read the
investigation to find it.

## Meeting and session notes

- Record **decisions** and **actions** (owner + date) separately from discussion.
- One line per decision: what was decided, by whom, and what was rejected.
- Actions without an owner are wishes. Actions without a date are never done.
- Skip the narrative of who said what; the value is what was concluded.

## Naming and retrieval

- A title states the outcome: "Cache keys must include the repository revision", not "Cache notes".
- One topic per note. A note that covers three topics is found by none of them.
- Keep the searchable noun in the first three words: the technology, the component, the error code.
- Link notes to each other and to the code they describe, so the note is discoverable from where the work happens.

## Keeping notes from rotting

- Date every note. An undated technical statement is a trap: the reader cannot tell whether it is current.
- Mark superseded notes explicitly rather than deleting them — the record of why an approach was abandoned is itself knowledge.
- When you find a note that is wrong, fix it in the same session. A knowledge base that is 10% wrong trains people to ignore it.
- Record the version the note was written against when behaviour is version-dependent.

## Anti-patterns

- A note that pastes a 200-line log with no statement of what to look for.
- "Fixed it" with no cause.
- Reorganising the knowledge base instead of writing in it.
- Confidential data, tokens or personal information in a shared note.
