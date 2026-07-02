## 1. Harness (`test/`, ported from arnold)

- [x] 1.1 `test/Gemfile` declaring `cucumber`, `playwright-ruby-client`,
      `rspec-expectations`, `webrick`, `websocket-driver`
- [x] 1.2 `test/run.rb`: start `npx playwright launch-server --browser chromium`
      via `--config launch-server.json`, parse the `ws://` endpoint, run
      `bundle exec cucumber` with `PLAYWRIGHT_WS` set, pass argv through, exit
      non-zero on failure; `PW_VERSION` pinned to match `playwright-ruby-client`
- [x] 1.3 `test/launch-server.json` pinning host `127.0.0.1`, port `0`
- [x] 1.4 `test/cucumber.yml` (`default` + `smoke` profiles, `--strict --format progress`)
- [x] 1.5 `test/.gitignore` (bundle/tmp artifacts)

## 2. Support: server, browser, World (`test/features/support/env.rb`)

- [x] 2.1 WEBrick static server over `docs/` on a free port (background thread,
      `at_exit` shutdown); JS/JSON/SVG/webmanifest mime types set
- [x] 2.2 Connect once to the Playwright browser server (endpoint from
      `PLAYWRIGHT_WS`), keep it alive on a worker thread; `Before`/`After` hooks
      open/close a fresh `BrowserContext` + page per scenario
- [x] 2.3 `open_app` → `goto index.html`, wait for `.topbar, .title` (no routing)
- [x] 2.4 `app_doc`: read the active session doc from IndexedDB (`storymap` →
      `sessions` → `index` → `activeId` → record `.state`); `wait_doc { |d| … }`
      poller for async persistence
- [x] 2.5 Derived-fact helpers: `type_of(card, doc)` (vs `flowEpicY`/`epicStoryY`)
      and `release_of(card, doc)` (vs sorted `releases[].y`)
- [x] 2.6 Include `RSpec::Matchers`; small utils (`count`, `visible?`,
      `data_test`, `body_text`, `has_text?`)

## 3. Canvas gesture helpers (live bounding boxes — no app constants)

- [x] 3.1 `create_card(col_id, y)`: double-click `.col-bg[data-col-id]` at height
      `y`; return the new `data-card-id` by diffing the card set
- [x] 3.2 `edit_card_text(id, text)`: double-click the card, focus `.text`
      (contenteditable), type, blur (click empty canvas); commit fires on blur
- [x] 3.3 `drag_card(id, target)`: resolve target column center from
      `.col-bg[data-col-id]` box and target `y` from the relevant divider/release
      element `top`; `mouse.down / move(steps:) / up`, clearing the 5px threshold
- [x] 3.4 `drag_divider(key, dy)` on `[data-divider="…"]` and `drag_release(id, dy)`
      on `.release-line[data-release-id]`
- [x] 3.5 Assert **no** `SLOT_W` / `LEFT_RAIL` / other geometry literals appear in
      test code (grep guard)

## 4. App hooks (B-lite, additive — `docs/view.js`, `docs/index.html`)

- [x] 4.1 `data-test-id` on the Story-maps modal root and each session row
      (+ a `data-session-id` on the row)
- [x] 4.2 `data-modal-action="cancel"` / `"confirm"` on the confirm modal's two
      buttons; `data-test-id` on the confirm modal root
- [x] 4.3 `data-test-id` on the Export, Import, and Log modal roots
- [x] 4.4 Bump `sw.js` `CACHE = 'storymap-vN'`
- [x] 4.5 Confirm no behavior change — hooks are attributes only

## 5. Step definitions (`test/features/step_definitions/`)

- [x] 5.1 `common_steps.rb`: open app, generic assertions (`I should see …`,
      counts), confirm/cancel dialog, undo/redo, tap a `[data-action]`
- [x] 5.2 `canvas_steps.rb`: create / edit / delete / drag a sticky; assert type,
      release, column/slot, and text against the doc
- [x] 5.3 `structure_steps.rb`: columns (add/insert/rename/delete), dividers,
      releases (add/rename/delete/drag)
- [x] 5.4 `data_steps.rb`: export (JSON/MD), import, sessions, reset/clear, log

## 6. Feature files (cover every user-facing area)

- [x] 6.1 `smoke.feature` — boots, seed renders, title + columns visible (`@smoke`)
- [x] 6.2 `title.feature` — rename the map title → persists
- [x] 6.3 `columns.feature` — add / insert-between / rename / delete (+ stickies cascade)
- [x] 6.4 `stickies.feature` — double-click-create / edit text / delete
- [x] 6.5 `card_types.feature` — drag across each divider flips flow↔epic↔story
- [x] 6.6 `card_color.feature` — story swatch picker sky/lilac; inert on flow/epic
- [x] 6.7 `dividers.feature` — drag `flowEpicY` / `epicStoryY` reclassifies cards
- [x] 6.8 `releases.feature` — add / rename / delete / drag; card release derives from `y`
- [x] 6.9 `undo_redo.feature` — undo and redo (button + ⌘Z)
- [x] 6.10 `sessions.feature` — create / switch / delete story maps
- [x] 6.11 `export_import.feature` — export JSON + MD; import round-trip
- [x] 6.12 `reset_clear.feature` — restore-example and empty-board confirm flows
- [x] 6.13 `action_log.feature` — show-log lists recent actions

## 7. Docs + verify

- [x] 7.1 `test/CLAUDE.md` — conventions (declarative Gherkin, storage-first
      assertions, gesture helpers, tags, Playwright version-sync note)
- [x] 7.2 Note the once-off setup (`bundle install`, `npx playwright install
      chromium`) in the repo `README.md` / `CLAUDE.md`
- [x] 7.3 `ruby run.rb` runs every feature green; `ruby run.rb -p smoke` runs `@smoke`
