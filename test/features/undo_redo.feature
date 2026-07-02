Feature: Undo and redo
  As a facilitator
  I want to undo and redo my changes

  Background:
    Given I open the app

  Scenario: Undo reverts a rename and redo restores it
    When I rename the map title to "Version A"
    And I undo
    Then the map title should be "Untitled Story Map" in storage
    When I redo
    Then the map title should be "Version A" in storage

  Scenario: Undo with the keyboard
    When I rename the map title to "Keyboard edit"
    And I press undo on the keyboard
    Then the map title should be "Untitled Story Map" in storage
