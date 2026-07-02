Feature: Activity log
  As a facilitator
  I want to see a log of my recent actions

  Background:
    Given I open the app

  Scenario: The log lists a recent action
    When I rename the map title to "Logged change"
    And I open the activity log
    Then the log should mention "set title"

  Scenario: A fresh map's log is empty
    When I open the activity log
    Then I should see "No actions yet"
