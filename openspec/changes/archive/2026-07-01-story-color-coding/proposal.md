## Why

Story cards all render the same green today because color is derived purely from a card's vertical band (flow → coral, epic → amber, story → green). Users want to tag individual stories — "belongs to another team," "has open questions," or any theme of their choosing — without leaving the story band or disturbing the flow/epic backbone. A small, story-only color choice adds that expressiveness while keeping the Jeff-Patton color-as-type semantics of the backbone intact.

## What Changes

- Add an optional per-card color to **story** cards only. Flow and epic cards are unaffected — their color stays derived from the band.
- While editing a story card, show a 3-swatch picker: **green (default), sky (blue), lilac (violet)**. Clicking a swatch commits immediately.
- Picking **green clears the override** (stored as `null`); sky/lilac store a color token.
- The stored color is a story-palette token that is **inert outside the story band**. If a colored story is dragged up into the epic/flow band it shows the band color; dragged back into the story band it shows its stored color again. No data is lost.
- Extend the app palette with two new sticky color trios: `sky` `#8FBEDA` (deep `#123047`, edge `#5E93B4`) and `lilac` `#C4A6D9` (deep `#2E1A3D`, edge `#9B79B5`). These sit outside the coral/amber/mint band hues so a recolored story can never be mistaken for a flow or epic.
- Color round-trips through JSON export/import; the Markdown export and the `story`/`epic`/`flow` meta-label are unchanged.

Not breaking: existing maps and exports have no `color` field, which reads as the default green — they render identically.

## Capabilities

### New Capabilities
- `story-color-coding`: Per-story color override — the story-only color palette, the edit-time swatch picker, the "inert outside the story band" display rule, and its persistence through the command/undo and export/import paths.

### Modified Capabilities
<!-- None — there are no existing specs under openspec/specs/ to modify. -->

## Impact

- **Data model**: adds optional `state.cards[].color` (token: `null` | `'sky'` | `'lilac'`).
- **`commands.js`**: new `SET_CARD_COLOR` command (nullable-primitive `from`/`to`, passes `isNoOp`), dispatched through the single `store.dispatch` chokepoint so undo/redo and the action log get it for free.
- **`view.js`**: render applies a color-override class only when `type === 'story' && card.color`; the mid-drag `className` rebuild (~`view.js:846`) must toggle the override live as the cursor crosses `epicStoryY`; new swatch strip rendered only while editing a story card.
- **`styles.css`**: two new color trios plus `.card-story.card-c-sky` / `.card-story.card-c-lilac` fill rules and swatch-strip styling.
- **`io.js`**: `normalizeState` (~line 49) must carry `color` through import/export and validate it against the allowed token set.
- **`sw.js`**: bump `CACHE` version (shipped CSS/JS change).
- No new dependencies, no build step, no framework, no CDN.
