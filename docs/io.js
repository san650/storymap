// Pure export / import helpers. No DOM, no store — just state in, text out
// (and text in, validated state out). Markdown is export-only and lossy;
// JSON round-trips the board exactly and is what `parseImport` accepts.

const typeOf = (y, s) =>
  y < s.flowEpicY ? 'flow' : y < s.epicStoryY ? 'epic' : 'story';

// Releases must be sorted by y. A story belongs to the first band whose
// release line sits below it; anything past the last line is Backlog.
const releaseIndexFor = (y, releases) => {
  for (let i = 0; i < releases.length; i++) {
    if (y < releases[i].y) return i;
  }
  return releases.length; // backlog
};

const byYThenSlot = (a, b) => (a.y - b.y) || ((a.slot || 0) - (b.slot || 0));

const oneLine = (t) => (t || '').replace(/\r?\n+/g, ' ').trim();
const cell = (t) => oneLine(t).replace(/\|/g, '\\|');

// ---------- JSON ----------

export const exportJSON = (state) =>
  JSON.stringify(
    { app: 'storymap', version: 1, exportedAt: new Date().toISOString(), state },
    null,
    2,
  );

const ensureId = (id, prefix) =>
  (typeof id === 'string' && id) ? id : `${prefix}-${Math.random().toString(36).slice(2, 9)}`;

const num = (v, fallback) => (Number.isFinite(+v) ? +v : fallback);

// Story-only color tokens; anything else (incl. absent) normalizes to the
// default green. Kept even on non-story cards — it's inert until the card is a
// story, and dropping it would lose color across a drag-through-another-band.
const COLOR_TOKENS = ['sky', 'lilac'];
const normalizeColor = (v) => (COLOR_TOKENS.includes(v) ? v : null);

const normalizeState = (s) => ({
  title: typeof s.title === 'string' && s.title.trim() ? s.title : 'Untitled Story Map',
  columns: s.columns.map((c) => ({
    id: ensureId(c?.id, 'col'),
    label: typeof c?.label === 'string' ? c.label : '',
  })),
  flowEpicY: num(s.flowEpicY, 200),
  epicStoryY: num(s.epicStoryY, 460),
  releases: s.releases.map((r) => ({
    id: ensureId(r?.id, 'rel'),
    label: typeof r?.label === 'string' ? r.label : 'Release',
    y: num(r?.y, 0),
  })),
  cards: s.cards.map((c) => ({
    id: ensureId(c?.id, 'k'),
    columnId: c?.columnId,
    slot: num(c?.slot, 0),
    y: num(c?.y, 40),
    text: typeof c?.text === 'string' ? c.text : '',
    color: normalizeColor(c?.color),
  })),
});

/**
 * Parse exported text (the wrapped `{app,version,state}` form or a bare state
 * object) and return a clean state. Throws an Error with a user-facing message
 * when the input isn't a usable story map.
 */
export const parseImport = (text) => {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('That isn’t valid JSON.');
  }
  const state = data && data.app === 'storymap' && data.state ? data.state : data;
  if (!state || typeof state !== 'object') throw new Error('Unexpected file contents.');
  if (!Array.isArray(state.columns)) throw new Error('Missing a “columns” list — is this a Storymap export?');
  if (!Array.isArray(state.cards)) throw new Error('Missing a “cards” list — is this a Storymap export?');
  if (!Array.isArray(state.releases)) throw new Error('Missing a “releases” list — is this a Storymap export?');
  return normalizeState(state);
};

// ---------- Markdown ----------

export const exportMarkdown = (state) => {
  const s = state;
  const releases = [...s.releases].sort((a, b) => a.y - b.y);
  const cols = s.columns;

  const pick = (colId, pred) =>
    s.cards
      .filter((c) => c.columnId === colId && pred(c) && oneLine(c.text))
      .sort(byYThenSlot);

  const out = [];
  out.push(`# ${oneLine(s.title) || 'Untitled Story Map'}`);
  out.push('');

  // Backbone — one row per activity, flows/epics joined with " / ".
  out.push('## Backbone');
  out.push('');
  out.push('| Activity | User flow | Epic |');
  out.push('|----------|-----------|------|');
  cols.forEach((col, i) => {
    const label = cell(col.label) || `Activity ${i + 1}`;
    const flows = pick(col.id, (c) => typeOf(c.y, s) === 'flow').map((c) => cell(c.text)).join(' / ');
    const epics = pick(col.id, (c) => typeOf(c.y, s) === 'epic').map((c) => cell(c.text)).join(' / ');
    out.push(`| ${label} | ${flows} | ${epics} |`);
  });
  out.push('');

  // One section per release band, then Backlog. Stories grouped by activity.
  const bands = releases.length + 1;
  for (let band = 0; band < bands; band++) {
    const isBacklog = band === releases.length;
    const heading = isBacklog ? 'Backlog' : (oneLine(releases[band].label) || `Release ${band + 1}`);
    out.push(`## ${heading}`);
    out.push('');

    let wrote = false;
    cols.forEach((col, i) => {
      const stories = pick(
        col.id,
        (c) => typeOf(c.y, s) === 'story' && releaseIndexFor(c.y, releases) === band,
      );
      if (!stories.length) return;
      wrote = true;
      out.push(`### ${oneLine(col.label) || `Activity ${i + 1}`}`);
      stories.forEach((c) => out.push(`- [ ] ${oneLine(c.text)}`));
      out.push('');
    });

    if (!wrote) {
      out.push('_No stories yet._');
      out.push('');
    }
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
};
