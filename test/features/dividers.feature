Feature: Moving a zone divider reclassifies stickies
  As a facilitator
  I want to redraw the band boundaries and have stickies re-typed

  Background:
    Given I open the app

  Scenario: Raising the epics/stories divider turns an epic into a story
    Given the sticky "k-e1" is a "epic" in storage
    When I drag the "epicStoryY" divider up by 180 pixels
    Then the sticky "k-e1" should be a "story" in storage

  Scenario: Lowering the epics/stories divider turns a story into an epic
    Given the sticky "k-s1" is a "story" in storage
    When I drag the "epicStoryY" divider down by 140 pixels
    Then the sticky "k-s1" should be a "epic" in storage

  Scenario: The flows/epics divider position persists
    When I drag the "flowEpicY" divider down by 120 pixels
    Then the "flowEpicY" divider should be at 320 in storage
