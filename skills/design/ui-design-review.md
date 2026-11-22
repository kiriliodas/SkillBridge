# UI Design Review

Use to critique an interface — a mockup, a screenshot, a live page — and produce feedback that
improves it rather than a list of personal preferences.

## What to judge, in order

1. **Does the screen answer the user's question?** The primary action and the primary information must be obvious within two seconds.
2. **Is the hierarchy correct?** One primary action per screen. If everything is emphasised, nothing is.
3. **Can the user recover?** Empty states, error states, loading states, permission states. A design reviewed only in its happy path is half-reviewed.
4. **Is it consistent?** Spacing, type scale, colour roles, control behaviour.
5. **Does it feel intentional?** Specific to this product rather than a template with the logo swapped.

## Visual hierarchy

- **Size and weight** carry importance; use at most three text sizes per screen.
- **Spacing** groups. Related items sit closer to each other than to their neighbours — proximity beats boxes and lines.
- **Colour** is for state and emphasis, not decoration. One accent colour for action, one semantic set for status.
- **Alignment** — a single left edge for text, a consistent grid. Visible misalignment reads as broken.
- **Contrast** — text 4.5:1, large text 3:1, and hierarchy should survive greyscale (squint test).

## Type

- Line length 45–75 characters. Body text 16 px minimum, line-height ~1.5.
- A type scale with a clear ratio (1.125, 1.25) rather than ad-hoc sizes.
- One or two families. A display face for headings and a text face for body is enough; more is noise.
- Avoid all-caps for anything longer than a label; avoid faux-bold and faux-italic.

## Layout

- Mobile first, at 320 px: what survives the narrowest width is what the design is really about.
- Touch targets ≥ 24 px (WCAG 2.2), ideally 44 px.
- Thumb zones matter on mobile: put destructive and primary actions within reach, not in a corner.
- Content should reflow, not shrink. Horizontal scrolling on text is a defect.

## Interaction states — the checklist designers forget

For every interactive element: default, hover, focus-visible, active, disabled, loading,
error, empty, and — where relevant — read-only and selected.

A design that specifies only the default state forces the developer to invent the other eight.

## Feedback to give

Structure the review as:

1. **What works** — one or two specific things, so the author knows what not to change.
2. **What blocks the user** — the issues that break a task, with the scenario that breaks it.
3. **What weakens clarity** — hierarchy, contrast, wording on controls.
4. **Opportunities** — optional refinements, labelled as such.

For each finding: point at the element, state the effect on the user, and offer a specific
alternative. "The CTA is weak" is not feedback; "the primary action is the same weight and
colour as the secondary one, so the user has to read both — make 'Publish' solid and
'Preview' outlined" is.

## Wording in interfaces

- Buttons name the action ("Publish changes"), not the mechanism ("Submit").
- Errors say what happened and what to do next, in the user's language, without jargon or blame.
- Labels above fields, not placeholders as labels; help text before the user fails, not after.
- Empty states say what this area is for and how to fill it.

## Limits

Without a running interface or a rendered design, this remains a critique of what is described.
Say which parts you could see and which you inferred, and never claim a design was tested when
only its description was reviewed.
