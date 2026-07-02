## ADDED Requirements

### Requirement: Cucumber + Playwright e2e suite

The repository SHALL include an end-to-end test suite under `test/`, written with
Cucumber (Ruby) using the Playwright backend (`playwright-ruby-client`), with a
`Gemfile` declaring its dependencies. The suite SHALL serve the `docs/` app over a
local static server, drive it in a real browser via a Playwright browser server,
and fail the run if any scenario fails. A `run.rb` entrypoint SHALL start the
Playwright server and run the suite in one command (`ruby run.rb`). The `test/`
directory SHALL live at the repo root and NOT under `docs/`, so it is never
published by GitHub Pages.

#### Scenario: Run the suite

- **WHEN** a developer runs `ruby run.rb` in `test/` (after `bundle install` and
  `npx playwright install chromium`)
- **THEN** it starts the Playwright browser server, serves `docs/`, drives a
  browser, executes every scenario, and exits non-zero if any scenario failed

#### Scenario: Run a subset

- **WHEN** a developer runs `ruby run.rb features/stickies.feature` or
  `ruby run.rb -p smoke`
- **THEN** only the named feature (or the `@smoke`-tagged scenarios) run

#### Scenario: Dependencies are declared

- **WHEN** setting up the suite
- **THEN** a `Gemfile` declares `cucumber`, `playwright-ruby-client`, and
  `rspec-expectations` (plus the static-server dependency)

### Requirement: Isolated scenarios seeded from a fresh app

Each scenario SHALL run against a fresh browser context with empty storage, so the
app seeds itself and the seed is the known starting state, independent of other
scenarios. Assertions SHALL be made on observable behavior — the rendered UI and/or
the document persisted to IndexedDB.

#### Scenario: Scenarios are isolated

- **WHEN** a scenario begins
- **THEN** it runs in a fresh browser context with empty storage, so the app
  starts from the seed independent of other scenarios

#### Scenario: Persisted document is readable for assertions

- **WHEN** a scenario needs to assert an outcome
- **THEN** it can read the active session's document from IndexedDB (the
  `storymap` database, the `sessions` store, the `index` record's active session)
  and assert on the card, column, release, and divider state it contains

### Requirement: Feature coverage across the application

The suite SHALL provide Cucumber feature files covering the application's
user-facing features: the map title, columns (add, insert-between, rename, delete
with sticky cascade), stickies (create, edit, delete), card type derivation across
the zone dividers, story color coding, divider dragging, releases (add, rename,
delete, drag, and release derivation), undo/redo, sessions (create, switch,
delete), export/import, reset/clear, and the action log. Each user-facing feature
SHALL have a `.feature` file whose scenarios exercise it end-to-end.

#### Scenario: Features are covered

- **WHEN** a user-facing feature exists
- **THEN** the suite contains a `.feature` file with scenarios exercising it
  end-to-end

#### Scenario: Geometry-derived behavior is exercised via real gestures

- **WHEN** a behavior depends on canvas geometry (a card's type from its position
  relative to the zone dividers, or its release from its position relative to the
  release lines)
- **THEN** a scenario drives the actual pointer gesture (dragging the card across
  the divider or release line) and asserts the resulting derived type/release,
  rather than assuming the classification

### Requirement: Declarative feature files, mechanics in step definitions

Feature files SHALL describe user intent, not UI mechanics: they SHALL contain no
selectors, coordinates, or raw geometry constants. All selector and pointer-gesture
detail SHALL live in step definitions and support helpers. Canvas gestures SHALL be
resolved from live DOM geometry (element bounding boxes and positions), not from
application layout constants duplicated into the test code.

#### Scenario: No selectors in feature files

- **WHEN** a feature file is written
- **THEN** it expresses actions and outcomes in domain language with no selectors,
  pixel coordinates, or layout constants

#### Scenario: Gestures use live geometry

- **WHEN** a step drags a card, divider, or release line
- **THEN** the target position is computed from live DOM element geometry, and the
  test code contains no copy of the app's slot-width or rail geometry constants
