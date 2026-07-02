Feature: Map title
  As a facilitator
  I want to name my story map

  Background:
    Given I open the app

  Scenario: Renaming the title persists
    When I rename the map title to "Checkout flow"
    Then the map title should be "Checkout flow" in storage
