Feature: Columns
  As a facilitator
  I want to manage the activity columns of the backbone

  Background:
    Given I open the app

  Scenario: Adding a column
    When I add a column
    Then the board should have 6 columns in storage

  Scenario: Renaming a column
    When I rename the column "col-discover" to "Awareness"
    Then the column "col-discover" should be labeled "Awareness" in storage

  Scenario: Deleting a column removes its stickies
    When I delete the column "col-signup"
    And I confirm the dialog
    Then the board should not contain the column "col-signup" in storage
    And "col-signup" should have 0 stickies in storage
