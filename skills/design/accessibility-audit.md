# Accessibility Audit

Use to check whether a web interface can be used by people with disabilities, and to report
findings that a developer can act on.

## What automated tools can and cannot tell you

Automated scanners detect roughly a third of real issues: missing alt attributes, some
contrast failures, duplicate ids, missing labels. They cannot tell you whether the alt text
is *meaningful*, whether the tab order makes sense, or whether a screen reader announces the
error correctly. An audit that only ran a scanner is a partial audit, and should be
described as one.

## Manual checks, in order of impact

### 1. Keyboard only

Put the mouse away. Tab through the entire flow.

- Every interactive element is reachable and operable (Tab, Shift+Tab, Enter, Space, arrows).
- Focus order follows the visual order.
- Focus is always visible, and its indicator has at least 3:1 contrast against the adjacent colour (2.4.7, 1.4.11).
- Focus is never fully hidden behind a sticky header, cookie bar or chat widget (2.4.11 — new in 2.2).
- No keyboard trap: you can always tab out of a modal, an embed or a custom widget (2.1.2).
- A skip link or landmarks let a keyboard user bypass repeated navigation (2.4.1).

### 2. Structure and semantics

- Headings form a logical outline (h1 → h2, no levels skipped for styling).
- Landmarks: `header`, `nav`, `main`, `footer` are present and unique.
- Lists are lists, buttons are `<button>`, links are `<a href>` — not divs with click handlers.
- Form inputs have a associated `<label>`; placeholder text is not a label.
- Tables have `<th>` with `scope`; layout tables do not exist.

### 3. Contrast

- Body text ≥ 4.5:1 against its background (1.4.3).
- Large text (≥ 24 px, or ≥ 18.5 px bold) ≥ 3:1.
- UI components, borders and meaningful icons ≥ 3:1 (1.4.11).
- Check every theme: light, dark, high-contrast, and disabled states.
- Colour is never the only carrier of meaning (1.4.1): errors, required fields and chart series need a second signal.

### 4. Zoom and reflow

- 200% text zoom without clipping or overlap (1.4.4).
- 400% zoom at 1280 px wide, or 320 CSS px width, without two-axis scrolling (1.4.10).
- Text spacing overridden (line height 1.5, letter spacing 0.12em) does not break layout (1.4.12).

### 5. Forms and errors

- Every error is announced, described in text, and associated with its field.
- Error messages say what is wrong and how to fix it — not "invalid input".
- No redundant entry within one process (3.3.7, new in 2.2).
- Authentication does not rely on a cognitive test; paste and password managers work (3.3.8, new in 2.2).

### 6. Pointer and touch

- Targets are at least 24×24 CSS px, or have sufficient spacing (2.5.8, new in 2.2).
- Every drag interaction has a click or keyboard alternative (2.5.7, new in 2.2).
- No functionality depends on device motion without an alternative (2.5.4).

### 7. Motion and timing

- Anything that moves for more than 5 seconds can be paused (2.2.2).
- No content flashes more than three times per second.
- `prefers-reduced-motion` is respected for non-essential animation.

## Screen reader spot check

With NVDA+Firefox or VoiceOver+Safari, verify five things: the page title is meaningful, the
main landmark is announced, a form can be completed, a dynamic update is announced (live
region), and a modal traps focus and returns it on close.

## Reporting

One row per finding:

| Field | Content |
|---|---|
| Criterion | WCAG number and name (e.g. 2.4.7 Focus Visible) |
| Level | A / AA |
| Location | page and element |
| Evidence | what happened when tested |
| Impact | who is blocked, and from what |
| Fix | the specific code change |
| Severity | blocker / major / minor |

Separate "tested and failed" from "not tested". A checklist with everything marked "pass"
because the scan was clean is worse than an honest list of gaps.

## Limits

Automated scans, a keyboard pass and a screen reader spot check do not replace testing with
disabled users. Say explicitly what was not tested — for example "no screen reader available
in this environment" — rather than implying full conformance.
