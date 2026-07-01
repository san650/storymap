const findCard = (s, id) => s.cards.find((c) => c.id === id);
const findCol = (s, id) => s.columns.find((c) => c.id === id);
const findRel = (s, id) => s.releases.find((r) => r.id === id);
const sortReleases = (s) => { s.releases.sort((a, b) => a.y - b.y); };

export const COMMANDS = {
  SET_TITLE: {
    apply: (s, p) => { s.title = p.to; },
    revert: (s, p) => { s.title = p.from; },
    coalesceKey: () => 'title',
  },

  ADD_COLUMN: {
    apply: (s, p) => { s.columns.splice(p.atIndex, 0, p.column); },
    revert: (s, p) => { s.columns.splice(p.atIndex, 1); },
    coalesceKey: () => null,
  },
  REMOVE_COLUMN: {
    apply: (s, p) => {
      s.columns.splice(p.atIndex, 1);
      s.cards = s.cards.filter((c) => c.columnId !== p.column.id);
    },
    revert: (s, p) => {
      s.columns.splice(p.atIndex, 0, p.column);
      s.cards.push(...p.cards);
    },
    coalesceKey: () => null,
  },
  RENAME_COLUMN: {
    apply: (s, p) => { const c = findCol(s, p.id); if (c) c.label = p.to; },
    revert: (s, p) => { const c = findCol(s, p.id); if (c) c.label = p.from; },
    coalesceKey: (p) => `col:${p.id}`,
  },

  ADD_CARD: {
    apply: (s, p) => { s.cards.push(p.card); },
    revert: (s, p) => { s.cards = s.cards.filter((c) => c.id !== p.card.id); },
    coalesceKey: () => null,
  },
  REMOVE_CARD: {
    apply: (s, p) => { s.cards = s.cards.filter((c) => c.id !== p.card.id); },
    revert: (s, p) => { s.cards.push(p.card); },
    coalesceKey: () => null,
  },
  MOVE_CARD: {
    apply: (s, p) => {
      const c = findCard(s, p.id);
      if (!c) return;
      c.columnId = p.to.columnId;
      c.slot = p.to.slot ?? 0;
      c.y = p.to.y;
    },
    revert: (s, p) => {
      const c = findCard(s, p.id);
      if (!c) return;
      c.columnId = p.from.columnId;
      c.slot = p.from.slot ?? 0;
      c.y = p.from.y;
    },
    coalesceKey: (p) => `move:${p.id}`,
  },
  EDIT_CARD: {
    apply: (s, p) => { const c = findCard(s, p.id); if (c) c.text = p.to; },
    revert: (s, p) => { const c = findCard(s, p.id); if (c) c.text = p.from; },
    coalesceKey: (p) => `text:${p.id}`,
  },
  // Story-only color override. `to`/`from` are nullable tokens (null = default
  // green). See isNoOp: null on either side never coalesces to a no-op, and two
  // equal primitives (incl. re-picking the current color) correctly do.
  SET_CARD_COLOR: {
    apply: (s, p) => { const c = findCard(s, p.id); if (c) c.color = p.to; },
    revert: (s, p) => { const c = findCard(s, p.id); if (c) c.color = p.from; },
    coalesceKey: (p) => `color:${p.id}`,
  },

  ADD_RELEASE: {
    apply: (s, p) => { s.releases.push(p.release); sortReleases(s); },
    revert: (s, p) => { s.releases = s.releases.filter((r) => r.id !== p.release.id); },
    coalesceKey: () => null,
  },
  REMOVE_RELEASE: {
    apply: (s, p) => { s.releases = s.releases.filter((r) => r.id !== p.release.id); },
    revert: (s, p) => { s.releases.push(p.release); sortReleases(s); },
    coalesceKey: () => null,
  },
  MOVE_RELEASE: {
    apply: (s, p) => {
      const r = findRel(s, p.id);
      if (!r) return;
      r.y = p.to;
      sortReleases(s);
    },
    revert: (s, p) => {
      const r = findRel(s, p.id);
      if (!r) return;
      r.y = p.from;
      sortReleases(s);
    },
    coalesceKey: (p) => `rel:${p.id}`,
  },
  RENAME_RELEASE: {
    apply: (s, p) => { const r = findRel(s, p.id); if (r) r.label = p.to; },
    revert: (s, p) => { const r = findRel(s, p.id); if (r) r.label = p.from; },
    coalesceKey: (p) => `reltext:${p.id}`,
  },

  MOVE_DIVIDER: {
    apply: (s, p) => { s[p.key] = p.to; },
    revert: (s, p) => { s[p.key] = p.from; },
    coalesceKey: (p) => `div:${p.key}`,
  },
};

export const makeCommand = (type, payload) => ({ type, payload });

export const coalesceKeyOf = (cmd) => {
  const k = COMMANDS[cmd.type].coalesceKey(cmd.payload);
  return k ? `${cmd.type}:${k}` : null;
};

// A no-op iff both `from` and `to` are primitives and equal. Add/remove
// commands carry an opaque object payload (`card`, `column`, `release`) and
// either `from` or `to` set to null, which is never a no-op by this rule.
export const isNoOp = (cmd) => {
  const p = cmd.payload;
  if (!('from' in p) || !('to' in p)) return false;
  if (p.from === null || p.to === null) return false;
  if (typeof p.from === 'object' || typeof p.to === 'object') return false;
  return p.from === p.to;
};
