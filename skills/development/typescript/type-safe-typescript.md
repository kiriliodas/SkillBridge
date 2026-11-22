# Type Safe Typescript

Use when writing TypeScript that must stay correct as it evolves, when a type error is
being silenced, or when designing the types of a shared module.

## The compiler is a test you do not have to maintain

Turn on the strict family and fix what it reports; do not weaken the config to make code
compile.

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

`noUncheckedIndexedAccess` is the most valuable and most resisted: it makes `arr[0]` and
`record[key]` return `T | undefined`, which is the truth.

## Make illegal states unrepresentable

Prefer a shape where invalid combinations cannot be constructed over a shape plus
runtime validation.

```ts
// Weak: three fields, 8 combinations, most of them invalid
type Job = { status: string; result?: string; error?: string };

// Strong: exactly three states, each carrying what it needs
type Job =
  | { status: 'queued' }
  | { status: 'done'; result: string }
  | { status: 'failed'; error: string };
```

Then `switch (job.status)` is exhaustive, and `job.result` is reachable only after the
narrowing that guarantees it.

## Replace `any` deliberately

| Instead of | Use |
|---|---|
| `any` | `unknown`, then narrow with a type guard |
| `as` to force a shape | a parse function that validates and returns the type |
| `Record<string, any>` | `Record<string, unknown>` |
| optional-everything objects | discriminated unions |
| `@ts-ignore` | `@ts-expect-error` with a comment explaining the known mismatch |

`@ts-expect-error` fails the build when the error disappears, which is exactly what you
want: the workaround is scheduled for removal by the compiler itself.

## Narrowing that actually works

- `typeof x === 'string'`, `Array.isArray(x)`, `x instanceof Date`, `'key' in obj`.
- User-defined guards: `function isUser(v: unknown): v is User { … }` — do the real validation inside.
- `satisfies` checks a value against a type without widening it: `const config = {…} satisfies Config`.
- Exhaustiveness: `default: { const _never: never = value; }` turns a forgotten case into a compile error.

## Generics and inference

- Let inference do the work: annotate parameters, let return types be inferred, and annotate the return type at module boundaries where the contract matters.
- Constrain generics (`<T extends { id: string }>`) so the body can use the property; an unconstrained `<T>` is usually `any` with extra steps.
- Prefer a concrete union over a clever generic. Generic abstractions with four type parameters are unreadable at the call site and hard to change.

## Async and nullability pitfalls

- `Promise<T>` is not `T`; a missing `await` type-checks in places where it should not.
- `JSON.parse` returns `any` — immediately assign to `unknown` and validate.
- `Object.keys()` drops the key types; type the result explicitly when the record is typed.
- `Array.prototype.find` returns `T | undefined`: handle the absent case or the bug is just deferred.

## Boundaries — where types stop applying

Anything crossing a process boundary (HTTP, message queue, database, `localStorage`,
`postMessage`) arrives as `unknown`, whatever the type annotation claims. Validate once at
the boundary and let the rest of the code trust the validated type. A type assertion on
network data is a comment, not a check.

## Verification

- `tsc --noEmit` with the project's real config must pass. Report the exit code.
- A type-level claim ("this cannot be null") is verified by the compiler or by a test, not by inspection.
- If the project cannot run `tsc`, do not claim the types are checked.
