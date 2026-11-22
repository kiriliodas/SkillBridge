# Design Systems

Use when building or auditing a shared component library, or when interface inconsistency is
slowing a team down.

## What a design system is for

It exists to make the right thing the easy thing: consistent output without re-deciding
spacing, colour and behaviour on every screen. If it does not reduce decisions for the people
building screens, it is a documentation project, not a design system.

## The three layers, in dependency order

1. **Tokens** — the smallest decisions as named values: colour, spacing, type scale, radius, shadow, duration.
2. **Components** — behaviour plus tokens: button, input, dialog, table.
3. **Patterns** — compositions that solve a user problem: form validation, empty state, data table with filters.

Build in that order. A component built before its tokens exist hardcodes values that later
have to be hunted down.

## Tokens

- **Semantic names, not visual ones.** `color.danger.background`, not `red.500` at the point of use. The palette may be `red.500`; components reference the semantic alias.
- **A scale, not a menu.** Spacing in four or five steps (4/8/12/16/24/32), a type scale with a fixed ratio. Arbitrary values are how inconsistency enters.
- **Every token needs a reason to exist.** A token used once is a variable, not a system decision.
- **Themes are token swaps.** If switching to dark mode requires touching components, the layering is wrong.

## Components

For each component, define and document:

- **Anatomy** — the parts that exist (label, icon slot, helper text).
- **States** — default, hover, focus-visible, active, disabled, loading, error, and empty where it applies.
- **Variants** — a small closed set, and what distinguishes them structurally, not only in colour.
- **Rules** — when to use this instead of that (a button versus a link; a modal versus a page).
- **Accessibility** — role, keyboard behaviour, focus management, announcement on change.
- **Anti-patterns** — the misuse you have already seen in the codebase.

A component without documented states forces every consumer to invent the missing ones, which
is exactly the inconsistency the system exists to prevent.

## Naming and structure

- Components named for what they are (`Dialog`), not for where they are used (`CheckoutModal`).
- One source of truth. Forked components per team defeat the purpose: extend with slots and composition instead.
- Public API is the smallest surface that covers the documented use cases. Every extra prop is a commitment.

## Adoption and maintenance

- Even the best system fails if the legacy components still work and nobody migrates. Plan the migration per screen, and a deprecation date.
- Track usage: which components are used, which are never used (delete them), which are bypassed (understand why before mandating).
- Version the system, and treat a breaking change like any public API break: deprecate, warn, then remove.
- Documentation lives beside the code that renders the examples, or it drifts. A static document describing a component that changed twice since is a trap.

## Auditing an existing system

1. Inventory components and their real states (grep the codebase, not the doc).
2. Find the duplication: three near-identical button styles are three bugs waiting to diverge.
3. Find the hardcoded values that bypass tokens.
4. Check the states: which interactive states are undefined?
5. Check accessibility across the board, then report by severity, not by component count.

## Limits

If there is no component library in the environment, this remains guidance for a design. Say
what was inspected (styles, markup, screenshots) and what was inferred; do not describe a
system as audited when only its documentation was read.
