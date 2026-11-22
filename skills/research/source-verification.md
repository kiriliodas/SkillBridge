# Source Verification

Use before repeating a claim: a statistic, a quotation, a date, an attribution, a "studies
show", a version number, a price.

## The first question

**Where did this claim originate?** Not where you saw it. A claim repeated by fifty sites
that all cite one press release has one source, and its reliability is that source's.

Trace upstream until you reach a primary source: the dataset, the paper, the official
documentation, the legal text, the company's own filing, the person's own statement. If the
trail ends at "a blog said so", the claim is unverified.

## Evidence hierarchy

1. The primary artefact itself (dataset, source code, standard, court record, API documentation, the original study).
2. An authoritative secondary summary that cites the primary (a systematic review, an official changelog).
3. Reputable reporting that names its source and links it.
4. Aggregators, listicles, and SEO articles — often reworded versions of each other.
5. Social posts and screenshots — untraceable by default.

The level you need depends on the cost of being wrong. A blog post can cite level 3; a
medical claim needs level 1.

## Checks that catch most errors

**Statistics**

- Who counted, over what period, using which definition? "Unemployment fell" depends entirely on who is counted as unemployed.
- Percentage of what? Relative risk versus absolute risk is the most common distortion: "doubles the risk" from 1 in 100,000 to 2 in 100,000 is true and meaningless.
- Is the base rate stated? A 90% accuracy on a 1% prevalence population is mostly false positives.
- Does the number appear in the primary source with the same definition?

**Quotations**

- Find the original text or recording, not another article quoting it. Quote-mining is common.
- Check the surrounding sentences: a clause taken out of a conditional ("if X, then Y") reverses the meaning.
- Verify the attribution separately from the quote. A real quote is frequently attached to the wrong person.

**Dates, names, numbers**

- Check two independent sources, or one authoritative one.
- Distinguish publication date from event date from version release date.

**"Studies show"**

- Which study, how many participants, in what population, published where? If none of that survives the question, delete the phrase.

## Red flags in the source itself

- No author, no date, no link to the primary.
- A precise number with no methodology.
- A dramatic claim in the headline and a cautious one in paragraph nine.
- Screenshots of text as evidence, with no link.
- A study funded by the party that benefits from its conclusion, reported without that disclosure.
- An image or video that could be generated, recycled, or taken out of context.

## Reporting the verification

State per claim:

- **Verified** — with the primary source and what exactly it says.
- **Partially verified** — what part holds and what does not.
- **Unverified** — searched and could not confirm; say where you searched.
- **Contradicted** — with the source that contradicts it.

For anything you could not check, say so in the output rather than dropping it silently. A
claim that quietly disappears reads as verified-by-omission.

## Environment limits

If the network is restricted and primary sources are unreachable, say that explicitly and
downgrade your confidence in the output. Never present a claim as verified when the only
verification available was your own prior belief.
