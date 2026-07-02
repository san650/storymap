Feature: Story maps
  As a facilitator
  I want to keep several independent story maps

  Background:
    Given I open the app

  Scenario: Creating a new story map
    When I open the story maps panel
    And I create a new story map
    Then there should be 2 story maps in storage

  Scenario: The new map starts from the fresh example
    When I rename the map title to "First map"
    And I open the story maps panel
    And I create a new story map
    Then the map title should be "Untitled Story Map" in storage

  Scenario: Deleting a story map
    When I open the story maps panel
    And I create a new story map
    And I open the story maps panel
    And I delete the first listed story map
    And I confirm the dialog
    Then there should be 1 story map in storage
