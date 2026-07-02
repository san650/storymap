## Why

Storymap has zero automated coverage. Every change — color coding, sessions, the
drag/geometry engine — ships on a manual smoke test. The interaction model is the
riskiest part: card type and release are *derived from geometry* (`card.y` vs the
zone dividers and release lines), so a one-line change to `computeLayout`,
`targetFromX`, or the drag handlers can silently reclassify cards with no visible
error. A real-browser end-to-end suite is the regression net that lets the canvas
engine keep evolving safely.

The sibling project `arnold/` already runs this exact stack — Cucumber (Ruby)
driving a real browser via `playwright-ruby-client`, serving `docs/` over WEBrick,
one fresh browser context per scenario. Its harness ports here almost verbatim;
the feature layer needs redesign because storymap is a single-canvas,
pointer-driven app rather than a hash-routed CRUD app.

## What Changes

- **Add a `test/` Cucumber + Playwright e2e suite** (repo root, not served). A
  `run.rb` entrypoint starts a Playwright browser server, serves `docs/` over
  WEBrick on a free port, runs every scenario in a fresh `BrowserContext`
  (empty IndexedDB → the app seeds itself → seed is the known start state), and
  exits non-zero on any failure. One command: `ruby run.rb`.
- **Assert against persisted storage.** A World helper reads the active session's
  document straight from IndexedDB (`storymap` DB → `sessions` store → `index`
  record → `activeId` → that session's `.state`). Card position, slot, `y`,
  `text`, and `color` all land in the doc, so pointer gestures are driven as
  pixels but *asserted* as data.
- **Drive the canvas with geometric helpers.** Because create/edit/move/reclassify
  are pointer gestures (double-click to create, drag across a divider to change
  type, drag below a release line to change release), the step layer gets
  `drag_card`, `edit_card_text`, and divider/release drag helpers built off
  **live DOM bounding boxes** (`.col-bg`, divider `top`) — never off hardcoded
  `SLOT_W`/`LEFT_RAIL`, so the tests don't duplicate app constants.
- **Add a thin `data-test-id` hook layer to the app** (B-lite). The canvas already
  exposes `data-card-id` / `data-col-id` / `data-release-id` / `.card-meta`, which
  the suite reuses as-is. Add `data-test-id` only where the DOM is otherwise
  ambiguous: the Story-maps session list and its rows, the confirm / export /
  import / sessions / log modal roots, and the confirm modal's cancel/confirm
  buttons. ~10–15 attributes; no behavior change.
- **Cover every user-facing feature**, including full geometric coverage of the
  drag behaviors (type-flip across dividers, release derivation, column/slot
  moves), one `.feature` file per area.

## Capabilities

### New Capabilities
- `e2e-testing`: a Ruby Cucumber + Playwright suite runnable with `ruby run.rb`,
  serving `docs/` in a real browser, isolated per scenario, one feature file per
  user-facing area, asserting on the persisted document and rendered DOM.

### Modified Capabilities
<!-- None. The app gains only additive `data-test-id` hooks; no existing spec's behavior changes. -->

## Impact

- **`test/` (new, repo root, not served):** `run.rb`, `launch-server.json`,
  `Gemfile`, `cucumber.yml`, `.gitignore`, `features/support/env.rb`,
  `features/step_definitions/*.rb`, and one `*.feature` per area.
- **`docs/view.js` + `docs/index.html`:** additive `data-test-id` attributes on the
  session list/rows and modal roots/buttons only. No logic change.
- **`docs/sw.js`:** bump `CACHE = 'storymap-vN'` (shipped JS/HTML change).
- **Not served:** `test/` stays at the repo root; only `docs/` is published, so the
  suite never reaches GitHub Pages.
- **Prerequisites (once):** `bundle install` in `test/` and
  `npx playwright install chromium`. No `package.json`, no build step, no new
  runtime dependency for the app.
