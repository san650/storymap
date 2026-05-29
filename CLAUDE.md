# CLAUDE.md — Storymap

A static, offline-first PWA for Jeff-Patton-style story mapping. Vanilla HTML/CSS/JS, no build step, no framework, no CDN. Deployable to GitHub Pages.

## Run it

```bash
python3 -m http.server 8765
```

Open <http://localhost:8765/>. Don't open `file://` — the service worker won't register.

## Architecture in one breath

Every mutation goes through `store.dispatch(makeCommand(type, payload))`. Each command in `commands.js` declares `apply`/`revert`/`coalesceKey`, so undo/redo, action logging, and replay are one chokepoint. State is one JSON blob in IndexedDB under key `app`. The store re-emits to subscribers (currently just the renderer in `view.js`). Reads (`store.state.x`) bypass commands and are fine.

```
app.js       boot: await store.ready → attachEvents → subscribe(render) → render()
view.js      DOM render + pointer interaction (drag, edit, slot logic)
store.js     state + History + dispatch/undo/redo + persist + seed
commands.js  COMMANDS registry (one entry per mutation kind)
history.js   undo/redo stacks with 700 ms coalesce window
db.js        IndexedDB single-blob wrapper
```

## Data model

```js
state = {
  title: string,
  columns: [{ id, label }],
  flowEpicY: number,       // y of the divider between flows + epics
  epicStoryY: number,      // y of the divider between epics + stories
  releases: [{ id, label, y }],   // sorted by y
  cards: [{ id, columnId, slot, y, text }],
}
```

Card **type** (flow / epic / story) is *derived* from `card.y` against the two zone dividers — it is not stored. Card **release** is *derived* from `card.y` against the release lines. Dragging across a divider changes the type/color automatically.

A card's horizontal position is `(columnId, slot)`. Columns are an ordered list; slots are integer lanes within a column. A column's visual width is `(maxSlotUsed + 1) * SLOT_W`, so dragging a card past a column's right edge widens that column on the fly during the drag.

## Geometry constants (view.js)

```
LEFT_RAIL  120   // left margin holding zone labels
SLOT_W     240   // width of one slot inside a column
COL_GAP     24   // gap between adjacent columns
```

`computeLayout(state, { excludeCardId?, virtualCard? })` returns `{ colLefts, slotCounts, totalW }`. During drag, the dragged card is *excluded* from the natural layout (so its old slot doesn't bias the count) and a *virtualCard* at the target slot is fed in to compute the preview layout. `applyLayout(preview, draggedId)` then re-positions every column header / column-bg / non-dragged card in place — no full re-render.

`targetFromX(cursorX, state, baseLayout)` is the snap rule:
1. Cursor inside an existing slot's span → snap to that slot.
2. Cursor in a gap or past the last column → snap to whichever column's would-be new slot is closest.

## Adding a new mutation

1. Add an entry to `COMMANDS` in `commands.js` with `apply`, `revert`, and a `coalesceKey` (`null` if it should never coalesce — used for adds/removes).
2. Payload must include `from` *and* `to` for primitive-valued mutations. For add/remove, use `from: null, to: payload` (or vice versa) plus the structural fields the apply/revert read (`card`, `column`, `release`, `atIndex`, `cards`).
3. Dispatch from the view layer with `store.dispatch(makeCommand('YOUR_CMD', payload))`.

`isNoOp` in `commands.js` rejects mutations where `from === to` for primitive values only — object payloads always pass through.

## Rendering rules

- **No `innerHTML`.** The view builds every node via the `h(tag, attrs, ...children)` helper in `view.js`. User-supplied text uses the `text:` attr (textContent) or a Text node. There is no HTML-string-to-DOM path.
- **Commit on blur, not on input.** Title, column label, card text, and release label all commit via a single `dispatch` on blur. Avoids the focus-loss problem caused by tearing down the DOM mid-typing on each keystroke.
- **The pop-in animation runs only on cards added via `newlyAddedIds`**, which is cleared at the end of every `renderCanvas`. Re-rendering an existing card (e.g., after a drag) does NOT re-trigger the animation. If you add a new render path that creates cards, plug it into that Set.

## Service worker

`sw.js` caches every shell file listed in the `SHELL` array. **Bump `CACHE = 'storymap-vN'` on every deploy** — that's the only cache-busting mechanism. If you add a new file the app loads, also add it to `SHELL`, otherwise it'll be missing when the PWA is offline.

## Fonts

`Caveat` (sticky-note handwriting) and `Fraunces` (UI) are self-hosted Latin subsets under `fonts/`. Never link `fonts.googleapis.com` — it breaks first-launch offline from the home screen.

## Splash images

Regenerate after icon changes:

```bash
python3 ~/.claude/skills/simple-website/scripts/generate-splash.py icon.svg "#F2EBD9" splash/
```

Then verify one PNG matches the icon (font-rendering gotcha: see the `simple-website/reference/icons-and-splash.md` webfont section if you ever use `<text>` in the SVG).

## Keyboard shortcuts

- `Cmd/Ctrl + Z` — undo (wired through the History stack; UI-level undo button not surfaced yet)
- `Cmd/Ctrl + Shift + Z` / `Cmd/Ctrl + Y` — redo
- `Space + drag` (or middle-mouse drag) — pan the canvas
- Double-click empty canvas — create sticky at click point
- Double-click sticky — edit; `Esc` cancels, `Cmd/Ctrl + Enter` commits

## Deployment

GitHub Pages, deploy from `main` → `/ (root)`. `.nojekyll` is required for Pages to serve `_` files. No `CNAME` yet — add it (bare domain, one line) when a custom domain is wired up.

## Don't

- Don't introduce a build step, a framework, a CSS framework, or external CDNs.
- Don't switch from IndexedDB to localStorage — iOS evicts it more readily on standalone PWAs.
- Don't mutate `store.state` directly outside the store.
- Don't use `innerHTML` / `insertAdjacentHTML` — use `h()` and `replaceChildren()`.
- Don't let `font-display: block` slip in — keep `swap` so first-paint isn't blocked on font load.
