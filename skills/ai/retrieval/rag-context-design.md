# RAG Context Design

Use when building or debugging a system that answers from retrieved documents, or when an
assistant with documents in context still answers wrongly.

## The failure is usually retrieval, not the model

Before changing the prompt or the model, determine which half failed. Ask the system, for
each wrong answer, whether the correct passage was in the retrieved context.

- Not retrieved → retrieval problem (chunking, index, query).
- Retrieved but ignored → context assembly or instruction problem.
- Retrieved, read, and contradicted → document quality or conflict problem.

Fixing the generator when retrieval failed produces a confident answer built on the wrong
evidence.

## Chunking

Chunk by **structure first, size second**. Split on headings, sections, functions; fall back
to a token limit only for oversized sections.

- Keep chunks in the low hundreds of tokens: one coherent idea per chunk.
- 10–20% overlap prevents an idea that straddles a boundary from being lost in both halves.
- Prepend the document title and heading path to every chunk. Queries often match the frame, not the body.
- Never split a table, a code block or a list from its heading.

The right question is not "what chunk size?" but "what is one complete idea in this document?"

## Retrieval that covers both blind spots

Pure vector search is strong on paraphrase and weak on exact strings — error codes, IDs,
names, version numbers. Lexical search is the inverse.

- Run both and fuse the ranked lists (reciprocal rank fusion is a few lines and needs no tuning).
- Retrieve wide (20–50 candidates), then rerank with a cross-encoder or a scored second pass, and keep 3–6.
- Filter on metadata before scoring when the constraint is hard (tenant, version, date range).
- Rewrite the query when it is thin: expand acronyms, add the domain term the user omitted.

More context is not better context. Beyond a few well-chosen passages, additional chunks
dilute attention and increase the chance of contradictory material.

## Context assembly

- Deduplicate near-identical chunks from the same section.
- Order by relevance, but keep document order within a document so references read naturally.
- Label each passage with its source and location so the model can cite it.
- Stay inside a token budget; if you must truncate, truncate the least relevant chunk rather than the end of the prompt.
- Put the instruction *after* the retrieved context as well as before it; critical rules buried above a long context are ignored.

## Grounding instructions that work

```
Answer only from the passages below.
For every factual statement, cite the passage number in brackets.
If the passages do not answer the question, say what is missing — do not use prior knowledge.
If two passages disagree, present both and say which is more recent and why.
```

Instruction alone does not create grounding; it only makes the failure visible. If the
passages are wrong or absent, the honest output is a refusal, and that refusal is a success
of the system, not a defect.

## Verification

- Check that each citation actually supports the claim it is attached to, mechanically if possible: extract claim-citation pairs and verify each one.
- Track two numbers separately: retrieval hit rate (was the right chunk retrieved) and groundedness (was the answer supported). An end-to-end score hides which half broke.
- Test with unanswerable questions. A system that answers everything is retrieving nothing meaningful.

## Anti-patterns

- Dumping an entire document into context because chunking is hard.
- Embedding only whole documents and hoping similarity finds the paragraph.
- Treating the index as trusted input: anything that can write into the corpus can write instructions into your prompt.
- Adding a reranker before checking that the correct chunk is retrieved at all.
