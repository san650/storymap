import { COMMANDS, isNoOp } from './commands.js';
import { History } from './history.js';
import {
  loadIndex,
  saveIndex,
  loadSession,
  saveSession,
  deleteSessionRecord,
  requestPersistence,
} from './db.js';

const uid = (prefix = 'sess') =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const seed = () => ({
  title: 'Untitled Story Map',
  columns: [
    { id: 'col-discover', label: 'Discover' },
    { id: 'col-signup', label: 'Sign up' },
    { id: 'col-onboard', label: 'Onboard' },
    { id: 'col-use', label: 'Use the core' },
    { id: 'col-share', label: 'Share' },
  ],
  flowEpicY: 200,
  epicStoryY: 460,
  releases: [
    { id: 'rel-1', label: 'Release 1 · MVP', y: 760 },
    { id: 'rel-2', label: 'Release 2 · Polish', y: 1080 },
  ],
  cards: [
    { id: 'k-f1', columnId: 'col-discover', slot: 0, y: 100, text: 'Hears about it' },
    { id: 'k-f2', columnId: 'col-signup',   slot: 0, y: 100, text: 'Creates account' },
    { id: 'k-f3', columnId: 'col-onboard',  slot: 0, y: 100, text: 'First-run tour' },
    { id: 'k-f4', columnId: 'col-use',      slot: 0, y: 100, text: 'Does the thing' },
    { id: 'k-f5', columnId: 'col-share',    slot: 0, y: 100, text: 'Tells someone' },

    { id: 'k-e1', columnId: 'col-discover', slot: 0, y: 330, text: 'Landing page' },
    { id: 'k-e2', columnId: 'col-signup',   slot: 0, y: 330, text: 'Account flow' },
    { id: 'k-e3', columnId: 'col-onboard',  slot: 0, y: 330, text: 'Empty-state UX' },
    { id: 'k-e4', columnId: 'col-use',      slot: 0, y: 330, text: 'Core workflow' },
    { id: 'k-e5', columnId: 'col-share',    slot: 0, y: 330, text: 'Outbound share' },

    { id: 'k-s1', columnId: 'col-discover', slot: 0, y: 560, text: 'Hero with CTA' },
    { id: 'k-s2', columnId: 'col-discover', slot: 0, y: 660, text: 'Pricing teaser' },
    { id: 'k-s3', columnId: 'col-signup',   slot: 0, y: 560, text: 'Email + password' },
    { id: 'k-s4', columnId: 'col-signup',   slot: 1, y: 560, text: 'Magic link login' },
    { id: 'k-s5', columnId: 'col-signup',   slot: 0, y: 660, text: 'Verify email' },
    { id: 'k-s6', columnId: 'col-onboard',  slot: 0, y: 560, text: 'Sample template' },
    { id: 'k-s7', columnId: 'col-use',      slot: 0, y: 560, text: 'Create item' },
    { id: 'k-s8', columnId: 'col-use',      slot: 0, y: 660, text: 'Edit item' },
    { id: 'k-s9', columnId: 'col-share',    slot: 0, y: 560, text: 'Copy public link' },

    { id: 'k-s10', columnId: 'col-signup',  slot: 0, y: 880, text: 'OAuth · Google' },
    { id: 'k-s11', columnId: 'col-onboard', slot: 0, y: 880, text: 'Tooltips tour' },
    { id: 'k-s12', columnId: 'col-use',     slot: 0, y: 880, text: 'Bulk actions' },
    { id: 'k-s13', columnId: 'col-share',   slot: 0, y: 880, text: 'Share to X' },
  ],
});

const emptyState = () => ({
  title: 'Untitled Story Map',
  columns: [],
  flowEpicY: 200,
  epicStoryY: 460,
  releases: [],
  cards: [],
});

const migrateCards = (state) => {
  for (const card of state.cards) if (card.slot == null) card.slot = 0;
  return state;
};

class Store {
  constructor() {
    this.state = seed();
    this.history = new History();
    this.sessions = [];      // [{ id, title, createdAt, updatedAt }]
    this.activeId = null;
    this.listeners = new Set();
    this.ready = this.#hydrate();
  }

