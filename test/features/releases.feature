Feature: Release lines
  As a facilitator
  I want to slice the story map into releases

  Background:
    Given I open the app

  Scenario: A story's release follows the line it sits under
    Given the sticky "k-s1" is in release "rel-1" in storage
    When I drag the sticky "k-s1" below the release "rel-1"
    Then the sticky "k-s1" should be in release "rel-2" in storage

  Scenario: Adding a release line
    When I add a release line
    Then the board should have 3 release lines in storage

  Scenario: Renaming a release line
    When I rename the release "rel-1" to "Beta"
    Then the release "rel-1" should be labeled "Beta" in storage

  Scenario: Deleting a release line
    When I delete the release "rel-2"
    Then the board should not contain the release "rel-2" in storage
