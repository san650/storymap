# story-hover-expand Specification

## Purpose

Let clamped story cards reveal their full text on mouse hover. When a story card's text is truncated to 5 lines, resting the pointer on it expands the card downward to show everything, then collapses on leave. The affordance is mouse-only, ephemeral display state — it never mutates, persists, or exports card data, and it yields to editing, dragging, and panning.

## Requirements

### Requirement: Clamped story cards expand on mouse hover

When a mouse pointer hovers a story card whose text is clamped (more than 5 wrapped lines), the system SHALL expand the card to its full, uncapped height and reveal all of its text. The expansion SHALL be animated and SHALL leave the card's top edge fixed (the card grows downward). Cards that are not stories, and story cards whose text fits within 5 lines, SHALL NOT expand.

#### Scenario: Long story reveals full text on hover
- **WHEN** the mouse hovers a story card whose text exceeds 5 lines
- **THEN** the card grows to show all of its text
- **AND** its top edge stays in place while it grows downward

#### Scenario: Short story does not change on hover
- **WHEN** the mouse hovers a story card whose text fits within 5 lines
- **THEN** the card does not change height and no text was hidden to reveal

#### Scenario: Flow and epic cards do not expand
- **WHEN** the mouse hovers a flow or epic card
- **THEN** the card does not expand

### Requirement: Expansion waits for hover intent and collapses immediately

Expansion SHALL trigger only after the pointer has rested on the card for a short hover-intent delay (~150 ms). If the pointer leaves before the delay elapses, the card SHALL NOT expand. When the pointer leaves an expanded card, it SHALL collapse back to its 5-line height immediately.

#### Scenario: Brief fly-over does not expand
- **WHEN** the mouse passes over a clamped story card and leaves before the hover-intent delay elapses
- **THEN** the card never expands

#### Scenario: Collapse on leave
- **WHEN** the pointer leaves a story card that has expanded
- **THEN** the card returns to its 5-line height

### Requirement: Expansion is a mouse-only, non-persistent affordance

Hover-expand SHALL apply only to hover-capable mouse input; touch and pen input SHALL NOT trigger it, and on devices without hover the behavior SHALL be absent. Expansion SHALL be ephemeral UI state only — it SHALL NOT be dispatched as a command, SHALL NOT participate in undo/redo, and SHALL NOT be persisted or exported. The stored card data SHALL be unchanged by expanding or collapsing.

#### Scenario: Touch input does not expand
- **WHEN** a story card is touched on a device without hover
- **THEN** the card does not hover-expand
- **AND** double-tap-to-edit remains the way to view full content

#### Scenario: Expansion leaves no history entry
- **WHEN** a story card expands on hover and then collapses
- **THEN** no undo/redo history entry is created
- **AND** the card's stored data is unchanged

### Requirement: Expansion yields to editing, dragging, and panning

Hover-expand SHALL NOT interfere with the card's other interactions. It SHALL NOT expand a card that is being edited, dragged, or while the canvas is being panned, and starting a drag or an edit on an expanded card SHALL collapse it before that interaction proceeds.

#### Scenario: Editing is unaffected
- **WHEN** a story card is opened for editing
- **THEN** hover-expand does not additionally alter its height beyond the editing layout

#### Scenario: Starting a drag collapses a hovered-open card
- **WHEN** a story card has expanded on hover and the user begins dragging it
- **THEN** the card collapses and the drag proceeds with the normal (capped) drag height

#### Scenario: Overlapping neighbours are not displaced
- **WHEN** a clamped story card expands over the card beneath it
- **THEN** the expanded card renders above its neighbours
- **AND** no neighbouring card is moved
