require 'json'

# Sessions, export, import, and the activity log.

module AppWorld
  # The session index record: { activeId, sessions: [{ id, title, … }] }.
  def session_index
    @page.evaluate(<<~JS)
      () => new Promise((resolve) => {
        const req = indexedDB.open('storymap');
        req.onsuccess = () => {
          const os = req.result.transaction('sessions', 'readonly').objectStore('sessions');
          const ix = os.get('index');
          ix.onsuccess = () => resolve(ix.result || null);
          ix.onerror = () => resolve(null);
        };
        req.onerror = () => resolve(null);
      })
    JS
  end

  def io_text
    @page.eval_on_selector('.modal-sheet-io .io-text', '(el) => el.value')
  end
end

# Sessions --------------------------------------------------------------------

When('I open the story maps panel') do
  open_menu
  click('[data-action="sessions"]')
  wait_for(data_test('sessions-modal'))
end

When('I create a new story map') do
  click(data_test('session-new'))
end

Then('there should be {int} story map(s) in storage') do |n|
  ok = wait_until { (ix = session_index) && ix['sessions'].length == n }
  expect(ok).to be(true), %(expected #{n} story maps in the index)
end

When('I delete the first listed story map') do
  wait_for(data_test('session-row'))
  row = @page.query_selector_all(data_test('session-row')).first
  row.query_selector(data_test('session-delete')).click
end

# Export ----------------------------------------------------------------------

When('I open the export panel') do
  open_menu
  click('[data-action="export"]')
  wait_for(data_test('export-modal'))
end

When('I switch the export format to Markdown') do
  tab = @page.query_selector_all('.io-tab').find { |t| t.inner_text.strip == 'Markdown' }
  raise 'no Markdown tab' unless tab
  tab.click
end

Then('the export text should contain {string}') do |text|
  ok = wait_until { io_text.include?(text) }
  expect(ok).to be(true), %(expected export text to contain "#{text}")
end

# Import ----------------------------------------------------------------------

When('I import a map titled {string} with a single column {string}') do |title, col_label|
  payload = {
    app: 'storymap', version: 1,
    state: {
      title: title,
      columns: [{ id: 'col-only', label: col_label }],
      flowEpicY: 200, epicStoryY: 460, releases: [], cards: [],
    },
  }
  open_menu
  click('[data-action="import"]')
  wait_for(data_test('import-modal'))
  @page.fill('.modal-sheet-io .io-text', payload.to_json)
  @page.click('.modal-sheet-io .btn-dark') # the "Import" button
end

# Activity log ----------------------------------------------------------------

When('I open the activity log') do
  open_menu
  click('[data-action="show-log"]')
  wait_for(data_test('log-modal'))
end

Then('the log should mention {string}') do |text|
  txt = @page.eval_on_selector(data_test('log-modal'), '(el) => el.innerText')
  expect(txt.downcase).to include(text.downcase)
end
