# SQL Schema Design

Use when designing tables, writing queries that must scale, reviewing a migration, or
diagnosing slow reads.

## Normalise first, denormalise with evidence

Normalise to third normal form by default: each fact stored once, so it cannot disagree
with itself. Denormalise only for a measured read path, and record what keeps the copy
consistent (trigger, application code, scheduled job). An unmaintained duplicate column
is a future data-integrity bug, not an optimisation.

## Keys

- Prefer a **surrogate primary key** (integer or UUID) plus natural-key uniqueness constraints.
- A natural key that can change is a bad primary key: renaming a user must not cascade through every foreign key.
- `UUIDv7` (or ULID) keeps index locality; random UUIDv4 fragments B-trees on insert-heavy tables.
- Every foreign key gets an index. Most slow joins are a missing index on the child side.
- Decide delete semantics explicitly: `RESTRICT` by default; `CASCADE` only where the child cannot exist alone.

## Types

| Need | Prefer | Avoid |
|---|---|---|
| Money | integer minor units + currency code | `float`, `double` |
| Timestamps | `timestamptz` (or UTC + explicit convention) | local time, `varchar` dates |
| Enums | constrained `varchar` + check, or lookup table | free text |
| Booleans | `boolean` | `'Y'`/`'N'` |
| JSON payloads | `jsonb` for genuinely schemaless data | using it to avoid modelling |

`NULL` means unknown, not empty. Pick one convention per column and enforce it
(`NOT NULL DEFAULT ''` versus nullable with a documented meaning).

## Indexing

Create an index for each of these, and nothing else without a measurement:

- every primary key and unique constraint (usually automatic);
- every foreign key column;
- the columns in the `WHERE` and `ORDER BY` of the queries you actually run;
- a composite index ordered by equality columns first, then range, then sort.

Costs to keep in mind: each index slows writes and consumes space. Low-selectivity
columns alone (a boolean, a status with two values) rarely justify one; combine them with
a selective column or use a partial index.

## Queries

- Select explicit columns, never `SELECT *` in application code: a schema change then breaks the query loudly instead of silently shipping unused data.
- Filter in the database, not in the client. Fetching 100k rows to count them is a bug.
- Beware `OFFSET` on large tables — it scans what it skips. Use keyset pagination (`WHERE (created_at, id) < (?, ?)`).
- `JOIN` before aggregating when the aggregate should reflect the joined rows; otherwise aggregate in a subquery, or you will double-count.
- `COUNT(*)` on a huge table is a full scan. If the number is only for display, approximate it.

## Migrations

1. Make the change **backward compatible** first: add the new column as nullable, deploy code that writes both, backfill in batches, then enforce `NOT NULL` and drop the old path.
2. Never rename or drop a column in the same release that stops using it.
3. Backfill in bounded batches with a pause; one giant `UPDATE` locks the table and bloats the log.
4. Have a rollback plan per migration, and test it on a copy with production-sized data.
5. Adding an index on a large table needs a non-blocking path (`CREATE INDEX CONCURRENTLY` in PostgreSQL).

## Diagnosing a slow query

1. Get the actual plan (`EXPLAIN ANALYZE`), not the estimated one.
2. Find the operation with the largest actual cost or row count, not the first line.
3. Compare estimated rows to actual rows: a large mismatch means stale statistics (`ANALYZE`) or a predicate the planner cannot use.
4. Check for a sequential scan on a large table with a selective filter — that is usually a missing or unusable index (a function on the column defeats a plain index).
5. Re-measure after each change. Optimisation without measurement is guessing.

## Verification

Run the query against realistic data volume, not an empty dev database. Confirm the plan
and the timings you report come from the actual run; if the environment has no database,
say so rather than presenting an untested design as validated.
