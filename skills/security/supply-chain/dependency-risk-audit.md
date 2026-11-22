# Dependency Risk Audit

Use when adding a dependency, reviewing a lockfile, or assessing whether a project's
supply chain is safe to build and ship.

## Why this needs measurement, not opinion

Claims about dependencies ("that package is unmaintained", "everyone uses it") are usually
wrong when made from memory. Version numbers, publication dates and advisory ranges change
monthly. Measure, then judge.

## Procedure

### 1. Inventory what is actually installed

Read the lockfile, not the manifest — the manifest states intent, the lockfile states fact.

```bash
# npm: every resolved version, including transitive
npm ls --all
jq -r '.packages | to_entries[] | "\(.key)\t\(.value.version)"' package-lock.json

# Python
pip freeze                      # or: uv pip list
```

Record the direct dependencies separately from the transitive tree: you choose the former,
you inherit the latter.

### 2. Check for known advisories, by exact version

Use the ecosystem's own database rather than memory:

```bash
npm audit --json                # adjudicates against the advisory database
pip-audit                       # PyPI advisories
osv-scanner --lockfile=package-lock.json   # cross-ecosystem, OSV database
```

Every advisory has a range; check whether the installed version is inside it. A report that
says "vulnerable" without the version and the advisory id is not actionable.

### 3. Assess the ones without advisories

An unpatched package is not automatically a risk, and a popular one is not automatically safe.

| Signal | Where to look | Why it matters |
|---|---|---|
| Last publish date | registry page | abandonment vs. stable |
| Maintainer count | registry, repository ACL | single maintainer = single point of compromise |
| Install-time scripts | `package.json` `scripts`, `setup.py` | arbitrary code at install time |
| Release cadence | registry history | frequent unannounced releases raise hijack risk |
| Repository health | issues, recent PRs, CI | a fork with no activity is not maintained |
| Dependency count added | diff of the lockfile | every new package is a new trust decision |

### 4. Rank by reachability

A vulnerable transitive dev-dependency that never runs in production is a different risk
from a vulnerable parser on the request path. Determine whether the affected code path is
actually reachable, and say so in the report.

### 5. Decide

- **Remove** the dependency when the functionality is a few lines of code. The safest dependency is absent.
- **Pin and isolate** for risks you must accept: exact version, no automatic upgrades, and a documented reason.
- **Upgrade** when the fix exists; upgrade to the patched line, not necessarily to the newest major.
- **Reject** a new dependency that brings install scripts, a single unresponsive maintainer, and no clear ownership for something you could implement in 30 lines.

## Adding a new dependency — the checklist

- [ ] Is the functionality genuinely non-trivial? (date maths and CSV escaping are not)
- [ ] License compatible with the project's distribution model
- [ ] No install-time script, or a reviewed one
- [ ] Published recently enough to be maintained, maturely enough to be stable
- [ ] Maintained by more than one person, or by an organisation with a security process
- [ ] Lockfile diff shows only the packages you expected

## Reporting

For each finding: package, installed version, advisory id (or the signal without one),
reachability (production, build, dev), impact, and the chosen action with its cost. Separate
"known advisory" from "judgement call" — mixing them makes the report untrustworthy.

## Limits

Without network access to registries and advisory databases, this audit cannot be performed.
Say that plainly instead of producing a risk assessment from memory. Never state that a
dependency tree is clean unless a scanner actually ran and you read its output.
