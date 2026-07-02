Feature: Stickies
  As a facilitator
  I want to add, edit, and remove sticky notes

  Background:
    Given I open the app

  Scenario: Creating a sticky
    When I create a sticky in "col-discover"
    Then "col-discover" should have 5 stickies in storage

  Scenario: Editing a sticky's text
    When I create a sticky in "col-discover"
    And I set that sticky's text to "Password reset"
    Then that sticky should read "Password reset" in storage

  Scenario: Deleting a sticky
    When I create a sticky in "col-discover"
    And I delete that sticky
    Then that sticky should be gone from storage
