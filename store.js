import { COMMANDS, isNoOp } from './commands.js';
import { History } from './history.js';
import { loadState, saveState, requestPersistence } from './db.js';

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

class Store {
  constructor() {
    this.state = seed();
    this.history = new History();
    this.listeners = new Set();
    this.ready = this.#hydrate();
  }

  async #hydrate() {
    const persisted = await loadState();
    if (persisted) {
      if (persisted.state) {
        this.state = persisted.state;
        // Migrate older states that predate the `slot` field.
        for (const card of this.state.cards) {
          if (card.slot == null) card.slot = 0;
        }
      }
      if (persisted.history) this.history.hydrate(persisted.history);
    } else {
      // first launch: persist the seed so the demo data sticks
      this.#persist();
    }
    requestPersistence();
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  #notify() { for (const fn of this.listeners) fn(this.state); }

  async #persist() {
    try {
      await saveState({ state: this.state, history: this.history.serialize() });
    } catch (err) {
      console.error('persist failed', err);
    }
  }

  reset({ toEmpty = false } = {}) {
    this.state = toEmpty ? emptyState() : seed();
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
