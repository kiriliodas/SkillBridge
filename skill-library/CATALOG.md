# Skill catalogue

Every skill in this library, with its score and the reason it exists. The score is an
authoring judgement against the rubric in [SOURCES.md](SOURCES.md#3-scoring-rubric), not a
benchmark result. Paths are relative to the repository root.

**40 skills · 24,362 words · 144 KB of Markdown.**

The name below is the one LM Arena displays, derived by SkillBridge from the file name
(`api-design.md` → *API Design*). Each file's H1 matches it, so the compiled package and
the installation prompt agree.

| Score band | Skills |
|------------|--------|
| 95–100 | 2 |
| 90–94 | 18 |
| 85–89 | 19 |
| 80–84 | 1 |

## By category

### AI · Agents

| Skill | File | Score | When to use it |
|-------|------|-------|----------------|
| **Verification Before Completion** | `ai/agents/verification-before-completion.md` | 95 | Use before claiming that any work is done, fixed, passing or working — in a code task, a document, an analysis or an answer. |
| **Agent Tool Design** | `ai/agents/agent-tool-design.md` | 91 | Use when defining the tools an agent can call, diagnosing an agent that picks the wrong tool, or making an agent reliable across many steps. |

### AI · Evaluation

| Skill | File | Score | When to use it |
|-------|------|-------|----------------|
| **LLM Output Evaluation** | `ai/evaluation/llm-output-evaluation.md` | 92 | Use when you must judge whether an LLM output is good, compare two prompts or models, or build a repeatable check instead of an opinion. |

### AI · Prompting

| Skill | File | Score | When to use it |
|-------|------|-------|----------------|
| **Prompt Design** | `ai/prompting/prompt-design.md` | 93 | Use when writing or debugging a prompt for an LLM: building a system prompt, turning a one-off request into a reusable template, or fixing output that is unreliable. |

### AI · Retrieval

| Skill | File | Score | When to use it |
|-------|------|-------|----------------|
| **RAG Context Design** | `ai/retrieval/rag-context-design.md` | 90 | Use when building or debugging a system that answers from retrieved documents, or when an assistant with documents in context still answers wrongly. |

### Analysis

| Skill | File | Score | When to use it |
|-------|------|-------|----------------|
| **Decision Analysis** | `analysis/decision-analysis.md` | 87 | Use to choose between options under uncertainty where the choice matters and is hard to reverse — architecture, hiring, vendor selection, prioritisation. |
| **Structured Reasoning** | `analysis/structured-reasoning.md` | 86 | Use for problems where a wrong conclusion has real cost: decisions with trade-offs, diagnoses, quantitative estimates, arguments that must hold under scrutiny. |

### Analysis · Data

| Skill | File | Score | When to use it |
|-------|------|-------|----------------|
| **Statistical Literacy** | `analysis/data/statistical-literacy.md` | 90 | Use when interpreting a number, a study, a test result or a chart — yours or someone else's — and to avoid the standard errors that make quantitative claims wrong. |
| **Exploratory Data Analysis** | `analysis/data/exploratory-data-analysis.md` | 89 | Use to understand a dataset before modelling, before reporting, or when asked "what does this data say" and the answer is not yet obvious. |
| **Metric Design** | `analysis/data/metric-design.md` | 88 | Use when defining a KPI, instrumenting a feature, or judging whether a reported number means what its label claims. |

### Business

| Skill | File | Score | When to use it |
|-------|------|-------|----------------|
| **Product Discovery** | `business/product-discovery.md` | 88 | Use before building: to check that the problem is real, who has it, and whether the proposed solution addresses it. |
| **Technical Proposal** | `business/technical-proposal.md` | 87 | Use to justify a piece of technical work before it is approved: a migration, a new service, a rewrite, an infrastructure investment. |
| **Meeting Decisions** | `business/meeting-decisions.md` | 85 | Use to prepare, run or summarise a working meeting where something must be decided or unblocked. |

### Design

| Skill | File | Score | When to use it |
|-------|------|-------|----------------|
| **Accessibility Audit** | `design/accessibility-audit.md` | 93 | Use to check whether a web interface can be used by people with disabilities, and to report findings that a developer can act on. |
| **UI Design Review** | `design/ui-design-review.md` | 87 | Use to critique an interface — a mockup, a screenshot, a live page — and produce feedback that improves it rather than a list of personal preferences. |
| **Design Systems** | `design/design-systems.md` | 86 | Use when building or auditing a shared component library, or when interface inconsistency is slowing a team down. |

### Development

| Skill | File | Score | When to use it |
|-------|------|-------|----------------|
| **Code Review** | `development/code-review.md` | 94 | Use when reviewing a diff, a pull request, or your own changes before committing, and when asked to assess code quality. |

### Development · Backend

| Skill | File | Score | When to use it |
|-------|------|-------|----------------|
| **API Design** | `development/backend/api-design.md` | 90 | Use when designing HTTP endpoints, reviewing an API surface, or deciding how a client and server should exchange data. |

### Development · Databases

| Skill | File | Score | When to use it |
|-------|------|-------|----------------|
| **SQL Schema Design** | `development/databases/sql-schema-design.md` | 91 | Use when designing tables, writing queries that must scale, reviewing a migration, or diagnosing slow reads. |

### Development · Debugging

| Skill | File | Score | When to use it |
|-------|------|-------|----------------|
| **Systematic Debugging** | `development/debugging/systematic-debugging.md` | 95 | Use when a test fails, a build breaks, behaviour contradicts expectations, or something that worked before stopped working. Use it before making any speculative change. |

### Development · Frontend

| Skill | File | Score | When to use it |
|-------|------|-------|----------------|
| **React Component Patterns** | `development/frontend/react-component-patterns.md` | 90 | Use when building or reviewing React components: choosing composition over configuration, deciding where state lives, and keeping components testable. |

### Development · Git

| Skill | File | Score | When to use it |
|-------|------|-------|----------------|
| **Hygienic Git Workflow** | `development/git/hygienic-git-workflow.md` | 91 | Use when committing, branching, preparing a pull request, resolving a conflict, or recovering from a Git mistake. |

### Development · Python

| Skill | File | Score | When to use it |
|-------|------|-------|----------------|
| **Idiomatic Python** | `development/python/idiomatic-python.md` | 89 | Use when writing or reviewing Python that must be readable, correct under mutation, and maintainable across versions. |

### Development · Testing

| Skill | File | Score | When to use it |
|-------|------|-------|----------------|
| **Test Driven Development** | `development/testing/test-driven-development.md` | 93 | Use when implementing behaviour that has a clear expected outcome, when fixing a bug, or when the user asks for tests first. Do not use it for exploratory spikes or pure refactors that… |
| **Test Design** | `development/testing/test-design.md` | 90 | Use when a suite is slow, flaky, or too shallow to catch regressions; or when adding tests to a codebase that has few. |

### Development · TypeScript

| Skill | File | Score | When to use it |
|-------|------|-------|----------------|
| **Type Safe Typescript** | `development/typescript/type-safe-typescript.md` | 91 | Use when writing TypeScript that must stay correct as it evolves, when a type error is being silenced, or when designing the types of a shared module. |

### Education

| Skill | File | Score | When to use it |
|-------|------|-------|----------------|
| **Learning Explanation** | `education/learning-explanation.md` | 86 | Use when teaching a concept, writing an explainer, onboarding someone, or answering a question that reveals a missing piece of understanding. |
| **Study Design** | `education/study-design.md` | 85 | Use to plan learning a skill or a body of knowledge under a real time constraint, or to help someone who is studying inefficiently. |

### Productivity

| Skill | File | Score | When to use it |
|-------|------|-------|----------------|
| **Planning And Execution** | `productivity/planning-and-execution.md` | 88 | Use when a task is too large for one step, when progress stalls, or when asked for a plan. |
| **Technical Note Taking** | `productivity/technical-note-taking.md` | 85 | Use when documenting an investigation, capturing decisions from a meeting or a session, or building a knowledge base that stays useful months later. |
| **Focus And Prioritisation** | `productivity/focus-and-prioritisation.md` | 84 | Use when everything seems urgent, when a backlog needs ordering, or when deciding what to do next in a session with limited time. |

### Research

| Skill | File | Score | When to use it |
|-------|------|-------|----------------|
| **Source Verification** | `research/source-verification.md` | 92 | Use before repeating a claim: a statistic, a quotation, a date, an attribution, a "studies show", a version number, a price. |
| **Literature Search** | `research/literature-search.md` | 89 | Use when answering a question that depends on what is actually known — a scientific or technical claim, a "what does the research say" request, a review of prior work. |
| **Technical Spike** | `research/technical-spike.md` | 86 | Use when a decision depends on unknown feasibility: an unfamiliar API, a performance target, a library that may not support the requirement. |

### Security · Application

| Skill | File | Score | When to use it |
|-------|------|-------|----------------|
| **Secure Code Review** | `security/application-security/secure-code-review.md` | 92 | Use for a defensive review of code you own or are authorised to assess: finding how it can be abused before someone else does. Not for offensive work, and not for systems you have no… |

### Security · Supply chain

| Skill | File | Score | When to use it |
|-------|------|-------|----------------|
| **Dependency Risk Audit** | `security/supply-chain/dependency-risk-audit.md` | 90 | Use when adding a dependency, reviewing a lockfile, or assessing whether a project's supply chain is safe to build and ship. |

### Security · Systems

| Skill | File | Score | When to use it |
|-------|------|-------|----------------|
| **Linux Incident Triage** | `security/systems/linux-incident-triage.md` | 88 | Use to investigate a Linux host that is behaving abnormally — unexplained CPU, unexpected network connections, a suspected compromise — on systems you own or administer. |

### Writing

| Skill | File | Score | When to use it |
|-------|------|-------|----------------|
| **Technical Writing** | `writing/technical-writing.md` | 91 | Use for documentation, READMEs, API references, design documents, runbooks and any prose whose reader needs to act on it. |
| **Editing And Revision** | `writing/editing-and-revision.md` | 88 | Use to improve an existing text — a draft, an email, a report, a translated text — without losing the author's voice or the facts. |
| **Translation Review** | `writing/translation-review.md` | 86 | Use to check or improve a translation, or to translate technical and professional text while preserving meaning, terminology and register. |

## Full list, by path

| # | File | Skill | Words |
|---|------|-------|-------|
| 1 | `ai/agents/agent-tool-design.md` | Agent Tool Design | 621 |
| 2 | `ai/agents/verification-before-completion.md` | Verification Before Completion | 610 |
| 3 | `ai/evaluation/llm-output-evaluation.md` | LLM Output Evaluation | 736 |
| 4 | `ai/prompting/prompt-design.md` | Prompt Design | 877 |
| 5 | `ai/retrieval/rag-context-design.md` | RAG Context Design | 634 |
| 6 | `analysis/data/exploratory-data-analysis.md` | Exploratory Data Analysis | 618 |
| 7 | `analysis/data/metric-design.md` | Metric Design | 505 |
| 8 | `analysis/data/statistical-literacy.md` | Statistical Literacy | 609 |
| 9 | `analysis/decision-analysis.md` | Decision Analysis | 601 |
| 10 | `analysis/structured-reasoning.md` | Structured Reasoning | 642 |
| 11 | `business/meeting-decisions.md` | Meeting Decisions | 525 |
| 12 | `business/product-discovery.md` | Product Discovery | 565 |
| 13 | `business/technical-proposal.md` | Technical Proposal | 577 |
| 14 | `design/accessibility-audit.md` | Accessibility Audit | 719 |
| 15 | `design/design-systems.md` | Design Systems | 597 |
| 16 | `design/ui-design-review.md` | UI Design Review | 599 |
| 17 | `development/backend/api-design.md` | API Design | 746 |
| 18 | `development/code-review.md` | Code Review | 640 |
| 19 | `development/databases/sql-schema-design.md` | SQL Schema Design | 692 |
| 20 | `development/debugging/systematic-debugging.md` | Systematic Debugging | 603 |
| 21 | `development/frontend/react-component-patterns.md` | React Component Patterns | 641 |
| 22 | `development/git/hygienic-git-workflow.md` | Hygienic Git Workflow | 583 |
| 23 | `development/python/idiomatic-python.md` | Idiomatic Python | 568 |
| 24 | `development/testing/test-design.md` | Test Design | 589 |
| 25 | `development/testing/test-driven-development.md` | Test Driven Development | 657 |
| 26 | `development/typescript/type-safe-typescript.md` | Type Safe Typescript | 596 |
| 27 | `education/learning-explanation.md` | Learning Explanation | 578 |
| 28 | `education/study-design.md` | Study Design | 530 |
| 29 | `productivity/focus-and-prioritisation.md` | Focus And Prioritisation | 542 |
| 30 | `productivity/planning-and-execution.md` | Planning And Execution | 599 |
| 31 | `productivity/technical-note-taking.md` | Technical Note Taking | 510 |
| 32 | `research/literature-search.md` | Literature Search | 583 |
| 33 | `research/source-verification.md` | Source Verification | 566 |
| 34 | `research/technical-spike.md` | Technical Spike | 407 |
| 35 | `security/application-security/secure-code-review.md` | Secure Code Review | 652 |
| 36 | `security/supply-chain/dependency-risk-audit.md` | Dependency Risk Audit | 617 |
| 37 | `security/systems/linux-incident-triage.md` | Linux Incident Triage | 650 |
| 38 | `writing/editing-and-revision.md` | Editing And Revision | 563 |
| 39 | `writing/technical-writing.md` | Technical Writing | 668 |
| 40 | `writing/translation-review.md` | Translation Review | 547 |

