## ADDED Requirements

### Requirement: Story cards carry an optional color override

A story card SHALL support an optional `color` field holding a story-palette token. The allowed values are `null` (default green/mint), `'sky'`, and `'lilac'`. Flow and epic cards SHALL NOT expose a color override; their fill remains derived from the band. The `color` field SHALL be optional in state — its absence is equivalent to `null`.

#### Scenario: New story defaults to green
- **WHEN** a new card is created in the story band
- **THEN** it has no color override (`color` absent or `null`)
- **AND** it renders with the default green/mint fill

#### Scenario: Existing maps without a color field
- **WHEN** a map or export created before this feature is loaded
- **THEN** every story card renders with the default green fill
- **AND** no error is raised over the missing field

### Requirement: Story color is chosen from a swatch picker while editing

While a story card is in the editing state, the system SHALL display a swatch picker offering exactly three choices: green (default), sky, and lilac. Selecting a swatch SHALL commit the choice immediately (commit-on-click). The picker SHALL NOT be shown while editing a flow or epic card.

#### Scenario: Picker shown only for stories
- **WHEN** the user opens a story card for editing
- **THEN** a 3-swatch color picker (green, sky, lilac) is visible on the card
- **WHEN** the user opens a flow or epic card for editing
- **THEN** no color picker is shown

#### Scenario: Selecting a non-default color
- **WHEN** the user clicks the sky swatch on a story card being edited
- **THEN** the card's `color` is set to `'sky'`
- **AND** the card immediately renders with the sky fill

#### Scenario: Selecting green clears the override
- **WHEN** a story card has `color = 'lilac'` and the user clicks the green swatch
- **THEN** the card's `color` is set to `null`
- **AND** the card renders with the default green fill

#### Scenario: The active color is indicated
- **WHEN** a story card being edited has `color = 'sky'`
- **THEN** the sky swatch is shown as the currently selected swatch

### Requirement: Color is inert outside the story band

A stored color token SHALL only affect display while the card is a story (its `y` is below the epic/story divider). In any other band the card SHALL render the band-derived color, and the stored token SHALL be preserved rather than cleared.

#### Scenario: Colored story dragged into the epic band
- **WHEN** a story card with `color = 'sky'` is dragged upward until it becomes an epic
- **THEN** it renders with the amber (epic) fill, not sky
- **AND** its stored `color` remains `'sky'`

#### Scenario: Dragged back into the story band
- **WHEN** that same card is dragged back down into the story band
- **THEN** it renders with the sky fill again

#### Scenario: Fill updates live while crossing the divider mid-drag
- **WHEN** a card with `color = 'sky'` is dragged across the epic/story divider
- **THEN** its fill switches between the sky (story side) and amber (epic side) as the cursor crosses the divider, without releasing the drag

### Requirement: Color changes go through the command pipeline

Setting a story card's color SHALL be dispatched as a single `SET_CARD_COLOR` command through `store.dispatch`, so it participates in undo/redo, coalescing, the action log, and persistence like every other mutation. Selecting the color a card already has SHALL be a no-op that produces no history entry.

#### Scenario: Undo reverts a color change
- **WHEN** the user changes a story from green to lilac and then triggers undo
- **THEN** the story returns to green

#### Scenario: Redo re-applies a color change
- **WHEN** the user undoes a color change and then triggers redo
- **THEN** the color change is re-applied

#### Scenario: Re-selecting the current color is a no-op
- **WHEN** the user clicks the swatch matching the card's current color
- **THEN** no new history entry is created

### Requirement: Color persists through export and import

The `color` field SHALL be included in JSON export and preserved on import, validated against the allowed token set (`null` | `'sky'` | `'lilac'`); an unrecognized value SHALL normalize to `null`. The Markdown export and the derived `flow`/`epic`/`story` meta-label SHALL be unchanged by this feature.

#### Scenario: JSON round-trip
- **WHEN** a map with a sky story and a lilac story is exported to JSON and re-imported
- **THEN** both stories retain their respective colors

#### Scenario: Invalid color token on import
- **WHEN** an imported JSON contains a story with `color = 'chartreuse'`
- **THEN** that story is normalized to the default green (`color = null`)

#### Scenario: Markdown export unaffected
- **WHEN** a map with colored stories is exported to Markdown
- **THEN** the Markdown output is identical to what it would be with no colors
