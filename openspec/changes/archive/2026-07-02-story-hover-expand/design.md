## Context

A card's height is not stored — it is computed at render time by `cardHeight(text, type)` (`view.js:81`), which measures the wrapped line count (`measureCardLines`, uncapped) and then **caps it at 5 lines** via `Math.min(MAX_CARD_LINES, lines)`. The matching CSS clamps the text to 5 lines (`-webkit-line-clamp: 5` on `.card .text`, `styles.css:1029`) with `overflow: hidden`. So long stories are visually and dimensionally truncated.

Two pieces of the existing code make hover-expand nearly free:
- `measureCardLines(text, type)` already returns the **true, uncapped** line count — the full height is the same formula without the `Math.min` cap.
- The `.card.editing .text` rule (`styles.css:1034`) already unclamps text and lets the card grow (`height: auto` set in JS on edit-enter). Hover-expand is a lighter, read-only cousin of that path.
- The `.card` CSS `transition` (`styles.css:910`) already includes `height`, so setting a new inline height animates with the existing 200ms cubic-bezier. `.card:hover` (`styles.css:919`) already raises `z-index` to 11 and straightens the tilt.

Constraints (CLAUDE.md): no build step / framework / CDN; no `innerHTML`; never mutate `store.state` outside the store; bump `sw.js` `CACHE` on any shipped shell change. Expansion carries no state, so it needs no command — it is ephemeral DOM UI, exactly like the drag preview and canvas pan.

## Goals / Non-Goals

**Goals:**
- Let a desktop-mouse user peek the full text of a clamped **story** card by hovering it, with an animated grow and an immediate collapse on leave.
- Reuse the existing height transition and the editing-mode unclamp treatment; add no new data and no store command.
- Leave touch (the primary PWA target) completely unaffected.

**Non-Goals:**
- Any reveal for flow/epic cards, or for stories that aren't actually clamped (≤ 5 lines — nothing is hidden).
- A touch equivalent (long-press peek, tap-to-expand). Edit mode already reveals full content on touch.
- Persisting an "expanded" state, pushing neighbouring cards aside, or reflowing columns.
- A truncation affordance (e.g. a "more below" fade). Noted as a possible follow-up, out of scope here.

## Decisions

### Decision: Expansion is ephemeral DOM state, not a command
Hover-expand toggles a `.card-expanded` class and an inline `height` on the card element directly. It never calls `store.dispatch`, mirroring how drag preview (`applyLayout`) and panning mutate the DOM without touching the store. A full re-render (any dispatch) rebuilds the card at its capped height and drops the class; that is correct — the pointer is no longer guaranteed over the card, and hover re-fires if it is.

### Decision: Compute full height by generalizing `cardHeight`
Change `cardHeight(text, type)` to `cardHeight(text, type, cap = MAX_CARD_LINES)` and use `Math.min(cap, measureCardLines(text, type))`. Existing callers are unchanged (default cap = 5). The expanded height is `cardHeight(card.text, type, Infinity)` — `Math.min(Infinity, lines) === lines`, i.e. the uncapped natural height, floored at `CARD_SIZES[type].h` exactly like the capped path.

- **Why not a separate `fullCardHeight`?** A single parameterized function keeps the two heights guaranteed-consistent (same padding, same line-height, same floor) and avoids a second copy of the formula drifting from the first.

### Decision: Grow downward (anchor the top edge)
Cards are centered on `card.y` (`top = card.y - h/2`). On expand we set only `style.height` and **leave `top` untouched**, so the card unfurls downward from its current top edge. The alternative — keep the center fixed by also raising `top` by `Δh/2` — makes the top edge drift up under the cursor, which reads as floaty. Top-anchored reads like the note extending past its fold. Collapse restores the capped height; `top` was never changed, so there is nothing to restore there.

### Decision: Hover-intent delay in, instant out
`pointerenter` starts a ~150 ms `setTimeout(expand)`; `pointerleave` clears any pending timer and collapses immediately. The canvas is a field of absolutely-positioned, overlapping cards, so a moving pointer sweeps across many in quick succession; the delay prevents a cascade of expand/collapse from cards the user is only passing over. Collapse is instantaneous so leaving always feels responsive. The card's 200 ms height transition smooths both directions regardless.

### Decision: Gate to clamped story cards on hover-capable mouse pointers
Wire the hover handlers only when **both**:
- `typeOf(card.y, store.state) === 'story'` **and** `measureCardLines(card.text, 'story') > MAX_CARD_LINES` — i.e. the card is a story with genuinely hidden content. Non-stories and short stories get no listeners, so there is nothing to no-op.
- the device reports `matchMedia('(hover: hover)').matches`, and the triggering event's `pointerType === 'mouse'`. This keeps the iOS PWA (no hover) and touch/pen input untouched. The CSS unclamp rule is additionally scoped so it only ever applies to a card carrying the `.card-expanded` class, which only mouse hover adds.

### Decision: Guard against expanding mid-interaction
`expand()` bails if the card is `.editing` (already full height with its own picker), if it is `.dragging`, or if the scroller is `.panning`. A `pointerdown` on the card also collapses immediately and cancels any pending timer, so starting a drag or an edit from a hovered-open card resets cleanly before the drag/edit height logic runs. Pointer capture during a real drag means other cards don't receive `pointerenter`, so a drag never spuriously expands its neighbours.

### Decision: Reveal via a class that mirrors edit-mode unclamp
Add `.card-expanded .text { display: block; -webkit-line-clamp: unset; line-clamp: unset; overflow: visible; }` — the same unclamp the `.card.editing .text` rule already uses. Keeping it a class (not inline style) means the text reveal and the height grow are separately styleable and the rule is a dead selector on any card without the class.

## Risks / Trade-offs

- **[Expanded card overlaps the card below it]** → Intended: hover already sets `z-index: 11`, so the expanded card floats above its neighbours as a transient peek, then collapses on leave. Neighbours are never moved, so there is no layout thrash.
- **[A very long story expands past the visible canvas / scroller edge]** → It is clipped by the scroller like any tall content; acceptable for a transient peek. Pushing scroll or growing the canvas for a hover would be disproportionate.
- **[Hover-intent delay feels laggy]** → 150 ms is below the threshold where a deliberate hover feels broken, and the height transition (200 ms) starts from the delay, so a purposeful hover reads as smooth; incidental fly-overs never trigger.
- **[Stale PWA shows old CSS/JS]** → Bump `sw.js` `CACHE`; both files are already in the precache `SHELL`.
- **[Re-render during hover drops the expansion]** → Harmless: the rebuilt card is at capped height with no `.card-expanded`; if the pointer is still over it, hover re-fires and it re-expands after the delay.

## Migration Plan

Purely additive and presentation-only. No data model change, no persistence change, no migration. Rollback is removing the handlers and the CSS rule; nothing is stored. Deploy = ship the file changes and bump the SW cache version.

## Open Questions

None blocking. Deferred: a "more below" truncation affordance (soft bottom fade on clamped cards) to advertise that a card has hidden content — separable enhancement, out of scope here.
