# Idiomatic Python

Use when writing or reviewing Python that must be readable, correct under mutation, and
maintainable across versions.

## Baseline

- Target the version the project declares; do not assume the newest features. Check `python --version` and `pyproject.toml` before using `match`, `tomllib`, or `X | Y` annotations evaluated at runtime.
- Follow PEP 8 mechanically and stop arguing about it: 4-space indents, `snake_case` functions and variables, `PascalCase` classes, `UPPER_CASE` module constants.
- One module, one responsibility. A 2,000-line `utils.py` is a design smell, not a utility.

## The mutable-default trap

```python
def add(item, bucket=[]):      # the same list is reused across every call
def add(item, bucket=None):    # correct
    bucket = [] if bucket is None else bucket
```

The same trap exists for dataclass fields (`field(default_factory=list)`), class
attributes, and module-level caches. Any default evaluated once at definition time is shared.

## Comprehensions, generators, and when not to

- A comprehension that fits on two lines is clearer than the loop; one that needs three clauses and a nested condition is not.
- Use a generator when the sequence is large or consumed once: `sum(x*x for x in data)` never builds the list.
- Do not mutate a list while iterating it. Iterate a copy, or build a new list.
- `dict.setdefault`, `collections.defaultdict`, `collections.Counter` and `itertools` remove most index-juggling loops.

## Errors

- Catch the narrowest exception that you can actually handle. `except Exception: pass` hides bugs, including the ones you will need later.
- Re-raise with context: `raise ConfigError(path) from exc` preserves the cause in the traceback.
- Never use exceptions for normal control flow across module boundaries; return a value or a result type when absence is expected.
- Validate at the boundary (CLI input, file read, HTTP response) and let the interior assume validated data.

## Iteration and resources

- `with open(...)` always; for anything with a `close`, a lock or a transaction, use a context manager.
- Prefer `pathlib.Path` over manual string joining; it handles separators consistently.
- Specify `encoding="utf-8"` explicitly on every text file operation. The platform default differs between Windows and Linux and causes a whole class of intermittent bugs.

## Typing that pays for itself

- Annotate public function signatures; skip annotations for local variables.
- `from __future__ import annotations` avoids runtime evaluation of annotations and lets you use modern syntax on older interpreters.
- Use `Optional[T]` / `T | None` honestly: a parameter that may be `None` needs a documented branch.
- `Protocol` for structural interfaces you do not own; `dataclass(frozen=True)` for value objects.

## Performance — measure, then act

1. Profile with `cProfile` or `time.perf_counter`, not intuition.
2. Most Python slowness is I/O, an accidental O(n²) (a `list.index` or `in list` inside a loop — use a set or dict), or repeated attribute lookups in a hot loop.
3. Reach for vectorisation, C extensions or another runtime only after the profile shows interpreter overhead dominates.

## Testing

- `pytest` with plain `assert`; fixtures for setup, `parametrize` for boundary tables.
- Test the public behaviour, not private helpers.
- Freeze time and seed randomness in tests; an untestable function usually has an injected dependency missing.

## Environment honesty

If the sandbox has no Python, no `pip`, or a blocked package index, say so and provide code
you could not execute as *unverified*. Never describe a script as working because it looks
correct — run it, or label it.
