# Sources, method and selection

How this library was built, what was read, what was rejected, and on what basis. Written so
that a reader can challenge the selection rather than take it on trust.

---

## 1. What was searched

| Source type | What was used | Access in this environment |
|---|---|---|
| GitHub repositories | `anthropics/skills`, `addyosmani/agent-skills`, `obra/superpowers`, `openai/skills`, `trailofbits/skills`, `vercel-labs/agent-skills`, `anthropics/claude-cookbooks` | reachable via `api.github.com` (metadata and file contents) |
| Official documentation | Anthropic Agent Skills authoring guide, Claude Platform docs | reachable through the search/fetch tooling |
| Research literature | SkillsBench (arXiv 2602.12670), RAG survey (MDPI 2024), WCAG 2.2, PRISMA 2020 | abstracts, PDFs and secondary summaries |
| Community discussion | r/ClaudeAI and r/claude threads on what skills actually help | through search results only |
| Technical blogs and guides | prompt-engineering guides, LLM-evaluation guides, RAG practitioner posts, accessibility checklists | search results |
| Reddit / X / YouTube / TikTok / Instagram | searched; **direct access blocked** in this sandbox | see the honesty note below |

**Honesty note on social sources.** Reddit, X, YouTube, TikTok and Instagram could not be
fetched directly (all returned no response). Reddit content was available through web-search
results and informed two decisions: the emphasis on verification skills, and the scepticism
about large skill collections. No claim in this library rests on a social-media source that
could not be corroborated elsewhere. YouTube, TikTok and Instagram produced no verifiable
material that survived source checking, so nothing from them was used.

## 2. The evidence that shaped the whole library

*SkillsBench: Benchmarking How Well Agent Skills Work Across Diverse Tasks* (Li et al., 2026;
84 tasks, 11 domains, 7 model–harness pairs, 7,308 trajectories) reported four findings that
directly contradict common practice:

| Finding | Consequence for this library |
|---|---|
| Curated skills improve pass rate by **+16.2 pp** on average, but **16 of 84 tasks got worse** | A skill can hurt. Do not apply one without checking that the task is in its domain |
| **2–3 skills per task** is optimal; 4+ gives +5.9 pp against +18.6 pp | The index recommends pairs, not stacks |
| **Compact and detailed** skills beat "comprehensive" documentation, which scored **negative** | Every skill here is narrow; none tries to be a manual |
| **Self-generated** skills give **no benefit** on average (−1.3 pp) | Each skill encodes knowledge that is not re-derivable from the task itself |

This is why the library contains 40 focused skills rather than 300, why each is one topic, and
why the index explicitly warns against loading many at once.

## 3. Scoring rubric

Each candidate was scored out of 100. The weights reflect what makes a skill *change
behaviour* rather than *read well*:

| Criterion | Weight | What a high score requires |
|---|---|---|
| Utility | 25 | Addresses a real task where the model's default output is measurably worse |
| Precision | 20 | Concrete steps, thresholds, named failure modes — not adjectives |
| Reliability | 20 | Method is defensible and current; no deprecated or unsafe advice |
| Completeness | 10 | Covers the decisions the user will actually face |
| Actionability | 10 | Can be applied immediately in an LM Arena conversation |
| Originality | 5 | Adds something beyond general knowledge |
| LM Arena fit | 5 | Works without tools the sandbox lacks, or states the prerequisite |
| Maintenance | 5 | Not tied to a version or a trend that expires in months |

Thresholds: **≥ 90** include · **80–89** include after rework · **70–79** rework ·
**< 70** reject.

The scores in [CATALOG.md](CATALOG.md) are authoring judgements, not measurements. No skill
here was benchmarked; claiming otherwise would repeat exactly the error the rubric penalises.

## 4. What was examined and rejected

Full ledger with per-item reasoning: [CANDIDATES.md](CANDIDATES.md). The categories of
rejection are more informative than the individual verdicts.

**Rejected — prompt-injection and unsafe content.** Collections that ship instructions to
bypass safety controls, exfiltrate data, or persuade the model that its rules do not apply.
Treated as hostile input, not as sources.

**Rejected — offensive security.** Several repositories publish offensive skill libraries
(exploit development, evasion, credential dumping). Excluded entirely: the brief asks for
defensive use, and shipping attack tooling in a library meant for general use is a liability.

**Rejected — vendor lock-in.** Skills that only work with one proprietary IDE or one agent
harness, or that require a paid plugin.

