Feature: Story color coding
  As a facilitator
  I want to tag individual story stickies with a color

  Background:
    Given I open the app

  Scenario: Coloring a story sky
    When I color the story "k-s1" "sky"
    Then the sticky "k-s1" should have color "sky" in storage
    And the sticky "k-s1" should render with the "sky" color

  Scenario: Clearing a story's color
    When I color the story "k-s1" "sky"
    And I color the story "k-s1" "green"
    Then the sticky "k-s1" should have no color in storage

  Scenario: Flow and epic stickies have no color picker
    When I open the sticky "k-f1" for editing
    Then no color picker should be shown
    When I open the sticky "k-e1" for editing
    Then no color picker should be shown
