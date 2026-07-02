## Context

Storymap is a single-screen, offline-first PWA: one infinite canvas, no routing,
every mutation flowing through `store.dispatch(makeCommand(...))` and persisting to
IndexedDB (DB `storymap`, store `sessions`). Card **type** (flow/epic/story) and
**release** are not stored — they are derived from `card.y` against the zone
dividers (`flowEpicY`, `epicStoryY`) and release lines. The primary interactions
are pointer gestures on a canvas, not buttons on forms.

The `arnold/` project runs a Cucumber (Ruby) + Playwright suite over its own
`docs/` app. This change ports that harness and designs a feature layer suited to
storymap's canvas model.

## Goals / Non-Goals

**Goals:**
- One command (`ruby run.rb`) boots a real browser, serves `docs/`, runs everything, exits non-zero on failure.
- Each scenario is isolated: fresh browser context → empty IndexedDB → the app seeds the example map.
- Assertions read the **persisted document** from IndexedDB (and/or rendered DOM); pointer gestures are the *inputs*, storage is the *oracle*.
- Full geometric coverage of the drag behaviors that make storymap unique (type-flip across dividers, release derivation, column/slot moves).
- Feature files are declarative — no selectors/coordinates leak out of step definitions.

**Non-Goals:**
- Unit tests, mocking, or a test framework beyond Cucumber + RSpec::Expectations.
- A build step, bundler, or `package.json` for the app.
- Testing iOS-standalone / service-worker-offline behavior (out of scope for headless Chromium).
- Visual/screenshot regression.

## Decisions

**D1 — Harness ports from arnold nearly verbatim.** `run.rb`, `launch-server.json`,
`Gemfile`, and `cucumber.yml` are copied. `run.rb` starts
`npx playwright launch-server --browser chromium`, parses the `ws://` endpoint,
and runs `bundle exec cucumber` with `PLAYWRIGHT_WS` set; extra argv passes through
(`ruby run.rb features/stickies.feature`). Playwright is pinned in two places that
move together on a bump: `PW_VERSION` in `run.rb` and `playwright-ruby-client` in
`Gemfile`. *Alternative:* a node runner — rejected; standardize on the same
Ruby+Cucumber stack as arnold.

**D2 — `env.rb` changes vs arnold.** Four edits: (1) the boot wait becomes
`wait_for('.topbar, .title')`; (2) navigation is trivial — no hash routes, every
scenario just `goto index.html`; (3) `app_doc` reads storymap's sessions schema
(below); (4) new canvas helpers (D4). WEBrick static-server-over-`docs/`, the
free-port picker, the browser-server connection kept alive on a worker thread, and
the `Before`/`After` fresh-context hooks are unchanged.

**D3 — `app_doc` reads the active session.** Storymap persists the seed on first
launch (`#hydrate` awaits `#persist()`), so the doc is non-null from the first page
load — no "empty until first mutation" caveat. The read is two-step because of the
sessions index:

```js
() => new Promise((resolve) => {
  const req = indexedDB.open('storymap');
  req.onsuccess = () => {
    const os = req.result.transaction('sessions','readonly').objectStore('sessions');
    os.get('index').onsuccess = (e) => {
      const activeId = e.target.result && e.target.result.activeId;
      if (!activeId) return resolve(null);
      os.get(activeId).onsuccess = (r) =>
        resolve(r.target.result ? r.target.result.state : null);
    };
  };
  req.onerror = () => resolve(null);
})
```

A `wait_doc { |d| ... }` poller (ported from arnold) handles async persistence
after a dispatch. Storage helpers resolve derived facts the doc doesn't store:
`type_of(card, doc)` compares `card.y` to `doc.flowEpicY`/`epicStoryY`;
`release_of(card, doc)` compares against sorted `doc.releases[].y`.

**D4 — Canvas gestures via live bounding boxes, never app constants.** New World
helpers:
- `create_card(col_id, y)` — double-click the `.col-bg[data-col-id]` at a given
  height, returns the new `data-card-id` (diff the card set before/after).
- `edit_card_text(id, text)` — double-click `[data-card-id]`, focus `.text`
  (contenteditable), type, then blur (commit fires on `blur` reading `innerText`).