**Rejected — "be smart" skills.** Files whose body is a list of adjectives ("be thorough",
"think like an expert"). Zero procedural content, zero verifiable behaviour change.

**Rejected — duplicates.** Multiple sources cover TDD, code review and debugging. Rather than
ship three versions, one reference skill per topic was written, keeping the strongest ideas
from each and dropping the overlap. This is documented in [CANDIDATES.md](CANDIDATES.md).

**Rejected — unverified technical claims.** Skills that assert version-specific behaviour
which could not be checked here (Java/Kotlin/Android toolchains, cloud-specific deployment
flows). Including them would have meant shipping unverified instructions.

**Rejected — tool-dependent workflows.** Skills built around MCP servers, browser automation
or SDKs that do not exist in this sandbox. A skill that cannot run in the target environment
is a liability, not an asset.

### Licence findings — a reason the library contains no copied text

| Repository | Licence | Consequence |
|---|---|---|
| `anthropics/skills` | **no repository-level LICENSE**; Apache-2.0 in some skill folders | cannot be redistributed wholesale; read for method only |
| `openai/skills` | no licence declared | same |
| `vercel-labs/agent-skills` | no licence declared | same |
| `addyosmani/agent-skills` | MIT | reusable with attribution; used as a comparison point |
| `obra/superpowers` | MIT | reusable with attribution |
| `trailofbits/skills` | CC-BY-SA-4.0 | share-alike would contaminate the repository licence |

Because three of the most relevant collections carry **no licence at all**, copying from them
would have been a rights problem. Every skill in this library was therefore written from
scratch, using the sources as research material for techniques and failure modes. This is both
the legally safe and the better editorial choice: it allowed merging the strongest ideas from
several sources instead of choosing one.

## 5. What was genuinely taken from where

| Contribution | Source | How it appears here |
|---|---|---|
| Skills are most useful for procedural, verifiable work; compact beats comprehensive | SkillsBench | the whole structure, the index's 2–3 pairing rule |
| "Evidence before claims" as an explicit gate with a claim→evidence table | `obra/superpowers` (`verification-before-completion`) | `ai/agents/verification-before-completion.md`, extended with a reporting format |
| Multi-axis review and the "approve if it improves the code" standard | `addyosmani/agent-skills` (`code-review-and-quality`) | `development/code-review.md`, with concrete signals added |
| Stop-the-line triage and preserve-evidence discipline | `obra/superpowers` (`systematic-debugging`), `addyosmani` (`debugging-and-error-recovery`) | `development/debugging/systematic-debugging.md` |
| Measure rather than recall dependency facts; "unavailable data is never evidence of risk" | `trailofbits/skills` (`supply-chain-risk-auditor`) | `security/supply-chain/dependency-risk-audit.md` |
| Repository-grounded threat modelling, explicit assumptions, avoid inflated severity | `openai/skills` (`security-threat-model`) | `security/application-security/secure-code-review.md` |
| Description-as-routing, degrees of freedom by task fragility, keep the body short | Anthropic Agent Skills authoring guide | every skill's opening "Use when…" line and its length discipline |
| Judge biases (verbosity, position, self-preference) and validator-against-humans step | LLM-as-judge practitioner literature | `ai/evaluation/llm-output-evaluation.md` |
| Chunk by structure, hybrid retrieval, rerank, ground with citations | RAG practitioner guides and the 2024 RAG survey | `ai/retrieval/rag-context-design.md` |
| WCAG 2.2 new criteria (focus not obscured, target size 24 px, dragging alternatives) | WCAG 2.2 / practitioner checklists | `design/accessibility-audit.md` |
| Two-pass screening, eligibility criteria fixed in advance, recorded search strategy | PRISMA 2020 | `research/literature-search.md` |
| Retrieval practice over re-reading; spacing and interleaving | cognitive-science literature summarised in education guides | `education/study-design.md` |

No source text was copied. Where a method has a clear origin, the skill names it in its own
"Sources" line.

## 6. Known weaknesses of this library

- **Scores are judgements.** They signal relative confidence, not measured effect.
- **Domain coverage is uneven by design.** Software and AI are dense; hardware, law, medicine
  and finance are absent because verified material could not be produced here.
- **Version drift.** Skills avoid version-specific claims where possible, but React, Python and
  TypeScript advice assumes recent stable releases. Re-check before relying on a detail.
- **No live validation.** No skill here was tested against LM Arena, because the interface is
  unreachable from the sandbox. Effectiveness claims are inferred from the benchmark and from
  the internal logic of each skill, not observed.
