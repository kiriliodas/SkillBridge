# React Component Patterns

Use when building or reviewing React components: choosing composition over
configuration, deciding where state lives, and keeping components testable.

## Decide where state belongs

Walk this ladder in order and stop at the first rule that applies. Most state bugs
come from starting at the wrong rung.

1. **Can it be derived?** Compute it during render (`const total = items.length`) instead of storing it. Stored derived state desynchronises on the next update.
2. **Does one component own it?** Keep it local with `useState`.
3. **Do siblings need it?** Lift it to their closest common parent.
4. **Is it shared across distant branches?** Use context, but split contexts by update frequency: a context whose value changes on every keystroke re-renders every consumer.
5. **Is it server data?** Do not put it in component state. Fetch it with a query library that owns caching, invalidation and loading states.
6. **Is it URL state?** Filters, tabs, pagination and search belong in the URL so the view is shareable and the back button works.

## Compose, do not configure

A prop that switches layout, a boolean that changes behaviour, or a mode string are
signals that the component is several components sharing a name.

```jsx
// Configuration: every new requirement adds a prop
<Card variant="compact" withFooter footerAlign="right" showBorder />

// Composition: new requirements are new children
<Card>
  <Card.Body>…</Card.Body>
  <Card.Footer align="right">…</Card.Footer>
</Card>
```

Rules of thumb:

- Prefer `children` and named slots over boolean props. Two booleans on one component already give four untested states.
- Prefer explicit variants (`<PrimaryButton>`, `<GhostButton>`) over `variant="…"` when the variants diverge in structure, not only in styling.
- Extract a component when you need to reuse it a third time, not the first.

## Keep effects for synchronisation only

`useEffect` is for synchronising with something outside React (DOM APIs, subscriptions,
timers, network). It is not for computing values or reacting to props.

| Smell | Fix |
|---|---|
| `useEffect` that sets state from props | Compute during render, or key the component |
| `useEffect` that runs on mount to fetch | Use a query library or a framework loader |
| `useEffect` with an empty array to "initialise" | Initialise in `useState` |
| `useEffect` that resets state when an id changes | Pass `key={id}` to remount |
| Manual `memo`/`useCallback` everywhere | Profile first; memoise the measured hot path |

When an effect is legitimate, clean up: abort fetches with `AbortController`, remove
listeners, clear timers. An uncleaned subscription is a leak that only shows in long sessions.

## Make components testable without a DOM

- Keep data shaping outside components (pure functions), so logic is testable with plain assertions.
- Take dependencies as props or arguments instead of importing singletons, so tests inject fakes.
- Prefer querying by role and accessible name in tests; if you cannot, the markup is probably inaccessible too.

## Review checklist

- [ ] No state that could be derived from props or other state.
- [ ] Every list has a stable `key` that is not the array index (unless the list is static and never reordered).
- [ ] No boolean-prop explosion; composition or explicit variants instead.
- [ ] Effects have a cleanup and a documented reason to exist.
- [ ] Loading, empty and error states are all rendered, not just the happy path.
- [ ] Nothing reads `window`/`document` during render (breaks server rendering and tests).

## Verification

Render the component in a test with the three states above, then assert on accessible
roles and names. If a component has no test that fails when you break its behaviour,
the checklist above is unverified.

## Limits

Patterns here target React 18+. Class components, legacy lifecycle methods and
`forwardRef` era idioms are out of scope; React 19 treats `ref` as a normal prop.
