## Context

Card color in Storymap is not stored — it is derived from a card's vertical band via `typeOf(y, state)` (`view.js:20`), which yields `flow | epic | story`, which in turn drives the `card-{type}` CSS class and the `--coral` / `--amber` / `--mint` fills. That same derived `type` also drives card size (`CARD_SIZES`, `CARD_FONT`) and the Markdown export structure (`io.js`). So on the backbone, color *is* meaning.

This change adds a story-only color override without disturbing that. Every mutation already flows through `store.dispatch(makeCommand(...))` with `apply`/`revert`/`coalesceKey` in `commands.js`, so undo/redo, the action log, and persistence are a single chokepoint we extend rather than bypass.

Constraints (from CLAUDE.md): no build step, framework, or CDN; no `innerHTML` — DOM is built with the `h()` helper; commit-on-blur/click via one dispatch; never mutate `store.state` outside the store; bump `sw.js` `CACHE` on any shipped shell change.

## Goals / Non-Goals

**Goals:**
- Let a user color a **story** card one of three values — green (default), sky, lilac — while editing it.
- Keep flow/epic color, card type, size, meta-label, and Markdown export exactly as they are.
- Preserve a story's color when it temporarily leaves the story band, and restore it on return.
- Route the change through the existing command/undo/persistence pipeline and JSON round-trip.

**Non-Goals:**
- Coloring flow or epic cards, or adding more than three story colors.
- Making color affect card type, size, sorting, or export grouping.
- A general tagging/legend system, per-color filtering, or semantic labels baked into the colors (meaning is user-assigned).
- Any modal or settings surface — the picker lives on the editing card only.

## Decisions

### Decision: Store `color` as a story-palette token, inert outside the story band
`card.color ∈ { null, 'sky', 'lilac' }`; `null` (or absent) = default green. Display resolves as:

```
displayColor(card) = (typeOf(card.y) === 'story' && card.color) ? card.color : bandColor(type)
```

The token is *kept* when the card sits in another band, just not shown. This makes the drag edge-case free: a colored story dragged into the epic band shows amber; dragged back shows its color again — no branching, no data loss.

- **Why tokens, not hex?** Hex in state would bypass the palette, break theming, and complicate import validation. Tokens map to CSS classes (`.card-c-sky`) and validate against a fixed set.
- **Alternative rejected — a full `card.color` that overrides any band:** contradicts "flows/epics are fine as-is" and lets a story impersonate a flow/epic. Restricting to the story band keeps color-as-type intact on the backbone.
- **Alternative rejected — storing `'green'` explicitly:** the user chose `null`-clears-to-default; it keeps existing maps/exports untouched (no field = green) and makes "is this the default?" a simple falsy check.

### Decision: Two new palette colors chosen to sit outside the band hues
Add trios mirroring the existing `--mint` treatment (base / `-deep` text / `-edge` border):
- `--sky: #8FBEDA; --sky-deep: #123047; --sky-edge: #5E93B4;`
- `--lilac: #C4A6D9; --lilac-deep: #2E1A3D; --lilac-edge: #9B79B5;`

Blue and violet are the two hues the palette doesn't already use, so a recolored story can never be visually confused with coral (flow) or amber (epic). Same lightness/saturation family as mint so they read as one sticky pack on the cream paper.

### Decision: New `SET_CARD_COLOR` command
```
SET_CARD_COLOR: {
  apply:  (s, p) => { const c = findCard(s, p.id); if (c) c.color = p.to; },
  revert: (s, p) => { const c = findCard(s, p.id); if (c) c.color = p.from; },
  coalesceKey: (p) => `color:${p.id}`,
}
```
`from`/`to` are nullable primitive tokens; payload carries `{ id, from, to }`, matching the primitive-mutation convention. `isNoOp` catches the `sky→sky`/`lilac→lilac` case (equal primitives) but **not** `green→green` (both `null`, where `isNoOp` short-circuits to `false`). That's fine: the codebase already guards equality in the view before dispatching (e.g. `EDIT_CARD`/`RENAME_COLUMN` check `next !== current` at `view.js:908`/`:464`). The swatch handler does the same — skips dispatch when the picked token equals the card's current color — so re-selecting any current color (incl. default green) produces no history entry; `isNoOp` remains the backstop.

- **Why coalesce per card?** Consistent with `EDIT_CARD`/`RENAME_*`; rapid re-clicks within the window collapse to one history entry. (Acceptable either way, but this matches the codebase idiom.)

### Decision: Picker is a swatch strip on the editing story card, built with `h()`
Rendered only when the card is a story and in the `editing` state. Three buttons (`h('button', …)`) with an `aria-label`, a selected-state ring on the active one, each `onclick` dispatching `SET_CARD_COLOR` (green → `to: null`). No `innerHTML`. It attaches in the same place the edit affordance is wired (`attachCardInteractions`, around `view.js:889`), and lives inside the card element so it moves with it.

### Decision: Apply the override as a CSS class, and keep it correct mid-drag
Render path adds `card-c-sky` / `card-c-lilac` to the card element only when `type === 'story' && card.color`. Styles use `.card-story.card-c-sky { background-color: var(--sky); color: var(--sky-deep); }` (and `-edge` for the border/corner) so the class is harmless if it lingers on a non-story element.

The mid-drag rebuild at `view.js:846` sets `cardEl.className = \`card card-${type} dragging\``, which drops any override class. That line must recompute the override from the *live* `type` (which flips as the cursor crosses `epicStoryY`) and the dragged card's stored color, so the fill tracks the band during the drag.

### Decision: Carry `color` through `normalizeState`
`io.js` `normalizeState` (~line 49) maps each card explicitly and currently drops unknown fields. Add `color: normalizeColor(c?.color)` where `normalizeColor` returns the value if it is `'sky'` or `'lilac'`, else `null`. This validates imports and guarantees the round-trip.

## Risks / Trade-offs

- **[Override class lingers after a story leaves the story band]** → The class only styles `.card-story.card-c-*`; on an epic/flow element it's a dead selector, so amber/coral win regardless. Render also only *adds* the class for stories, so a full re-render self-corrects.
- **[Mid-drag path is a known correctness trap]** (`view.js:846` rebuilds `className` from scratch) → Explicitly re-derive the override there; covered by a spec scenario (fill switches live across the divider).
- **[Color as decoration weakens strict color-as-type reading]** → Bounded to the story layer only; blue/violet are outside the band hues, so backbone legibility is unaffected. Meaning of the two extra colors is intentionally user-assigned.
- **[Stale PWA shows old CSS/JS]** → Bump `sw.js` `CACHE = 'storymap-vN'`; both files are already in the precache `SHELL`.
- **[Legend/discoverability]** → The topbar legend still lists only flow/epic/story; story sub-colors are discoverable only in the editor. Acceptable for v1; a legend note is a possible follow-up, out of scope here.

## Migration Plan

Additive and backward-compatible. Existing IndexedDB state and JSON exports have no `color` field → read as `null` → default green, identical rendering. No data migration. Rollback is removing the feature: any stored `'sky'`/`'lilac'` tokens become inert (unknown field) and cards fall back to green. Deploy = ship the file changes and bump the SW cache version.

## Open Questions

None blocking. Deferred, non-blocking: whether to surface a color legend/key in the topbar, and whether Markdown export should annotate colored stories (current decision: no).
