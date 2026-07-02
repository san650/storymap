# Stickies: create / edit / delete / drag, plus the derived type & release.
# @card_id / @col_id carry the most recently created sticky across steps.

SWATCH_LABEL = { 'sky' => 'Sky blue', 'lilac' => 'Lilac', 'green' => 'Default green' }.freeze

When('I create a sticky in {string}') do |col_id|
  @col_id = col_id
  @card_id = create_sticky(col_id, band: :story)
end

When('I set that sticky\'s text to {string}') do |text|
  set_sticky_text(@card_id, text)
end

Then('that sticky should read {string} in storage') do |text|
  doc = wait_doc { |d| (c = card(d, @card_id)) && c['text'] == text }
  expect(card(doc, @card_id)['text']).to eq(text)
end

When('I delete that sticky') do
  @page.query_selector(%([data-card-id="#{@card_id}"] .delete)).click
end

Then('that sticky should be gone from storage') do
  doc = wait_doc { |d| card(d, @card_id).nil? }
  expect(card(doc, @card_id)).to be_nil
end

# Type derivation (drag across a zone divider) --------------------------------

Given('the sticky {string} is a {string} in storage') do |id, type|
  doc = app_doc
  expect(type_of(doc, id)).to eq(type)
end

Then('the sticky {string} should be a {string} in storage') do |id, type|
  doc = wait_doc { |d| type_of(d, id) == type }
  expect(type_of(doc, id)).to eq(type)
end

When('I drag the sticky {string} into the {word} band') do |id, band|
  drag_sticky(id, to_band: band.to_sym)
end

When('I drag the sticky {string} into {string}') do |id, col_id|
  drag_sticky(id, to_col: col_id)
end

Then('the sticky {string} should belong to {string} in storage') do |id, col_id|
  doc = wait_doc { |d| (c = card(d, id)) && c['columnId'] == col_id }
  expect(card(doc, id)['columnId']).to eq(col_id)
end

# Release derivation (drag below a release line) ------------------------------

Given('the sticky {string} is in release {string} in storage') do |id, rel_id|
  expect(release_of(app_doc, id)).to eq(rel_id)
end

When('I drag the sticky {string} below the release {string}') do |id, rel_id|
  drag_sticky(id, below_release: rel_id)
end

Then('the sticky {string} should be in release {string} in storage') do |id, rel_id|
  doc = wait_doc { |d| release_of(d, id) == rel_id }
  expect(release_of(doc, id)).to eq(rel_id)
end

# Story color coding ----------------------------------------------------------

When('I color the story {string} {string}') do |id, color|
  sel = %([data-card-id="#{id}"])
  @page.dblclick(sel)
  @page.click(%(#{sel} .swatch[aria-label="#{SWATCH_LABEL.fetch(color)}"]))
  blur_edit # color commits on blur
end

Then('the sticky {string} should have color {string} in storage') do |id, color|
  doc = wait_doc { |d| (c = card(d, id)) && c['color'] == color }
  expect(card(doc, id)['color']).to eq(color)
end

Then('the sticky {string} should have no color in storage') do |id|
  doc = wait_doc { |d| (c = card(d, id)) && c['color'].nil? }
  expect(card(doc, id)['color']).to be_nil
end

Then('the sticky {string} should render with the {string} color') do |id, color|
  expect(visible?(%([data-card-id="#{id}"].card-c-#{color}))).to be(true)
end

When('I open the sticky {string} for editing') do |id|
  @page.dblclick(%([data-card-id="#{id}"]))
  wait_for(%([data-card-id="#{id}"].editing))
end

Then('no color picker should be shown') do
  expect(visible?('.card.editing .color-picker')).to be(false)
end
