# SkillBridge reference library — index

A curated set of operational instructions for LM Arena, organised by domain. Each file is a
complete procedure: when to use it, the method, the failure modes, and how to verify the
result. Nothing here asks the model to "be professional" — every skill names steps,
thresholds and checks.

**40 skills · 13 top-level categories.** Full descriptions and scores: [CATALOG.md](CATALOG.md).
How they were chosen, and what was rejected: [SOURCES.md](SOURCES.md) ·
[CANDIDATES.md](CANDIDATES.md). Sandbox limits every skill assumes:
[LM-ARENA-CONSTRAINTS.md](LM-ARENA-CONSTRAINTS.md).

Names below are the display names LM Arena shows, derived by SkillBridge from the file name.

---

## Start here

Three skills carry the most value because they apply to almost every task and fix the
failure that damages trust most: claiming success without checking.

| Skill | Why it matters | Score |
|---|---|---|
| [Verification Before Completion](CATALOG.md#ai--agents) | Converts "should work" into a command that was actually run | 95 |
| [Systematic Debugging](CATALOG.md#development--debugging) | Stops guess-driven edits; finds the cause before changing code | 95 |
| [Code Review](CATALOG.md#development) | A five-axis review that separates blocking defects from taste | 94 |

---

## By task

### Writing and improving code

| Task | Skill |
|---|---|
| Reviewing a diff or a pull request | `development/code-review.md` |
| Building React components | `development/frontend/react-component-patterns.md` |
| Working in TypeScript | `development/typescript/type-safe-typescript.md` |
| Working in Python | `development/python/idiomatic-python.md` |
| Designing an HTTP API | `development/backend/api-design.md` |
| Designing tables and queries | `development/databases/sql-schema-design.md` |
| Committing, branching, recovering from Git | `development/git/hygienic-git-workflow.md` |

### Testing and debugging

| Task | Skill |
|---|---|
| Driving implementation from tests | `development/testing/test-driven-development.md` |
| Fixing a suite that is shallow or flaky | `development/testing/test-design.md` |
| Something broke and you do not know why | `development/debugging/systematic-debugging.md` |
| Checking unknown feasibility before committing | `research/technical-spike.md` |

### AI systems

| Task | Skill |
|---|---|
| Writing or debugging a prompt | `ai/prompting/prompt-design.md` |
| Defining tools an agent can call | `ai/agents/agent-tool-design.md` |
| Proving that work is actually done | `ai/agents/verification-before-completion.md` |
| Judging output quality, comparing models | `ai/evaluation/llm-output-evaluation.md` |
| Answering from documents (RAG) | `ai/retrieval/rag-context-design.md` |

### Security (defensive)

| Task | Skill |
|---|---|
| Reviewing your own code for abuse paths | `security/application-security/secure-code-review.md` |
| Assessing dependencies and lockfiles | `security/supply-chain/dependency-risk-audit.md` |
| Investigating a Linux host that behaves oddly | `security/systems/linux-incident-triage.md` |

### Thinking and deciding

| Task | Skill |
|---|---|
| A decision with real cost | `analysis/decision-analysis.md` |
| Reasoning that must survive review | `analysis/structured-reasoning.md` |
| Understanding a dataset | `analysis/data/exploratory-data-analysis.md` |
| Interpreting a number or a study | `analysis/data/statistical-literacy.md` |
| Defining a KPI that cannot be gamed | `analysis/data/metric-design.md` |

### Research and evidence

| Task | Skill |
|---|---|
| Checking a claim before repeating it | `research/source-verification.md` |
| "What does the research say?" | `research/literature-search.md` |
| Testing an assumption cheaply | `research/technical-spike.md` |

### Writing and communication

| Task | Skill |
|---|---|
| Documentation, README, design doc | `writing/technical-writing.md` |
| Improving an existing text | `writing/editing-and-revision.md` |
| Checking or producing a translation | `writing/translation-review.md` |
| Justifying technical work for approval | `business/technical-proposal.md` |
| Running a meeting that decides something | `business/meeting-decisions.md` |

### Design and accessibility

| Task | Skill |
|---|---|
| WCAG 2.2 AA audit | `design/accessibility-audit.md` |
| Critiquing an interface | `design/ui-design-review.md` |
| Building or auditing a component library | `design/design-systems.md` |

### Working better

| Task | Skill |
|---|---|
| A task too large for one step | `productivity/planning-and-execution.md` |
| Everything feels urgent | `productivity/focus-and-prioritisation.md` |
| Capturing an investigation or a decision | `productivity/technical-note-taking.md` |
| Checking a product idea before building | `business/product-discovery.md` |
| Teaching a concept | `education/learning-explanation.md` |
| Planning to learn something under a deadline | `education/study-design.md` |

---

## How to combine them

The evidence is clear that stacking many skills makes each one worse. SkillsBench measured
the largest gains at **2–3 skills per task** and declining returns beyond that, so pick the
narrowest set that covers the job.

| Situation | Recommended pair |
|---|---|
| Implement a feature | `test-driven-development` + `code-review` |
| Fix a production bug | `systematic-debugging` + `verification-before-completion` |
| Ship an API | `api-design` + `secure-code-review` |
| Build an LLM feature | `prompt-design` + `llm-output-evaluation` |
| Write documentation | `technical-writing` + `source-verification` |
| Review a dependency update | `dependency-risk-audit` + `code-review` |

---

## Selection criteria, in one paragraph

A skill is included when it changes what the model does on a real task: it encodes
procedural knowledge that does not follow from general competence, it names concrete steps,
thresholds and failure modes, it states how to verify the result, and it is honest about the
constraints of the environment it runs in. Popularity was never used as a criterion — several
of the most-starred collections available today were read, rejected or mined for ideas, and
none is redistributed here. See [SOURCES.md](SOURCES.md) for the full method and the
evaluation ledger.

## Licence and provenance

All 40 skills were written for this library. Sources were read as research material for
techniques and failure modes; no source text is reproduced. Where a method is attributable
to a specific publication, the skill's "Sources" section names it. The library is covered by
the repository's [LICENSE](../LICENSE).
