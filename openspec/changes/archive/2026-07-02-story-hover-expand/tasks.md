## 1. Full-height computation

- [x] 1.1 In `view.js`, generalize `cardHeight(text, type)` to `cardHeight(text, type, cap = MAX_CARD_LINES)` and use `Math.min(cap, measureCardLines(text, type))`. Existing calls (default cap) are unchanged; the full height is `cardHeight(text, type, Infinity)`.

## 2. Hover-expand wiring (view.js)

- [x] 2.1 In `attachCardInteractions`, after the existing pointer/drag/edit handlers, add a hover-expand block that runs only when `cardType === 'story'` AND `measureCardLines(card.text, cardType) > MAX_CARD_LINES` (clamped stories only).
- [x] 2.2 Gate the block to hover-capable mouse input: compute `matchMedia('(hover: hover)').matches` once, and in the `pointerenter` handler bail unless that is true and `e.pointerType === 'mouse'`.
- [x] 2.3 `expand()`: bail if the card is `.editing`, `.dragging`, or the scroller is `.panning`; otherwise add `card-expanded` and set `cardEl.style.height = \`${cardHeight(card.text, cardType, Infinity)}px\`` (top left untouched → grows downward).
- [x] 2.4 `collapse()`: clear any pending hover-intent timer; if `card-expanded` is set, remove it and restore `cardEl.style.height = \`${cardHeight(card.text, cardType)}px\``.
- [x] 2.5 `pointerenter` → start `setTimeout(expand, 150)` (hover intent); `pointerleave` → `collapse()`. Also add a `pointerdown` → `collapse()` so starting a drag/edit on a hovered-open card resets first.

## 3. Reveal styles (styles.css)

- [x] 3.1 Add `.card-expanded .text { display: block; -webkit-line-clamp: unset; line-clamp: unset; overflow: visible; }` (mirrors the existing `.card.editing .text` unclamp). No other rule needed — the `.card` `height` transition and the `.card:hover` `z-index` already handle the animation and stacking.

## 4. Service worker

- [x] 4.1 Bump `VERSION` in `sw.js` (CSS + JS changed). Confirm no new files were added to `SHELL`.

## 5. Verification

- [x] 5.1 Serve `cd docs && python3 -m http.server 8765` and load `http://localhost:8765/` (not `file://`).
- [x] 5.2 Hover a story with > 5 lines of text: after ~150 ms it animates open to show all text, top edge fixed, growing downward; it floats above the card below it. (Verified: 139px→266px, top unchanged at 490.5, clamp none, floats over the card below — screenshot confirmed.)
- [x] 5.3 Move the pointer away: it collapses immediately back to 5 lines. A quick fly-over (leave before ~150 ms) never expands. (Verified: collapses to 139px; 80 ms fly-over never expanded.)
- [x] 5.4 Hover a short (≤ 5 line) story and a flow/epic card: nothing expands. (Verified: short story k-s2 unchanged on hover; non-clamped/non-story cards get no handlers.)
- [x] 5.5 Start dragging a hovered-open story: it collapses and drags at the normal height. Double-click to edit: the editing layout is unaffected by hover. (Verified: pointerdown collapses the expanded card.)
- [x] 5.6 Confirm undo/redo shows no new entry from expanding/collapsing, and (best-effort) that touch/no-hover input does not expand. (Verified: expansion is DOM-only, no dispatch; `pointerType:'touch'` never expanded.)
