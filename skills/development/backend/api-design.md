# API Design

Use when designing HTTP endpoints, reviewing an API surface, or deciding how a client
and server should exchange data.

## Resources and URLs

- Model the domain as **nouns**; the HTTP method carries the verb. `POST /orders/42/cancel` is an acceptable exception for actions that are not naturally a resource update.
- Plural collections: `/orders`, `/orders/{id}`, `/orders/{id}/items`.
- Never put verbs in collection paths (`/getOrders`), never put file extensions in resource paths.
- Nest only for genuine ownership, and only one level deep. Beyond that, expose the child as a top-level resource with a filter: `/items?orderId=42`.
- When a resource moves, keep the URL stable and version the surface rather than the host.

## Methods and semantics

| Method | Safe | Idempotent | Use for |
|---|---|---|---|
| GET | yes | yes | Reading; never changes state |
| POST | no | no | Creating a subordinate resource, or an action |
| PUT | no | yes | Full replacement of a resource at a known URL |
| PATCH | no | no | Partial update |
| DELETE | no | yes | Removing a resource |

Idempotency is a promise clients rely on for safe retries. If an endpoint is not
idempotent and clients may retry it (mobile networks, queues), accept an
`Idempotency-Key` header and deduplicate on it.

## Status codes that carry meaning

- `200` success with a body · `201` created, with `Location` · `204` success, no body
- `400` malformed request · `401` unauthenticated · `403` authenticated but not allowed · `404` absent (or hidden from this caller)
- `409` conflict with current state · `412` failed precondition · `422` well-formed but semantically invalid
- `429` rate limited, with `Retry-After` · `5xx` server fault

Distinguish `401` from `403`: conflating them makes clients re-authenticate forever on a
permission problem. Never return `200` with `{"success": false}`; it defeats status-based
monitoring and caching.

## Consistency and envelopes

Pick one shape and apply it everywhere:

```json
{ "data": { "id": "42", "status": "shipped" }, "meta": { "requestId": "..." } }
```

```json
{ "error": { "code": "INVALID_STATUS", "message": "…", "details": [ ... ] } }
```

Error codes are stable identifiers for programs; messages are for humans and may change.
`details` carries field-level validation errors.

- Timestamps: ISO 8601 in UTC (`2026-11-21T10:00:00Z`). Never local time, never epoch milliseconds in a JSON API without saying so.
- Identifiers: strings, even when they are numeric, so they can grow without breaking clients.
- Booleans: `true`/`false`, never `0`/`1` or `"yes"`.

## Pagination, filtering, sorting

- **Cursor pagination** for anything that changes while being read; **offset** only for small, stable, admin-facing lists.
- Return a stable sort key with the cursor so a client can resume deterministically.
- Bound every page size server-side (`?limit=` clamped to a maximum); an unbounded list is a denial-of-service vector.
- Filters are explicit query parameters; never accept a free-form query language from untrusted clients.

## Versioning and evolution

Additive changes are safe: new optional fields, new endpoints, new enum values only if
clients were told to tolerate them. Breaking changes are: removing or renaming a field,
tightening validation, changing a type, changing default behaviour.

For breaking changes, version the path (`/v2/`) or use a media type; publish a deprecation
window, and keep the old surface working during it. Documenting a breaking change is not
the same as making it non-breaking.

## Security baseline

- Authenticate every route by default; opt out explicitly, never opt in.
- Authorise on the object, not only on the route — check that this caller may touch *this* id.
- Validate and bound every input: string length, numeric range, array size, enum membership.
- Never return internal identifiers, stack traces, SQL errors or upstream raw responses.
- Rate-limit per caller and per endpoint class, and bound expensive queries.
- CORS is an allowlist, never `*` with credentials.

## Documentation

For each endpoint document: method and path, auth requirement, path/query/body parameters
with types and bounds, success response, every error code it can return, and one complete
request/response example. An OpenAPI document is worth more than prose because it can be
validated and diffed.

## Verification

Before declaring the API done, exercise each endpoint's happy path and at least one error
path with real requests, and confirm the status codes and bodies you documented. If you
cannot run the service, say that the design is unverified rather than implying it was tested.
