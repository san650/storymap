# Writing e2e tests for Storymap

The suite is **Cucumber (Ruby) driving a real browser via Playwright**. It serves
`docs/` over a local WEBrick server and runs each scenario in a **fresh browser
context** (empty IndexedDB → the app seeds itself, so the seed is every scenario's
starting state). Follow these conventions so new tests stay consistent and stable.

## Running

```sh
cd test
bundle install                       # once
npx playwright install chromium      # once
ruby run.rb                          # whole suite (boots Playwright + WEBrick)
ruby run.rb features/stickies.feature # one feature
ruby run.rb -p smoke                 # @smoke only
ruby run.rb --tags @canvas           # one tag group
```

`run.rb` starts the Playwright browser server, exports its ws endpoint as
`PLAYWRIGHT_WS`, runs cucumber, and tears the server down.

## Storymap is a canvas app — assert storage, drive with gestures

Unlike a form/CRUD app, storymap is a single infinite canvas. A card's **type**
(flow/epic/story) and **release** are *derived from its `y`* against the zone
dividers and release lines — never stored. So:

- **Assert against the persisted document**, read from IndexedDB via `app_doc`
  (the `storymap` DB → `sessions` store → `index` record → active session's
  `state`). Persistence is async after a dispatch, so poll with `wait_doc`:

  ```ruby
  doc = wait_doc { |d| d && d['columns'].length == n }
  ```

  Derived facts have helpers: `type_of(doc, card_id)` and `release_of(doc, card_id)`.

- **Drive interactions with the gesture helpers** in `features/support/env.rb`:
  `create_sticky`, `set_sticky_text`, `drag_sticky` (`to_col:` / `to_band:` /
  `below_release:`), `drag_divider`, `drag_release`, `set_editable`. They resolve
  every target from **live DOM bounding boxes** (`.col-bg`, `[data-divider]`,
  `.release-line`) — **never** from `SLOT_W` / `LEFT_RAIL` or other view.js
  constants. Do not reintroduce hard-coded geometry into the tests; that would
  double-encode the very constants these tests exist to protect.

## Gherkin style — declarative, not imperative

Feature files describe **what the facilitator does**, never **how the UI does it**.
No selectors, coordinates, or geometry constants leak out of step definitions.
Third person, one action per step, no trailing punctuation.

```gherkin
# good — intent
When I drag the sticky "k-f1" into the story band

# bad — UI mechanics leaking into the feature
When I press the mouse at 264,220 and move to 264,610
```

## Selectors (step definitions only)

- **Canvas structure** is already hooked: `[data-card-id]`, `[data-col-id]`,
  `[data-release-id]`, `[data-divider]`, and `.card-meta` (its text is the live
  type). Reuse these.
- **Interactions** use the topbar `[data-action="…"]` and the modal hooks added
  for tests: `[data-test-id]` on the confirm / export / import / sessions / log
  modal roots and session rows, and `[data-modal-action="cancel|confirm"]` on the
  confirm buttons (helper: `data_test('…')`).
- Commit-on-blur: title, labels, and card text commit on `blur`. Helpers type into
  the contenteditable then call `blur_edit` (clicks the inert `.legend`).

## File organization

- **One feature file per area** (`stickies.feature`, `releases.feature`, …).
- Shared preconditions go in a `Background`.
- Steps are grouped by domain: `common_steps.rb` (boot, menu, dialogs, board
  counts), `canvas_steps.rb` (stickies, type/release/color), `structure_steps.rb`
  (title, columns, dividers, releases), `data_steps.rb` (sessions, export/import,
  log).

## Version sync

Playwright is pinned in two places that must move together on a bump: `PW_VERSION`
in `run.rb` and the `playwright-ruby-client` gem in `Gemfile`.
