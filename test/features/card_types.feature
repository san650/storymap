Feature: A sticky's type follows its band
  As a facilitator
  I want a sticky's type to change when I drag it into another band

  Background:
    Given I open the app

  Scenario: Dragging a flow sticky down into the story band
    Given the sticky "k-f1" is a "flow" in storage
    When I drag the sticky "k-f1" into the story band
    Then the sticky "k-f1" should be a "story" in storage

  Scenario: Dragging a story sticky up into the flow band
    Given the sticky "k-s1" is a "story" in storage
    When I drag the sticky "k-s1" into the flow band
    Then the sticky "k-s1" should be a "flow" in storage

  Scenario: Dragging a story sticky up into the epic band
    Given the sticky "k-s1" is a "story" in storage
    When I drag the sticky "k-s1" into the epic band
    Then the sticky "k-s1" should be a "epic" in storage
