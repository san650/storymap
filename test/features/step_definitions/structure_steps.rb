# Title, columns, zone dividers, and release lines.

# Title -----------------------------------------------------------------------

When('I rename the map title to {string}') do |title|
  set_editable('.title', title)
end

Then('the map title should be {string} in storage') do |title|
  doc = wait_doc { |d| d && d['title'] == title }
  expect(doc['title']).to eq(title)
end

# Columns ---------------------------------------------------------------------

When('I add a column') do
  click('[data-action="add-column"]')
  blur_edit # the new column steals focus for its label; drop it
end

When('I rename the column {string} to {string}') do |col_id, name|
  set_editable(%(.column-header[data-col-id="#{col_id}"] .label), name)
end

Then('the column {string} should be labeled {string} in storage') do |col_id, name|
  doc = wait_doc { |d| (c = column(d, col_id)) && c['label'] == name }
  expect(column(doc, col_id)['label']).to eq(name)
end

When('I delete the column {string}') do |col_id|
  click(%(.column-header[data-col-id="#{col_id}"] .col-delete))
end

Then('the board should not contain the column {string} in storage') do |col_id|
  doc = wait_doc { |d| column(d, col_id).nil? }
  expect(column(doc, col_id)).to be_nil
end

# Zone dividers ---------------------------------------------------------------

When('I drag the {string} divider up by {int} pixels') do |key, px|
  drag_divider(key, -px)
end

When('I drag the {string} divider down by {int} pixels') do |key, px|
  drag_divider(key, px)
end

Then('the {string} divider should be at {int} in storage') do |key, y|
  doc = wait_doc { |d| d[key].round == y }
  expect(doc[key].round).to eq(y)
end

# Release lines ---------------------------------------------------------------

When('I add a release line') do
  click('[data-action="add-release"]')
end

Then('the board should have {int} release lines in storage') do |n|
  doc = wait_doc { |d| d && d['releases'].length == n }
  expect(doc['releases'].length).to eq(n)
end

When('I rename the release {string} to {string}') do |rel_id, name|
  set_editable(%(.release-tab[data-release-tab="#{rel_id}"] .label), name)
end

Then('the release {string} should be labeled {string} in storage') do |rel_id, name|
  doc = wait_doc { |d| (r = release(d, rel_id)) && r['label'] == name }
  expect(release(doc, rel_id)['label']).to eq(name)
end

When('I delete the release {string}') do |rel_id|
  click(%(.release-tab[data-release-tab="#{rel_id}"] .delete))
end

Then('the board should not contain the release {string} in storage') do |rel_id|
  doc = wait_doc { |d| release(d, rel_id).nil? }
  expect(release(doc, rel_id)).to be_nil
end
