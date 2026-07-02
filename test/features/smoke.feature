@smoke
Feature: The app boots
  As a facilitator
  I want the story map to open with its example content

  Scenario: The seed map renders
    Given I open the app
    Then I should see "Discover"
    And I should see "Sign up"
    And the board should have 5 columns in storage
    And the board should have 23 stickies in storage
