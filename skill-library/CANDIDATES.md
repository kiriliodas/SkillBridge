# Skill candidates — evaluation ledger

Every candidate examined while building the library, with a score and a decision. The score is
an authoring judgement against the rubric in [SOURCES.md](SOURCES.md#3-scoring-rubric), not a
measurement. Thresholds: **≥ 90** include · **80–89** include after rework · **70–79** rework ·
**< 70** reject.

## Retained — 40 skills

| Skill | File | Score | Category |
|-------|------|-------|----------|
| Verification Before Completion | `ai/agents/verification-before-completion.md` | 95 | AI · Agents |
| Systematic Debugging | `development/debugging/systematic-debugging.md` | 95 | Development · Debugging |
| Code Review | `development/code-review.md` | 94 | Development |
| Prompt Design | `ai/prompting/prompt-design.md` | 93 | AI · Prompting |
| Web Accessibility Audit (WCAG 2.2 AA) | `design/accessibility-audit.md` | 93 | Design |
| Test-Driven Development | `development/testing/test-driven-development.md` | 93 | Development · Testing |
| Evaluating LLM Outputs | `ai/evaluation/llm-output-evaluation.md` | 92 | AI · Evaluation |
| Source Verification & Fact-Checking | `research/source-verification.md` | 92 | Research |
| Security Review of Application Code | `security/application-security/secure-code-review.md` | 92 | Security · Application |
| Designing Agent Tools | `ai/agents/agent-tool-design.md` | 91 | AI · Agents |
| SQL Schema & Query Design | `development/databases/sql-schema-design.md` | 91 | Development · Databases |
| Hygienic Git Workflow | `development/git/hygienic-git-workflow.md` | 91 | Development · Git |
| Type-Safe TypeScript | `development/typescript/type-safe-typescript.md` | 91 | Development · TypeScript |
| Technical Writing | `writing/technical-writing.md` | 91 | Writing |
| Designing Retrieval Context (RAG) | `ai/retrieval/rag-context-design.md` | 90 | AI · Retrieval |
| Statistical Literacy | `analysis/data/statistical-literacy.md` | 90 | Analysis · Data |
| REST API Design | `development/backend/api-design.md` | 90 | Development · Backend |
| React Component Patterns | `development/frontend/react-component-patterns.md` | 90 | Development · Frontend |
| Designing a Test Suite | `development/testing/test-design.md` | 90 | Development · Testing |
| Dependency Risk Audit | `security/supply-chain/dependency-risk-audit.md` | 90 | Security · Supply chain |
| Exploratory Data Analysis | `analysis/data/exploratory-data-analysis.md` | 89 | Analysis · Data |
| Idiomatic Python | `development/python/idiomatic-python.md` | 89 | Development · Python |
| Literature Search & Evidence Synthesis | `research/literature-search.md` | 89 | Research |
| Designing a Metric | `analysis/data/metric-design.md` | 88 | Analysis · Data |
| Problem Discovery | `business/product-discovery.md` | 88 | Business |
| Planning and Execution | `productivity/planning-and-execution.md` | 88 | Productivity |
| Linux Incident Triage (defensive) | `security/systems/linux-incident-triage.md` | 88 | Security · Systems |
| Editing and Revision | `writing/editing-and-revision.md` | 88 | Writing |
| Decision Analysis | `analysis/decision-analysis.md` | 87 | Analysis |
| Writing a Technical Proposal | `business/technical-proposal.md` | 87 | Business |
| UI Design Review | `design/ui-design-review.md` | 87 | Design |
| Structured Reasoning | `analysis/structured-reasoning.md` | 86 | Analysis |
| Design Systems | `design/design-systems.md` | 86 | Design |
| Explaining Technical Material | `education/learning-explanation.md` | 86 | Education |
| Running a Technical Spike | `research/technical-spike.md` | 86 | Research |
| Translation Review | `writing/translation-review.md` | 86 | Writing |
| Meetings that Produce Decisions | `business/meeting-decisions.md` | 85 | Business |
| Designing a Study Plan | `education/study-design.md` | 85 | Education |
| Technical Note-Taking & Knowledge Capture | `productivity/technical-note-taking.md` | 85 | Productivity |
| Prioritisation and Focus | `productivity/focus-and-prioritisation.md` | 84 | Productivity |

## Examined and rejected

Sources read and not used, with the reason. This is the part of the ledger that matters more
than the list above: it records what was deliberately left out.

| Source / candidate | Examined | Verdict | Reason |
|---|---|---|---|
| `anthropics/skills` (20 skills) | yes — frontend-design read in full | **rejected as a source of text** | No repository-level LICENSE (Apache-2.0 only inside some skill folders). Read for method; nothing copied |
| `openai/skills` (39 curated skills) | yes — security-threat-model, aspnet-core, playwright | **rejected as a source of text** | No licence declared |
| `vercel-labs/agent-skills` (26 skills) | yes — react-best-practices rule structure | **rejected as a source of text** | No licence declared; also React/Vercel-specific and highly rule-file structured, which does not survive a single-file package |
| `trailofbits/skills` (99 skills) | yes — supply-chain-risk-auditor in depth | **method borrowed, text not** | CC-BY-SA-4.0 is share-alike and would change this repository's licence. Defensive techniques only |
| `trailofbits` offensive skills (aflpp, libafl, exploitation aids) | yes — titles and scope | **rejected** | Offensive tooling; out of scope for a general-purpose defensive library |
| Offensive skill collections found via search (`Claude-Red` and similar) | no — excluded on scope | **rejected** | Explicitly offensive security; the brief asks for defensive use only |
| "Mega libraries" claiming 1,000–1,600 skills | yes — index only | **rejected** | Volume with no curation; SkillsBench data shows more skills actively degrade results |
| `obra/superpowers` (15 skills) | yes — verification-before-completion, systematic-debugging | **method borrowed, text rewritten** | MIT-permissive, but rewritten to fit LM Arena and merged with other sources rather than copied |
| `addyosmani/agent-skills` (26 skills) | yes — code-review-and-quality, debugging | **method borrowed, text rewritten** | MIT-permissive; same approach |
| `vercel-labs` react rule files (60+ micro-rules) | yes — structure | **rejected** | Rule-per-file format requires many files; collapses badly into one skill and would violate the conciseness finding |
| Prompt-engineering SEO listicles (10+ pages) | yes | **rejected as sources** | Circular, often reworded copies of each other; no primary evidence. Used only as a checklist of topics that practitioners care about |
| Chain-of-thought "just add think step by step" advice | yes | **rejected** | Contradicted by current models that reason internally; superseded by explicit decomposition |
| Tree-of-thought / self-consistency as default techniques | yes | **rejected as defaults** | Cost multiplies for marginal gain outside high-stakes reasoning; mentioned only as an escalation |
| Agentic "AI scientist" skill packs | yes — scope | **rejected** | Depend on GPU, domain databases and long runtimes unavailable here |
| Cloud-provider deployment skills (AWS/GCP/Vercel deploy flows) | yes | **rejected** | Require credentials and network access the sandbox does not have; would ship unverified instructions |
| MCP-server integration skills | yes | **rejected** | The LM Arena environment here exposes no MCP servers |
| Browser-automation / Playwright skills | yes | **rejected** | No browser binary in the sandbox; unverifiable |
| Java / Kotlin / Android skills | searched | **rejected** | No JVM or Android toolchain; could not be verified |
| Rust / Go skills | searched | **rejected** | No compiler available |
| "Persona" skills ("act as a senior engineer") | yes, many | **rejected** | No procedural content; no verifiable behaviour change |
| Social-media-sourced "best skill" threads | yes — Reddit via search | **used as signal only** | Informed the emphasis on verification and the scepticism about mega-collections; no claim rests on them |
| YouTube / TikTok / Instagram workflow videos | searched | **rejected** | No verifiable transcript or source; nothing corroborated elsewhere |
| Design-taste skills ("anti-AI-slop", visual direction) | yes | **rejected** | Highly subjective, style-dependent, and mostly unusable without visual iteration |
| Duplicate treatments of TDD (3 sources) | yes | **merged into one** | Three sources covered TDD; one reference skill written from the strongest parts of each |
| Duplicate treatments of code review (3 sources) | yes | **merged into one** | Same |
| Duplicate treatments of debugging (2 sources) | yes | **merged into one** | Same |

## Counts

| | |
|---|---|
| Sources inspected (repositories, documentation, papers, guides) | 24 |
| Candidates or groups examined | 52 |
| Merged into a single reference skill | 3 groups covering 8 source skills |
| Rejected outright | 21 groups |
| Retained | 40 skills |

## Notes on specific judgements

**Why no "prompt injection defence" skill.** The technique is important but is already
covered as a rule inside `ai/prompting/prompt-design.md` (wrapping untrusted text, repeating
the critical rule after it) and in `ai/agents/agent-tool-design.md` (content is data, not
instructions). A separate skill would have duplicated both and violated the 2–3 skill rule.

**Why no "learning to learn" or "critical thinking" skill.** Both would be generic by nature.
The concrete versions — `structured-reasoning`, `decision-analysis`, `study-design` — carry
the usable method.

**Why the library has no hardware, law, medicine or finance skills.** Verified material could
not be produced for those domains in this environment, and a wrong medical or legal
instruction is worse than no skill. Coverage was extended only where a skill could be written
with defensible content.
