# Translation Review

Use to check or improve a translation, or to translate technical and professional text while
preserving meaning, terminology and register.

## Fidelity, then fluency — in that order

A beautiful translation that drops a condition is worse than a clunky one that keeps it. Check
meaning first, style second, and never let a rewrite change a fact.

## The four things a translation must preserve

| Dimension | What it covers | Typical failure |
|---|---|---|
| **Propositional meaning** | facts, conditions, quantities, negations | a dropped "not", a swapped "increase/decrease" |
| **Implicature** | what is implied without being said | a politeness formula rendered as a demand |
| **Register** | formal/informal, technical/lay | a casual source turned bureaucratic, or vice versa |
| **Terminology** | domain terms, product names | three different renderings of the same concept |

## The checks that catch real errors

**Negation and scope.** Count negations in the source and in the target; a missing or extra
one is the most damaging error and the easiest to miss.

**Quantities and units.** Numbers, decimals, thousands separators (`1,000` vs `1 000`), currency,
units, date formats (US `03/04` vs European `04/03`). Convert only when asked; otherwise keep
the value and flag an ambiguous format.

**False friends and calques.** *Eventually* is not *éventuellement*; *actually* is not
*actuellement*; *sensible* is not *sensible*. Word-for-word rendering of idioms produces text
that is grammatically correct and semantically wrong.

**Terminology consistency.** Build a small glossary before translating: source term → chosen
target term. Apply it everywhere, including in headings and captions. Inconsistent terminology
is the most visible sign of a machine translation.

**Gender, number and agreement.** A collective noun ("the team") may need a singular verb in
one language and a plural in another; adjectives must agree with the noun they actually modify.

## Technical and professional text

- Keep code, identifiers, CLI flags, file paths, API names and error strings **untranslated** unless the product explicitly localises them.
- Translate UI labels for meaning, not literally: a French "Enregistrer" is a save action, not a recording.
- Preserve formality conventions of the target culture. The French *vous* / German *Sie* default is not a stylistic choice to be varied for elegance.
- Leave the source's structure when it carries information (step numbers, legal clause numbering, table alignment).

## Reviewing someone else's translation

1. Read the target alone, as a native reader would. Note where you stumble — those are the real defects, before you look at the source.
2. Compare sentence by sentence for meaning. Mark omissions and additions.
3. List every terminology inconsistency in one table.
4. Fix in order: meaning errors → omissions → terminology → style → surface.

## Reporting

- Give the corrected text in full.
- List substantive changes with the reason (meaning, terminology, register), not a line-by-line diff of style preferences.
- Flag anything requiring the author's decision: an ambiguous source sentence, a cultural reference with no equivalent, a pun, a term with two valid renderings.
- If you cannot verify a factual claim made in the source, do not smooth it — mark it.

## Limits

A translation of legal, medical or safety-critical content needs a qualified human reviewer.
Say so rather than implying that fluency equals accuracy.