  async #hydrate() {
    const index = await loadIndex();
    if (index && Array.isArray(index.sessions) && index.sessions.length) {
      this.sessions = index.sessions;
      this.activeId = index.sessions.some((s) => s.id === index.activeId)
        ? index.activeId
        : index.sessions[0].id;
      const rec = await loadSession(this.activeId);
      this.state = rec?.state ? migrateCards(rec.state) : seed();
      this.history = new History();
      if (rec?.history) this.history.hydrate(rec.history);
    } else {
      // First launch: seed a single session.
      const id = uid();
      const now = Date.now();
      this.activeId = id;
      this.state = seed();
      this.history = new History();
      this.sessions = [{ id, title: this.state.title, createdAt: now, updatedAt: now }];
      await this.#persist();
    }
    requestPersistence();
  }

  #activeMeta() { return this.sessions.find((s) => s.id === this.activeId); }

  async #persist() {
    const meta = this.#activeMeta();
    if (meta) { meta.title = this.state.title; meta.updatedAt = Date.now(); }
    try {
      await Promise.all([
        saveSession(this.activeId, {
          id: this.activeId,
          state: this.state,
          history: this.history.serialize(),
        }),
        saveIndex({ activeId: this.activeId, sessions: this.sessions }),
      ]);
    } catch (err) {
      console.error('persist failed', err);
    }
  }

  async #persistIndex() {
    try {
      await saveIndex({ activeId: this.activeId, sessions: this.sessions });
    } catch (err) {
      console.error('persist index failed', err);
    }
  }

  #loadInto(rec) {
    this.state = rec?.state ? migrateCards(rec.state) : seed();
    this.history = new History();
    if (rec?.history) this.history.hydrate(rec.history);
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  #notify() { for (const fn of this.listeners) fn(this.state); }

  // ---------- sessions ----------

  createSession() {
    const id = uid();
    const now = Date.now();
    this.activeId = id;
    this.state = seed();
    this.history = new History();
    this.sessions.push({ id, title: this.state.title, createdAt: now, updatedAt: now });
    this.#persist();
    this.#notify();
    return id;
  }

  async selectSession(id) {
    if (id === this.activeId || !this.sessions.some((s) => s.id === id)) return;
    const rec = await loadSession(id);
    this.activeId = id;
    this.#loadInto(rec);
    this.#persistIndex();
    this.#notify();
  }

  async deleteSession(id) {
    const idx = this.sessions.findIndex((s) => s.id === id);
    if (idx < 0) return;
    this.sessions.splice(idx, 1);
    await deleteSessionRecord(id);

    if (this.activeId !== id) {
      await this.#persistIndex();
    } else if (this.sessions.length === 0) {
      // Deleted the last one — start fresh so there's always an active map.
      const nid = uid();
      const now = Date.now();
      this.activeId = nid;
      this.state = seed();
      this.history = new History();
      this.sessions.push({ id: nid, title: this.state.title, createdAt: now, updatedAt: now });
      await this.#persist();
    } else {
      // Switch to the most recently edited remaining session.
      const next = [...this.sessions].sort((a, b) => b.updatedAt - a.updatedAt)[0];
      this.activeId = next.id;
      this.#loadInto(await loadSession(next.id));
      await this.#persistIndex();
    }
    this.#notify();
  }

  // ---------- active-map mutations ----------

  reset({ toEmpty = false } = {}) {
    this.state = toEmpty ? emptyState() : seed();
    this.history.clear();
    this.#persist();
    this.#notify();
  }

  importState(state) {
    this.state = state;
    this.history.clear();
    this.#persist();
    this.#notify();
  }

  dispatch(cmd) {
    if (isNoOp(cmd)) return;
    const def = COMMANDS[cmd.type];
    if (!def) throw new Error(`Unknown command: ${cmd.type}`);
    const next = structuredClone(this.state);
    def.apply(next, cmd.payload);
    this.state = next;
    this.history.record(cmd);
    this.#persist();
    this.#notify();
  }

  undo() {
    const cmd = this.history.popUndo();
    if (!cmd) return null;
    const next = structuredClone(this.state);
    COMMANDS[cmd.type].revert(next, cmd.payload);
    this.state = next;
    this.history.pushFuture(cmd);
    this.#persist();
    this.#notify();
    return cmd;
  }

  redo() {
    const cmd = this.history.popRedo();
    if (!cmd) return null;
    const next = structuredClone(this.state);
    COMMANDS[cmd.type].apply(next, cmd.payload);
    this.state = next;
    this.history.pushPast(cmd);
    this.#persist();
    this.#notify();
    return cmd;
  }

  canUndo() { return this.history.canUndo(); }
  canRedo() { return this.history.canRedo(); }
}

export const store = new Store();
