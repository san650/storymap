Feature: Reset and clear
  As a facilitator
  I want to restore the example or empty the board

  Background:
    Given I open the app

  Scenario: Restoring the example replaces the board
    When I rename the map title to "My edits"
    And I open "Restore example" from the menu
    And I confirm the dialog
    Then the map title should be "Untitled Story Map" in storage
    And the board should have 23 stickies in storage

  Scenario: Emptying the board clears everything
    When I open "Empty board" from the menu
    And I confirm the dialog
    Then the board should have 0 columns in storage
    And the board should have 0 stickies in storage

  Scenario: Cancelling empty board keeps the map
    When I open "Empty board" from the menu
    And I cancel the dialog
    Then the board should have 5 columns in storage