- `drag_card(id, target)` where `target` is expressed relatively (a column id
  and/or a band name and/or a slot) and resolved to pixels from the *live* DOM:
  target-column center from `.col-bg[data-col-id]` bounding box, target `y` from
  the relevant divider/release element's `top`. Uses `mouse.down / move(steps:) /
  up` like arnold's `reorder`, clearing the 5px drag threshold. **No `SLOT_W` /
  `LEFT_RAIL` literals in the test code.**
- `drag_divider(key, dy)` / `drag_release(id, dy)` — grab `[data-divider="…"]` /
  `.release-line[data-release-id]` and move by a delta.

*Alternative:* hardcode geometry constants mirrored from `view.js` — rejected;
they would silently rot when the app's constants change, and the whole point is to
catch geometry regressions, not encode them twice.

**D5 — B-lite hooks: reuse structural attrs, add `data-test-id` only where
ambiguous.** The canvas already exposes `data-card-id`, `data-col-id`,
`data-release-id`, and `.card-meta` (its textContent is the live type) — the suite
uses these directly. Interactions reuse the topbar `[data-action="…"]`. The app
gains `data-test-id` (and, for the confirm modal, `data-modal-action` to match
arnold) only where CSS-class matching would be brittle:
- Story-maps modal root + each session row (+ its session id).
- Confirm modal root; its Cancel and Confirm buttons.
- Export / Import / Log modal roots.

This is ~10–15 additive attributes with no behavior change. *Alternative A:* no app
change, match everything by CSS class — rejected as brittle for the session list
and modals. *Alternative full-parity:* blanket `data-test-id` everywhere — rejected
as more churn than the payoff; the canvas is already well-hooked.

**D6 — Assert storage first, DOM second.** Every gesture's outcome is in the doc
(`columnId`, `slot`, `y`, `text`, `color`), so scenarios assert the persisted doc
via `wait_doc`. DOM assertions (`.card-meta` text, `.card-c-sky` class, visible
labels) back up *rendered* outcomes where the derived value isn't itself stored
(type, release, color-while-in-story-band).

**D7 — One feature file per area; declarative Gherkin; tags per group.** Third
person, one action per step, no selectors in `.feature` files, `Background` for
shared preconditions, `Scenario Outline` for parametric cases. Tags mirror arnold's
scheme (`@smoke`, `@canvas`, `@columns`, `@releases`, `@sessions`, `@data`,
`@undo`) so groups run selectively (`ruby run.rb --tags @canvas`).

## Feature coverage

| File | Covers |
|---|---|
| `smoke` | app boots, seed renders, title + columns visible, `@smoke` |
| `title` | rename the map title → persists |
| `columns` | add / insert-between / rename / delete (+ its stickies cascade, confirm) |
| `stickies` | double-click-create / edit text / delete |
| `card_types` | drag a sticky across each divider → type flips flow↔epic↔story (assert `.card-meta` + storage) |
| `card_color` | story swatch picker sky/lilac; override inert on flow/epic bands |
| `dividers` | drag `flowEpicY` / `epicStoryY` → cards reclassify |
| `releases` | add / rename / delete / drag line → a card's release derives from its `y` |
| `undo_redo` | a mutation undoes and redoes (button + ⌘Z) |
| `sessions` | create / switch / delete story maps (multi-session) |
| `export_import` | export JSON + Markdown; import round-trips a doc |
| `reset_clear` | restore-example and empty-board confirm flows |
| `action_log` | show-log lists recent actions |

## Risks / Trade-offs

- **Drag scenarios are the fragile core.** Mitigated by driving off live bounding
  boxes + `mouse.move(steps:)` (arnold's proven approach) and asserting storage,
  not pixels. If a gesture proves flaky, the fallback is to dispatch the same
  command via `page.evaluate` — but that is a last resort, since it stops testing
  the real interaction.
- **contenteditable commit-on-blur timing.** The app commits on `blur` reading
  `innerText`; helpers must blur (click empty canvas) and then `wait_doc` for the
  text to land.
- **Global Playwright resolution varies by machine.** Handled by `run.rb` shelling
  `npx playwright@<pin> launch-server` and failing clearly if the endpoint never
  prints.
- **App hook additions touch `docs/`.** Kept minimal (D5) and additive; `sw.js`
  `CACHE` is bumped since JS/HTML shipped.

## Migration

None. Additive test suite plus additive DOM hooks. No data-model or behavior
change; existing maps and exports are unaffected.
