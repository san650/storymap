# Cucumber + Playwright support for the Storymap e2e suite.
#
# Browser automation talks to a standalone Playwright browser server. The
# `run.rb` entrypoint boots it and passes its ws endpoint in via PLAYWRIGHT_WS.
# To run by hand instead:
#
#   npx playwright install chromium
#   npx playwright launch-server --browser chromium   # copy the ws:// endpoint
#   PLAYWRIGHT_WS=ws://… bundle exec cucumber
#
# The suite serves docs/ (the deployable app) over WEBrick and runs each scenario
# in a fresh browser context (empty IndexedDB → the app seeds itself, so the seed
# is every scenario's starting state).

require 'rspec/expectations'
require 'playwright'
require 'webrick'
require 'socket'

# ---------------------------------------------------------------------------
# Static server over docs/ (the deployable app), on a free port.
# ---------------------------------------------------------------------------

DOCS_DIR = File.expand_path('../../../../docs', __FILE__)

def free_port
  s = TCPServer.new('127.0.0.1', 0)
  port = s.addr[1]
  s.close
  port
end

APP_PORT = free_port
APP_BASE = "http://127.0.0.1:#{APP_PORT}"

mime = WEBrick::HTTPUtils::DefaultMimeTypes.dup
mime['js'] = 'text/javascript'
mime['mjs'] = 'text/javascript'
mime['json'] = 'application/json'
mime['svg'] = 'image/svg+xml'
mime['webmanifest'] = 'application/manifest+json'

WEBRICK = WEBrick::HTTPServer.new(
  BindAddress: '127.0.0.1',
  Port: APP_PORT,
  DocumentRoot: DOCS_DIR,
  MimeTypes: mime,
  Logger: WEBrick::Log.new(File::NULL),
  AccessLog: [],
)
Thread.new { WEBRICK.start }
at_exit { WEBRICK.shutdown }

# ---------------------------------------------------------------------------
# Playwright connection (kept alive across scenarios). `connect_to_browser_server`
# is block-scoped, so a worker thread holds the block open until the suite ends.
# The endpoint is printed by `npx playwright launch-server` and passed in via
# PLAYWRIGHT_WS (run.rb wires this up automatically).
# ---------------------------------------------------------------------------

WS_ENDPOINT = ENV.fetch('PLAYWRIGHT_WS') do
  abort('PLAYWRIGHT_WS is not set. Run via `ruby run.rb`, or start ' \
        '`npx playwright launch-server --browser chromium` and export its ws endpoint.')
end

_ready = Queue.new
$_pw_shutdown = Queue.new

Thread.new do
  begin
    Playwright.connect_to_browser_server(WS_ENDPOINT) do |browser|
      _ready << browser
      $_pw_shutdown.pop # block until the suite finishes
    end
  rescue => e
    _ready << e
  end
end

