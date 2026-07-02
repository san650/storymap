Feature: Export and import
  As a facilitator
  I want to save my map as text and load it back

  Background:
    Given I open the app

  Scenario: Exporting JSON shows a re-importable document
    When I open the export panel
    Then the export text should contain "storymap"
    And the export text should contain "Untitled Story Map"

  Scenario: Exporting Markdown lists the backbone
    When I open the export panel
    And I switch the export format to Markdown
    Then the export text should contain "## Backbone"

  Scenario: Importing a map replaces the board
    When I import a map titled "Imported map" with a single column "Only"
    And I confirm the dialog
    Then the map title should be "Imported map" in storage
    And the board should have 1 column in storage
