## 1. Palette

- [x] 1.1 Add `--sky` / `--sky-deep` / `--sky-edge` (`#8FBEDA` / `#123047` / `#5E93B4`) and `--lilac` / `--lilac-deep` / `--lilac-edge` (`#C4A6D9` / `#2E1A3D` / `#9B79B5`) to the `:root` palette in `styles.css`, alongside the existing coral/amber/mint trios.

## 2. Command + data model

- [x] 2.1 Add a `SET_CARD_COLOR` entry to `COMMANDS` in `commands.js`: `apply` sets `card.color = p.to`, `revert` sets `card.color = p.from`, `coalesceKey: (p) => \`color:${p.id}\``.
- [x] 2.2 Confirm `isNoOp` handles the payload correctly (nullable primitive `from`/`to`): re-selecting the current color is a no-op, green→green (both `null`) is a no-op, and any real change passes through. No code change expected — verify only.

## 3. Rendering + display rule

- [x] 3.1 In `view.js`, add a helper for the story-only override class, e.g. `colorClassOf(type, card)` returning `card-c-sky` / `card-c-lilac` only when `type === 'story' && card.color`, else `''`.
- [x] 3.2 In `renderCanvas`, include that class in the card element's `class` string (`card card-${type} …`).
- [x] 3.3 Fix the mid-drag `className` rebuild (~`view.js:846`): recompute the override from the live `type` and the dragged card's stored color so the fill switches across `epicStoryY` during the drag.
- [x] 3.4 In `applyLayout` (non-dragged repositioning), confirm no class rebuild drops the override; adjust only if it does.

## 4. Swatch picker (edit-time, stories only)

- [x] 4.1 Build the swatch strip with `h()` — three `button`s (green, sky, lilac) with `aria-label`s and a selected-state marker on the active one. No `innerHTML`.
- [x] 4.2 Render the strip on the card only when the card is a story (`typeOf(card.y) === 'story'`) and the card is in the `editing` state; wire it in `attachCardInteractions` near the existing edit affordance (~`view.js:889`).
- [x] 4.3 On swatch click, dispatch `store.dispatch(makeCommand('SET_CARD_COLOR', { id, from: current.color ?? null, to: token }))` where green → `to: null`, sky → `'sky'`, lilac → `'lilac'`. Commit-on-click.
- [x] 4.4 Ensure the picker does not interfere with card drag / text editing (stop propagation on the swatch buttons like other in-card buttons).

## 5. Styles

- [x] 5.1 Add `.card-story.card-c-sky` and `.card-story.card-c-lilac` fill rules in `styles.css` (background = base, text = `-deep`, border/corner = `-edge`), scoped so they only apply to story cards.
- [x] 5.2 Style the swatch strip and its selected/active state.

## 6. Persistence / IO

- [x] 6.1 In `io.js` `normalizeState` (~line 49), add `color` to the per-card map via a `normalizeColor` helper returning the value only if it is `'sky'` or `'lilac'`, else `null`.
- [x] 6.2 Verify JSON export includes `color` (it exports `state` directly) and that import round-trips sky/lilac; unknown tokens normalize to `null`.

## 7. Service worker

- [x] 7.1 Bump `CACHE = 'storymap-vN'` in `sw.js` (CSS + JS changed). Confirm no new files were added to `SHELL`.

## 8. Verification

- [x] 8.1 Run `python3 -m http.server 8765` and load over `http://localhost:8765/` (not `file://`).
- [x] 8.2 Edit a story → pick sky, then lilac, then green; confirm immediate fill change and that green clears to default.
- [x] 8.3 Confirm no picker appears when editing flow/epic cards.
- [x] 8.4 Drag a colored story up into the epic band (shows amber) and back down (shows its color); confirm the fill switches live while crossing the divider mid-drag.
- [x] 8.5 Undo/redo a color change; confirm it appears as a single entry in the action log.
- [x] 8.6 Export to JSON, reload/import; confirm colors persist. Export to Markdown; confirm output is unchanged by colors.
