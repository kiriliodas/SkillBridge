# LM Arena sandbox — measured constraints

Every number below was **measured in the sandbox that built this library**, not copied from
documentation. Where a claim could not be verified, it says so. Re-measure anything that a
skill depends on: images change and results from one session are not a guarantee for the next.

Measured on: Debian 12 (bookworm), kernel 6.1, 2 vCPU (Xeon @ 2.60 GHz), 3.9 GB RAM,
21 GB disk. Date: 2026-11-21.

---

## Verified by measurement

### Compute and storage

| Limit | Measured value | How it was measured |
|---|---|---|
| Disk | 21 GB total, 20 GB free, 1% inodes used | `df -h`, `df -i` |
| Memory | 3.9 GB total; a 500 MB allocation succeeded (peak RSS 507 MB) | `free -m`, `bytearray(500 MB)` |
| CPU | 2 cores | `nproc` |
| Write throughput | ~1.0 GB/s to `/tmp` (200 MB in 0.21 s) | `dd` |
| Files | 10,500 small files created in under a second, no limit hit | loop creating files in `/tmp` |
| Large tree traversal | 20,000 files: `find` 15 ms, `rg` 125 ms | timed runs |

The platform documents a **128 MB / 10,000 file** budget for the persisted workspace. Those
limits were not probed to the breaking point (that would risk the workspace); the local
filesystem is not the binding constraint — the snapshot budget is.

### Runtimes

| Tool | Version | Notes |
|---|---|---|
| Node.js | 22.22.3 | `node`, `npm`, `npx` all present |
| Python | 3.11.2 | `pip` 23.0.1; PEP 668 blocks system installs by default |
| GCC / G++ | 12.2.0 | `make` 4.3 present |
| Git | 2.39.5 | `gh` 2.23.0 also installed |

**Absent and not installable from the allowed hosts:** Java, Kotlin, Gradle, Go, Rust,
Cargo, .NET, Ruby, PHP, CMake, `sqlite3` CLI, PostgreSQL/MySQL clients, any browser
(Chromium, Chrome, Firefox), Playwright, Firefox/Chromium binaries, `file`, `xxd`, `bc`,
`7z`, `fd`.

Consequence for skills: **no JVM, no Android toolchain, no Rust/Go compiler, and no browser
automation** unless the session installs them from the approved hosts — which is not
guaranteed. A skill that requires one of these must declare the prerequisite and offer a
non-executable path instead of pretending to run it.

### Package installation

| Channel | Result |
|---|---|
| `npm install` from the public registry | works (verified with a real package install) |
| `pip install` into a venv | works (verified with `python3 -m venv` + install) |
| `pip install` system-wide | blocked by PEP 668 unless `--break-system-packages` is passed |
| Python stdlib | complete for `sqlite3`, `ssl`, `zipfile`, `tarfile`, `unittest`, `csv`, `json`, `statistics`, `venv`; **`tkinter` absent** |
| Scientific stack | numpy, pandas, matplotlib, scipy, scikit-learn, pytest, requests are **not preinstalled**; they install from PyPI when the index is reachable |

### Network

| Host | Reachable | Notes |
|---|---|---|
| `github.com`, `api.github.com` | yes | GitHub API usable for metadata and file contents |
| `codeload.github.com` | yes | archive downloads |
| `registry.npmjs.org` | yes | npm install works |
| `pypi.org`, `files.pythonhosted.org` | yes | pip install works |
| `raw.githubusercontent.com` | **no** | blocked; fetch file content through `api.github.com` + base64 instead |
| `reddit.com`, `news.ycombinator.com`, `arxiv.org`, `google.com` | **no** | blocked for direct HTTP |
| Any other host | no | curl to an unlisted host returns no response |

Two consequences that matter for skills:

1. **Direct HTTP is allowlisted.** A skill must not assume arbitrary web access. When a
   source is unreachable, the correct behaviour is to say so, not to reconstruct the content
   from memory.
2. **Node's `fetch` fails on some allowed hosts** (`api.github.com`, `github.com`) with a TLS
   error, while `curl` succeeds to the same host. Disabling TLS verification makes Node's
   `fetch` work, confirming a certificate-chain issue rather than a network block. Skills that
   download data should prefer `curl` and verify the result with `python3`/`node` parsing.

### Archives

`zip`, `unzip`, `tar`, `gzip`, `xz` are present. `7z` is not measured (absent).

---

## Assuming a guarantee

These are properties of the platform that were observed but not stress-tested:

- **Persistence.** Files inside the workspace directory survive between turns of one session. A sandbox reset wipes `node_modules`, build output and other excluded directories (`dist`, `release`, caches); the tracked source persists because it is in Git.
- **Process lifetime.** Long-running servers started as background processes stay up for the session, not forever.
- **Nothing outside the workspace is persisted.** Files written to `/tmp` are usable during the session and are gone after it.

## How the skills in this library adapt

| Constraint | Adaptation used in the skills |
|---|---|
| No browser | Accessibility and UI skills specify manual checks to be *reported as not performed*, never simulated |
| No Java/Kotlin/Android | No such skill is included: it could not be verified here |
| Allowlisted network | Verification skills tell the model to state which source was unreachable |
| No database server | SQL skill teaches plan reading and schema design, and says to label unexecuted queries as unverified |
| RAM ~4 GB | Data skills prefer streaming and bounded reads over loading everything |
| No scientific Python preinstalled | Data skills fall back to stdlib (`csv`, `statistics`, `sqlite3`) and say when a library is missing |
| Workspace budget (128 MB / 10k files) | Skills avoid generating large artifacts; this library is under 200 KB of Markdown |

## What could not be verified

- The **128 MB / 10,000 file** platform budget: not pushed to its limit.
- **LM Arena itself** (`arena.ai`, `lmarena.ai`): unreachable from the sandbox. Any claim
  about the live interface in this library would be unverifiable and is therefore not made.
- **Concurrency and CPU quotas** under sustained load: not measured. Timings above are idle-sandbox figures.
- **Persistence across separate sessions**: only observed within a session.
