## Why

Story text is clamped to 5 lines (`-webkit-line-clamp: 5` on `.card .text`) and the card's height is capped to match (`cardHeight` takes `Math.min(MAX_CARD_LINES, …)`). Anything longer is hidden behind a WebKit ellipsis, and today the only way to read it is to double-click into edit mode. Users want a lightweight, read-only peek: hover a long story and it expands (animated) to reveal the whole note, collapsing again the moment the pointer leaves.

## What Changes

- On a **desktop mouse hover** over a **story** card whose content is actually clamped (> 5 lines), the card animates open to its full height and shows all its text. It collapses back to the 5-line height on pointer-leave.
- The reveal waits for **~150 ms of sustained hover** (hover-intent) before expanding, so sweeping the mouse across the overlapping cards on the canvas doesn't cause a flurry of expand/collapse. Collapse is immediate.
- The card grows **downward** (top edge anchored) — it reads like the note continuing "below the fold." It rides the existing hover `z-index: 11`, so it floats over the cards beneath it like a peek; neighbours do not move.
- This is a **mouse-only affordance**. On touch (the iPhone/iPad PWA) there is no hover, so nothing changes — double-tap-to-edit remains the way to see full content. Gated behind `@media (hover: hover)` and `pointerType === 'mouse'`.
- No new data, no store command, no persistence change — expansion is ephemeral UI state (like drag/pan), toggled directly on the DOM.

Not breaking: cards with ≤ 5 lines have no hidden content, so hover is a no-op for them. Flow and epic cards are unaffected.

## Capabilities

### New Capabilities
- `story-hover-expand`: Hover-to-expand for clamped story cards — the hover-intent trigger, the animated grow to full (uncapped) height, the text-unclamp reveal, the collapse-on-leave, and the mouse-only / clamped-only gating.

### Modified Capabilities
<!-- None — no existing spec under openspec/specs/ governs card hover behavior. -->

## Impact

- **`view.js`**: generalize `cardHeight(text, type)` to `cardHeight(text, type, cap = MAX_CARD_LINES)` so an uncapped full height can be computed with `cap: Infinity`; add `pointerenter`/`pointerleave`/`pointerdown` hover-expand wiring in `attachCardInteractions`, guarded to clamped story cards on hover-capable pointers.
- **`styles.css`**: add a `.card-expanded .text` rule that unclamps the text (mirrors the existing `.card.editing .text` rule). The card's `height` is already in the CSS `transition` list, so the grow animates for free.
- **`sw.js`**: bump `CACHE` version (shipped CSS/JS change).
- No new dependencies, no build step, no framework, no CDN, no new files in `SHELL`.