BROWSER = _ready.pop
if BROWSER.is_a?(Exception)
  warn <<~MSG
    Could not connect to the Playwright browser server at #{WS_ENDPOINT}.
    Start it with:  npx playwright install chromium && npx playwright launch-server --browser chromium
    (#{BROWSER.class}: #{BROWSER.message})
  MSG
  exit 2
end

at_exit { $_pw_shutdown << :stop }

# ---------------------------------------------------------------------------
# World: per-scenario page + app-driving helpers.
# ---------------------------------------------------------------------------

module AppWorld
  attr_reader :page

  # -- boot / navigation -----------------------------------------------------

  # Load the app and wait until the first render has run. Storymap is a single
  # screen with no routing, so every scenario just opens index.html; a fresh
  # context means empty storage, so the seed renders (columns + cards present).
  def open_app
    @page.goto("#{APP_BASE}/index.html")
    @page.wait_for_selector('.topbar', timeout: 10_000)
    @page.wait_for_selector('#canvas .col-bg', timeout: 10_000)
    @page
  end

  def wait_for(selector, timeout: 8_000)
    @page.wait_for_selector(selector, timeout: timeout)
  end

  def click(selector)
    @page.click(selector)
  end

  def count(selector)
    @page.query_selector_all(selector).length
  end

  def visible?(selector)
    !@page.query_selector(selector).nil?
  end

  def data_test(value)
    %([data-test-id="#{value}"])
  end

  def body_text
    @page.evaluate('() => document.body.innerText')
  end

  # Case-insensitive: some UI text is uppercased via CSS, which innerText
  # reflects, so we compare case-folded.
  def has_text?(str)
    body_text.downcase.include?(str.downcase)
  end

  # -- storage (the assertion oracle) ---------------------------------------

  # The active session's document, read straight from IndexedDB. Storymap keeps
  # a list of sessions: an `index` record points at the active one, whose heavy
  # record holds `{ id, state, history }`. We resolve index → activeId → state.
  def app_doc
    @page.evaluate(<<~JS)
      () => new Promise((resolve) => {
        const req = indexedDB.open('storymap');
        req.onsuccess = () => {
          const os = req.result.transaction('sessions', 'readonly').objectStore('sessions');
          const ix = os.get('index');
          ix.onsuccess = () => {
            const activeId = ix.result && ix.result.activeId;
            if (!activeId) return resolve(null);
            const rec = os.get(activeId);
            rec.onsuccess = () => resolve(rec.result ? rec.result.state : null);
            rec.onerror = () => resolve(null);
          };
          ix.onerror = () => resolve(null);
        };
        req.onerror = () => resolve(null);
      })
    JS
  end

  # Persistence is async after a dispatch — poll the doc until `block` holds (or
  # timeout), returning the last-read doc for the assertion to inspect.
  def wait_doc(timeout: 5)
    deadline = Time.now + timeout
    last = app_doc
    until block_given? && yield(last)
      break if Time.now > deadline
      sleep 0.1
      last = app_doc
    end
    last
  end

  def card(doc, id)
    (doc['cards'] || []).find { |c| c['id'] == id }
  end

  def column(doc, id)
    (doc['columns'] || []).find { |c| c['id'] == id }
  end

  def release(doc, id)
    (doc['releases'] || []).find { |r| r['id'] == id }
  end

  # Card type is DERIVED from y against the two zone dividers (never stored).
  def type_of(doc, card_id)
    c = card(doc, card_id)
    return nil unless c
    return 'flow' if c['y'] < doc['flowEpicY']
    return 'epic' if c['y'] < doc['epicStoryY']
    'story'
  end

  # Card release is DERIVED from y against the (y-sorted) release lines; a card
  # past the last line is in the backlog (returns nil). Returns the release id.
  def release_of(doc, card_id)
    c = card(doc, card_id)
    return nil unless c
    lines = (doc['releases'] || []).sort_by { |r| r['y'] }
    line = lines.find { |r| c['y'] < r['y'] }
    line && line['id']
  end

  # -- geometry (live DOM, never app constants) ------------------------------
  #
  # Every gesture resolves its target from live element boxes so the tests never
  # duplicate SLOT_W / LEFT_RAIL / divider math from view.js.

  def box(selector)
    el = @page.query_selector(selector)
    raise "no element for #{selector}" unless el
    el.bounding_box
  end

  # Viewport x at the horizontal centre of a column (its col-bg track).
  def col_center_x(col_id)
    b = box(%(.col-bg[data-col-id="#{col_id}"]))
    b['x'] + b['width'] / 2.0
  end

  # Viewport y of a zone divider's line ('flowEpicY' | 'epicStoryY').
  def divider_view_y(key)
    b = box(%([data-divider="#{key}"]))
    b['y'] + b['height'] / 2.0
  end

  # Viewport y of a release line.
  def release_view_y(id)
    b = box(%(.release-line[data-release-id="#{id}"]))
    b['y'] + b['height'] / 2.0
  end

  # A card-free viewport y inside a band, derived from the live divider lines.
  # :flow above flowEpicY, :epic between the dividers, :story just below
  # epicStoryY. Used as drop targets and empty-canvas click points.
  def band_view_y(band)
    fe = divider_view_y('flowEpicY')
    es = divider_view_y('epicStoryY')
    case band
    when :flow  then fe - 40
    when :epic  then (fe + es) / 2.0
    when :story then es + 40
    else raise "unknown band #{band}"
    end
  end

  # -- gestures --------------------------------------------------------------

  # Blur whatever contenteditable is focused (commit-on-blur) by clicking a inert
  # chrome element outside the canvas.
  def blur_edit
    @page.click('.legend')
  end

  # Double-click empty canvas in a column's band to create a sticky, returning
  # its new data-card-id. The band overlays are pointer-events:none, so the
  # dblclick lands on the canvas; onCanvasDblClick creates the card and opens it
  # for editing. Pass an empty column (see `add a column`) to guarantee free space.
  def create_sticky(col_id, band: :story)
    before = card_ids
    x = col_center_x(col_id)
    y = band_view_y(band)
    @page.mouse.dblclick(x, y)
    new_id = nil
    20.times do
      new_id = (card_ids - before).first
      break if new_id
      sleep 0.05
    end
    raise 'no sticky was created' unless new_id
    blur_edit # leave the fresh (empty) card's edit mode
    new_id
  end

  # Set a sticky's text: open it (dblclick), replace the contenteditable content,
  # then blur to commit (the app commits card text on blur, reading innerText).
  def set_sticky_text(id, text)
    sel = %([data-card-id="#{id}"])
    @page.dblclick(sel)
    @page.fill(%(#{sel} .text), text)
    blur_edit
    wait_doc { |d| (c = card(d, id)) && c['text'] == text }
  end

  # Drag a sticky. Target is expressed relatively and resolved from live boxes:
  #   to_col:  land in this column (changes columnId)
  #   to_band: land in this band  (:flow/:epic/:story — changes derived type)
  #   below_release: land just under this release line (changes derived release)
  # Any axis left nil keeps the card's current position on that axis.
  def drag_sticky(id, to_col: nil, to_band: nil, below_release: nil)
    b = box(%([data-card-id="#{id}"]))
    sx = b['x'] + b['width'] / 2.0
    sy = b['y'] + b['height'] / 2.0
    tx = to_col ? col_center_x(to_col) : sx
    ty = if to_band
           band_view_y(to_band)
         elsif below_release
           release_view_y(below_release) + 40
         else
           sy
         end
    @page.mouse.move(sx, sy)
    @page.mouse.down
    @page.mouse.move((sx + tx) / 2.0, (sy + ty) / 2.0, steps: 6) # clear the 5px threshold
    @page.mouse.move(tx, ty, steps: 6)
    @page.mouse.up
  end

  # Drag a zone divider by dy pixels. Grabbed in the left rail (x ≈ box.x + 60),
  # which is card-free, so the grab never lands on a sticky.
  def drag_divider(key, dy)
    b = box(%([data-divider="#{key}"]))
    sx = b['x'] + 60
    sy = b['y'] + b['height'] / 2.0
    @page.mouse.move(sx, sy)
    @page.mouse.down
    @page.mouse.move(sx, sy + dy, steps: 6)
    @page.mouse.up
  end

  # Drag a release line by dy pixels (grabbed in the card-free left rail).
  def drag_release(id, dy)
    b = box(%(.release-line[data-release-id="#{id}"]))
    sx = b['x'] + 60
    sy = b['y'] + b['height'] / 2.0
    @page.mouse.move(sx, sy)
    @page.mouse.down
    @page.mouse.move(sx, sy + dy, steps: 6)
    @page.mouse.up
  end

  # Set a contenteditable label/title by selector: focus, replace, blur to commit.
  def set_editable(selector, text)
    @page.dblclick(selector)
    @page.fill(selector, text)
    blur_edit
  end

  def card_ids
    @page.eval_on_selector_all(
      '#canvas [data-card-id]',
      '(els) => els.map((e) => e.getAttribute("data-card-id"))',
    )
  end
end

World(RSpec::Matchers)
World(AppWorld)

# Fresh, isolated browser context per scenario → empty storage → app seeds. A
# tall viewport keeps the seed's zone dividers and release lines on-screen so
# their live boxes are reachable by the pointer.
Before do
  @context = BROWSER.new_context(viewport: { 'width' => 1600, 'height' => 1400 })
  @page = @context.new_page
end

After do
  @context&.close
end
