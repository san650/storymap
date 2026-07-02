# Boot, generic assertions, menu, dialogs, undo/redo -------------------------

MENU = {
  'Story maps'      => 'sessions',
  'Export'          => 'export',
  'Import'          => 'import',
  'Activity log'    => 'show-log',
  'Restore example' => 'reset',
  'Empty board'     => 'clear',
}.freeze

module AppWorld
  # Open the topbar kebab menu (its items are hidden until toggled).
  def open_menu
    click('.kebab-toggle')
    wait_for('.kebab-menu:not([hidden]) [data-action="sessions"]')
  end

  # Poll a block until it returns truthy or the timeout elapses.
  def wait_until(timeout: 5)
    deadline = Time.now + timeout
    loop do
      return true if yield
      break if Time.now > deadline
      sleep 0.05
    end
    false
  end
end

Given('I open the app') { open_app }

When('I open {string} from the menu') do |label|
  open_menu
  click(%([data-action="#{MENU.fetch(label)}"]))
end

When('I undo') { click('[data-action="undo"]') }
When('I redo') { click('[data-action="redo"]') }
When('I press undo on the keyboard') { @page.keyboard.press('Control+z') }
When('I press redo on the keyboard') { @page.keyboard.press('Control+Shift+z') }

When('I confirm the dialog') do
  wait_for(data_test('confirm-modal'))
  click('[data-modal-action="confirm"]')
end

When('I cancel the dialog') do
  wait_for(data_test('confirm-modal'))
  click('[data-modal-action="cancel"]')
end

Then('I should see {string}') do |text|
  ok = wait_until { has_text?(text) }
  expect(ok).to be(true), %(expected the page to show "#{text}")
end

Then('I should not see {string}') do |text|
  expect(has_text?(text)).to be(false), %(expected the page NOT to show "#{text}")
end

# Board-shape assertions (read from the persisted document) -------------------

Then('the board should have {int} column(s) in storage') do |n|
  doc = wait_doc { |d| d && d['columns'].length == n }
  expect(doc['columns'].length).to eq(n)
end

Then('the board should have {int} stickies in storage') do |n|
  doc = wait_doc { |d| d && d['cards'].length == n }
  expect(doc['cards'].length).to eq(n)
end

Then('{string} should have {int} stickies in storage') do |col_id, n|
  doc = wait_doc { |d| d && d['cards'].count { |c| c['columnId'] == col_id } == n }
  expect(doc['cards'].count { |c| c['columnId'] == col_id }).to eq(n)
end
