import { store } from './store.js';
import { makeCommand } from './commands.js';

// ---------- geometry ----------
const LEFT_RAIL = 120;
const SLOT_W = 240;      // each horizontal slot inside a column = SLOT_W px
const COL_GAP = 24;      // gap between columns (and at the left/right edges)
const PAD_RIGHT = 480;
const PAD_BOTTOM = 480;
const MIN_CANVAS_H = 1400;

const CARD_SIZES = {
  flow:  { w: 220, h: 110 },
  epic:  { w: 200, h: 90 },
  story: { w: 200, h: 78 },
};

const typeOf = (cy, s) =>
  cy < s.flowEpicY ? 'flow' : cy < s.epicStoryY ? 'epic' : 'story';

/**
 * Compute geometry for the whole canvas.
 *
 * @param {object} s - store state
 * @param {object} [opts]
 * @param {string|null} [opts.excludeCardId] - skip this card when counting slots
 * @param {object|null} [opts.virtualCard] - {columnId, slot}: pretend a card sits there
 * @returns {{ colLefts:number[], slotCounts:Object<string,number>, totalW:number }}
 */
const computeLayout = (s, { excludeCardId = null, virtualCard = null } = {}) => {
  const slotCounts = {};
  for (const col of s.columns) slotCounts[col.id] = 1;
  for (const card of s.cards) {
    if (card.id === excludeCardId) continue;
    if (slotCounts[card.columnId] === undefined) continue;
    const need = (card.slot || 0) + 1;
    if (need > slotCounts[card.columnId]) slotCounts[card.columnId] = need;
  }
  if (virtualCard && slotCounts[virtualCard.columnId] !== undefined) {
    const need = (virtualCard.slot || 0) + 1;
    if (need > slotCounts[virtualCard.columnId]) slotCounts[virtualCard.columnId] = need;
  }
  const colLefts = [];
  let x = LEFT_RAIL + COL_GAP;
  for (const col of s.columns) {
    colLefts.push(x);
    x += slotCounts[col.id] * SLOT_W + COL_GAP;
  }
  return { colLefts, slotCounts, totalW: x + PAD_RIGHT };
};

/**
 * Given a cursor x in canvas coords, return { colIdx, colId, slot } the cursor
 * is pointing at. Two-pass rule:
 *   1. If the cursor sits inside an existing slot's span, snap to that slot.
 *   2. Otherwise (cursor in a gap or past the rightmost column), snap to the
 *      nearest "new slot at the right edge" of some column — which is what
 *      makes a column auto-widen during drag.
 *
 * `baseLayout` should exclude the dragged card so its own slot doesn't bias
 * the natural slot count.
 */
const targetFromX = (cursorX, s, baseLayout) => {
  if (s.columns.length === 0) return null;

  // Cursor inside an existing slot's column → use that column's slot.
  for (let i = 0; i < s.columns.length; i++) {
    const col = s.columns[i];
    const colLeft = baseLayout.colLefts[i];
    const colRight = colLeft + baseLayout.slotCounts[col.id] * SLOT_W;
    if (cursorX >= colLeft && cursorX < colRight) {
      const slot = Math.max(0, Math.floor((cursorX - colLeft) / SLOT_W));
      return { colIdx: i, colId: col.id, slot };
    }
  }

  // Hard-left → first slot of first column.
  if (cursorX < baseLayout.colLefts[0]) {
    return { colIdx: 0, colId: s.columns[0].id, slot: 0 };
  }

  // Cursor in a gap (or past the rightmost column): pick the column whose
  // would-be "new slot center" is closest to the cursor.
  let bestI = s.columns.length - 1;
  let bestDist = Infinity;
  for (let i = 0; i < s.columns.length; i++) {
    const col = s.columns[i];
    const newSlotCenter =
      baseLayout.colLefts[i] +
      baseLayout.slotCounts[col.id] * SLOT_W +
      SLOT_W / 2;
    const dist = Math.abs(cursorX - newSlotCenter);
    if (dist < bestDist) {
      bestDist = dist;
      bestI = i;
    }
  }
  return {
    colIdx: bestI,
    colId: s.columns[bestI].id,
    slot: baseLayout.slotCounts[s.columns[bestI].id],
  };
};

const cardLeftFor = (card, type, layout, s) => {
  const colIdx = s.columns.findIndex((c) => c.id === card.columnId);
  if (colIdx < 0) return null;
  const size = CARD_SIZES[type];
  const slot = card.slot || 0;
  const slotLeft = layout.colLefts[colIdx] + slot * SLOT_W;
  return { left: slotLeft + (SLOT_W - size.w) / 2, top: card.y - size.h / 2, size };
};

const uid = (prefix = 'id') =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const rotationOf = (id) => {
  let h = 5381;
  for (const c of id) h = ((h << 5) + h + c.charCodeAt(0)) | 0;
  return (((Math.abs(h) % 41) - 20) / 10);
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const isEditableTarget = (e) => {
  const t = e.target;
  return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
};

// Tiny DOM helper. No HTML strings ever reach the DOM.
const h = (tag, attrs, ...children) => {
  const e = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k === 'text') e.textContent = v;
    else if (k === 'ce') e.contentEditable = 'true';
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
    else e.setAttribute(k, String(v));
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    e.appendChild(typeof c === 'string' || typeof c === 'number'
      ? document.createTextNode(String(c)) : c);
  }
  return e;
};

const replaceChildren = (parent, ...nodes) => {
  while (parent.firstChild) parent.removeChild(parent.firstChild);
  for (const n of nodes) parent.appendChild(n);
};

// ---------- DOM refs ----------
let titleEl, headersEl, canvasEl, scrollerEl, undoBtn, redoBtn;

// IDs of cards added in the most recent user action — these get a one-shot
// pop-in animation on the next render. Cleared once consumed.
const newlyAddedIds = new Set();

export const attachEvents = () => {
  titleEl = document.querySelector('.title');
  scrollerEl = document.getElementById('scroller');
  headersEl = document.getElementById('headers');
  canvasEl = document.getElementById('canvas');
  undoBtn = document.querySelector('[data-action="undo"]');
  redoBtn = document.querySelector('[data-action="redo"]');

  titleEl.addEventListener('blur', () => {
    const next = titleEl.textContent.trim() || 'Untitled Story Map';
    if (next !== store.state.title) {
      store.dispatch(makeCommand('SET_TITLE', { from: store.state.title, to: next }));
    } else {
      titleEl.textContent = next;
    }
  });
  titleEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); titleEl.blur(); }
    if (e.key === 'Escape') { titleEl.textContent = store.state.title; titleEl.blur(); }
  });

  document.querySelectorAll('[data-action]').forEach((btn) => {
    btn.addEventListener('click', () => onAction(btn.dataset.action));
  });

  canvasEl.addEventListener('dblclick', onCanvasDblClick);

  // Space-drag (or middle-mouse-drag) to pan, plus undo/redo shortcuts.
  let panActive = null;
  let spaceHeld = false;
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !isEditableTarget(e)) {
      spaceHeld = true;
      scrollerEl.classList.add('panning');
      e.preventDefault();
    }
    const meta = e.metaKey || e.ctrlKey;
    if (!meta || isEditableTarget(e)) return;
    if (e.key === 'z' || e.key === 'Z') {
      e.preventDefault();
      if (e.shiftKey) store.redo(); else store.undo();
    } else if (e.key === 'y' || e.key === 'Y') {
      e.preventDefault();
      store.redo();
    }
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
      spaceHeld = false;
      scrollerEl.classList.remove('panning');
    }
  });
  scrollerEl.addEventListener('pointerdown', (e) => {
    const isPan = spaceHeld || e.button === 1;
    if (!isPan) return;
    panActive = {
      x: e.clientX, y: e.clientY,
      sx: scrollerEl.scrollLeft, sy: scrollerEl.scrollTop,
      id: e.pointerId,
    };
    try { scrollerEl.setPointerCapture(e.pointerId); } catch {}
    e.preventDefault();
  });
  scrollerEl.addEventListener('pointermove', (e) => {
    if (!panActive || e.pointerId !== panActive.id) return;
    scrollerEl.scrollLeft = panActive.sx - (e.clientX - panActive.x);
    scrollerEl.scrollTop = panActive.sy - (e.clientY - panActive.y);
  });
  const endPan = (e) => {
    if (!panActive || e.pointerId !== panActive.id) return;
    try { scrollerEl.releasePointerCapture(e.pointerId); } catch {}
    panActive = null;
  };
  scrollerEl.addEventListener('pointerup', endPan);
  scrollerEl.addEventListener('pointercancel', endPan);
};

const onAction = (action) => {
  const s = store.state;
  if (action === 'reset') {
    if (confirm('Reset the canvas back to the starter example? Your current map will be cleared.')) {
      store.reset();
    }
  } else if (action === 'clear') {
    if (confirm('Clear the canvas to an empty board? This wipes all columns, stories, and releases.')) {
      store.reset({ toEmpty: true });
    }
  } else if (action === 'undo') {
    store.undo();
  } else if (action === 'redo') {
    store.redo();
  } else if (action === 'show-log') {
    openLog();
  } else if (action === 'add-release') {
    const lastY = s.releases.length ? s.releases[s.releases.length - 1].y : s.epicStoryY + 200;
    const release = { id: uid('rel'), label: `Release ${s.releases.length + 1}`, y: lastY + 280 };
    store.dispatch(makeCommand('ADD_RELEASE', { from: null, to: release, release }));
  } else if (action === 'add-column') {
    const column = { id: uid('col'), label: '' };
    store.dispatch(makeCommand('ADD_COLUMN', {
      from: null, to: column, atIndex: s.columns.length, column,
    }));
    requestAnimationFrame(() => {
      headersEl.querySelector(`[data-col-id="${column.id}"] .label`)?.focus();
    });
  }
};

const onCanvasDblClick = (e) => {
  if (e.target !== canvasEl) return;
  const s = store.state;
  if (s.columns.length === 0) return;
  const rect = canvasEl.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  if (x < LEFT_RAIL) return;
  const layout = computeLayout(s);
  const target = targetFromX(x, s, layout);
  if (!target) return;
  const card = { id: uid('k'), columnId: target.colId, slot: target.slot, y: Math.max(40, y), text: '' };
  newlyAddedIds.add(card.id);
  store.dispatch(makeCommand('ADD_CARD', { from: null, to: card, card }));
  requestAnimationFrame(() => {
    const cEl = canvasEl.querySelector(`[data-card-id="${card.id}"]`);
    if (!cEl) return;
    cEl.classList.add('editing');
    cEl.querySelector('.text')?.focus();
  });
};

// ---------- render ----------
export const render = () => {
  syncTitle();
  syncActionButtons();
  const layout = computeLayout(store.state);
  renderHeaders(layout);
  renderCanvas(layout);
  if (modalEl) renderLog();
};

const syncActionButtons = () => {
  if (undoBtn) undoBtn.disabled = !store.canUndo();
  if (redoBtn) redoBtn.disabled = !store.canRedo();
};

const syncTitle = () => {
  if (document.activeElement === titleEl) return;
  if (titleEl.textContent !== store.state.title) {
    titleEl.textContent = store.state.title;
  }
};

const renderHeaders = (layout) => {
  const s = store.state;
  headersEl.style.width = `${layout.totalW}px`;

  const nodes = [
    h('div', { class: 'header-rail' }, h('span', { text: 'Activities' })),
  ];

  for (let i = 0; i < s.columns.length; i++) {
    const col = s.columns[i];
    const colIdx = i;
    const w = layout.slotCounts[col.id] * SLOT_W;

    const insertBtn = h('button', {
      type: 'button',
      title: 'Insert column here',
      onclick: () => insertColumn(colIdx),
    }, '+');
    nodes.push(h('div', { class: 'col-insert', 'data-insert-at': colIdx }, insertBtn));

    const labelEl = h('span', {
      class: 'label',
      ce: true,
      spellcheck: 'false',
      'data-placeholder': 'Step name',
      text: col.label,
    });
    labelEl.addEventListener('blur', () => {
      const current = store.state.columns.find((c) => c.id === col.id);
      if (!current) return;
      const next = labelEl.textContent.trim();
      if (next !== current.label) {
        store.dispatch(makeCommand('RENAME_COLUMN', { id: col.id, from: current.label, to: next }));
      }
    });
    labelEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); labelEl.blur(); }
      if (e.key === 'Escape') {
        const current = store.state.columns.find((c) => c.id === col.id);
        labelEl.textContent = current?.label ?? '';
        labelEl.blur();
      }
    });

    const deleteBtn = h('button', {
      type: 'button',
      class: 'col-delete',
      title: 'Delete column',
      onclick: () => deleteColumn(col.id),
      text: '×',
    });

    nodes.push(h('div', {
      class: 'column-header',
      'data-col-id': col.id,
      style: { flex: `0 0 ${w}px` },
    },
      h('span', { class: 'column-no', text: String(i + 1).padStart(2, '0') }),
      labelEl,
      deleteBtn,
    ));
  }

  nodes.push(h('div', { class: 'col-insert col-insert-end', 'data-insert-at': s.columns.length },
    h('button', { type: 'button', title: 'Add column', onclick: () => insertColumn(s.columns.length) }, '+'),
  ));

  replaceChildren(headersEl, ...nodes);
};

const insertColumn = (atIndex) => {
  const column = { id: uid('col'), label: '' };
  store.dispatch(makeCommand('ADD_COLUMN', { from: null, to: column, atIndex, column }));
  requestAnimationFrame(() => {
    headersEl.querySelector(`[data-col-id="${column.id}"] .label`)?.focus();
  });
};

const deleteColumn = (id) => {
  const s = store.state;
  const idx = s.columns.findIndex((c) => c.id === id);
  const col = s.columns[idx];
  if (!col) return;
  const cards = s.cards.filter((c) => c.columnId === id);
  const label = col.label || 'Untitled';
  const tail = cards.length ? ` and its ${cards.length} sticky note${cards.length === 1 ? '' : 's'}` : '';
  if (!confirm(`Delete column "${label}"${tail}?`)) return;
  store.dispatch(makeCommand('REMOVE_COLUMN', {
    from: { column: col, cards }, to: null,
    atIndex: idx, column: col, cards,
  }));
};

const renderCanvas = (layout) => {
  const s = store.state;
  const maxCardY = s.cards.reduce((m, c) => Math.max(m, c.y), 0);
  const maxRelY  = s.releases.reduce((m, r) => Math.max(m, r.y), 0);
  const totalH = Math.max(
    MIN_CANVAS_H,
    s.epicStoryY + PAD_BOTTOM,
    maxRelY + PAD_BOTTOM,
    maxCardY + PAD_BOTTOM,
  );
  canvasEl.style.width = `${layout.totalW}px`;
  canvasEl.style.height = `${totalH}px`;

  const nodes = [];

  // Column background tracks — full column width (all slots)
  for (let i = 0; i < s.columns.length; i++) {
    const col = s.columns[i];
    const w = layout.slotCounts[col.id] * SLOT_W;
    nodes.push(h('div', {
      class: 'col-bg',
      'data-col-id': col.id,
      style: { left: `${layout.colLefts[i]}px`, width: `${w}px` },
    }));
  }

  // Horizontal zone tints
  nodes.push(h('div', {
    class: 'zone-band zone-band-flow',
    style: { top: '0px', height: `${s.flowEpicY}px` },
  }));
  nodes.push(h('div', {
    class: 'zone-band zone-band-epic',
    style: { top: `${s.flowEpicY}px`, height: `${s.epicStoryY - s.flowEpicY}px` },
  }));

  // Left-rail zone labels
  nodes.push(h('div', {
    class: 'zone-label',
    style: { top: '6px', height: `${s.flowEpicY - 6}px` },
  },
    h('span', { class: 'zone-label-text', text: 'User flows' }),
    h('span', { class: 'zone-label-meta', text: 'backbone' }),
  ));
  nodes.push(h('div', {
    class: 'zone-label',
    style: { top: `${s.flowEpicY + 6}px`, height: `${s.epicStoryY - s.flowEpicY - 12}px` },
  },
    h('span', { class: 'zone-label-text', text: 'Epics' }),
    h('span', { class: 'zone-label-meta', text: 'walking skeleton' }),
  ));

  // Release-band labels
  let prevY = s.epicStoryY;
  s.releases.forEach((rel, i) => {
    const stripped = (rel.label || 'Release').replace(/^Release\s*\d+\s*[·\-:]?\s*/i, '');
    nodes.push(h('div', {
      class: 'zone-label zone-label-release',
      style: { top: `${prevY + 6}px`, height: `${rel.y - prevY - 12}px` },
    },
      h('span', { class: 'zone-label-text', text: `R${i + 1}` }),
      h('span', { class: 'zone-label-meta', text: stripped || 'release' }),
    ));
    prevY = rel.y;
  });
  nodes.push(h('div', {
    class: 'zone-label zone-label-backlog',
    style: { top: `${prevY + 6}px`, height: `${Math.max(80, totalH - prevY - 12)}px` },
  },
    h('span', { class: 'zone-label-text', text: 'Backlog' }),
    h('span', { class: 'zone-label-meta', text: 'someday' }),
  ));

  // Zone dividers (draggable)
  ['flowEpicY', 'epicStoryY'].forEach((key) => {
    const el = h('div', {
      class: 'zone-divider',
      'data-divider': key,
      style: { top: `${s[key]}px` },
    });
    attachDividerDrag(el, key);
    nodes.push(el);
  });

  // Release lines + tabs
  s.releases.forEach((rel) => {
    const line = h('div', {
      class: 'release-line',
      'data-release-id': rel.id,
      style: { top: `${rel.y}px` },
    });
    attachReleaseDrag(line, rel.id);
    nodes.push(line);

    const labelEl = h('span', {
      class: 'label',
      ce: true,
      spellcheck: 'false',
      text: rel.label || 'Release',
    });
    labelEl.addEventListener('blur', () => {
      const current = store.state.releases.find((r) => r.id === rel.id);
      if (!current) return;
      const next = labelEl.textContent.trim() || 'Release';
      if (next !== current.label) {
        store.dispatch(makeCommand('RENAME_RELEASE', { id: rel.id, from: current.label, to: next }));
      }
    });
    labelEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); labelEl.blur(); }
      if (e.key === 'Escape') {
        const current = store.state.releases.find((r) => r.id === rel.id);
        labelEl.textContent = current?.label ?? '';
        labelEl.blur();
      }
    });
    const delBtn = h('button', {
      type: 'button',
      class: 'delete',
      title: 'Delete release',
      text: '×',
      onclick: (e) => {
        e.stopPropagation();
        const current = store.state.releases.find((r) => r.id === rel.id);
        if (!current) return;
        store.dispatch(makeCommand('REMOVE_RELEASE', { from: current, to: null, release: current }));
      },
    });
    const tab = h('div', {
      class: 'release-tab',
      'data-release-tab': rel.id,
      style: { top: `${rel.y}px` },
    }, h('span', { class: 'release-arrow', text: '▲' }), labelEl, delBtn);
    nodes.push(tab);
  });

  // Cards
  s.cards.forEach((card) => {
    const colIdx = s.columns.findIndex((c) => c.id === card.columnId);
    if (colIdx < 0) return; // orphan
    const type = typeOf(card.y, s);
    const pos = cardLeftFor(card, type, layout, s);
    if (!pos) return;
    const rot = rotationOf(card.id);

    const placeholderFor = type === 'flow'
      ? 'a step in the user journey'
      : type === 'epic'
      ? 'a feature in this step'
      : 'a story / task';

    const textEl = h('span', {
      class: 'text',
      ce: true,
      spellcheck: 'false',
      'data-placeholder': placeholderFor,
      text: card.text,
    });

    const deleteBtn = h('button', {
      type: 'button',
      class: 'delete',
      title: 'Delete',
      text: '×',
      onclick: (e) => {
        e.stopPropagation();
        const current = store.state.cards.find((c) => c.id === card.id);
        if (!current) return;
        store.dispatch(makeCommand('REMOVE_CARD', { from: current, to: null, card: current }));
      },
    });

    const isNew = newlyAddedIds.has(card.id);
    const cardEl = h('div', {
      class: `card card-${type}${isNew ? ' card-new' : ''}`,
      'data-card-id': card.id,
      style: {
        left: `${pos.left}px`,
        top: `${pos.top}px`,
        width: `${pos.size.w}px`,
        height: `${pos.size.h}px`,
      },
    },
      h('span', { class: 'card-paper' }),
      h('span', { class: 'card-corner' }),
      textEl,
      h('span', { class: 'card-meta', text: type }),
      deleteBtn,
    );
    cardEl.style.setProperty('--rot', `${rot.toFixed(2)}deg`);
    attachCardInteractions(cardEl, card.id, textEl);
    nodes.push(cardEl);
  });

  replaceChildren(canvasEl, ...nodes);
  // Animation tokens are single-use — clear after the elements have been built.
  newlyAddedIds.clear();
};

/**
 * Reposition every layout-dependent DOM node in place. Used during drag to
 * animate column widening and the cascade of column / card shifts without a
 * full re-render. Does NOT touch the dragged card (caller positions that
 * separately).
 */
const applyLayout = (layout, draggedId) => {
  const s = store.state;
  canvasEl.style.width = `${layout.totalW}px`;
  headersEl.style.width = `${layout.totalW}px`;

  for (let i = 0; i < s.columns.length; i++) {
    const col = s.columns[i];
    const w = layout.slotCounts[col.id] * SLOT_W;
    const head = headersEl.querySelector(`.column-header[data-col-id="${col.id}"]`);
    if (head) head.style.flex = `0 0 ${w}px`;
    const bg = canvasEl.querySelector(`.col-bg[data-col-id="${col.id}"]`);
    if (bg) {
      bg.style.left = `${layout.colLefts[i]}px`;
      bg.style.width = `${w}px`;
    }
  }

  for (const card of s.cards) {
    if (card.id === draggedId) continue;
    const colIdx = s.columns.findIndex((c) => c.id === card.columnId);
    if (colIdx < 0) continue;
    const cardEl = canvasEl.querySelector(`.card[data-card-id="${card.id}"]`);
    if (!cardEl) continue;
    const type = typeOf(card.y, s);
    const size = CARD_SIZES[type];
    const slot = card.slot || 0;
    const left = layout.colLefts[colIdx] + slot * SLOT_W + (SLOT_W - size.w) / 2;
    cardEl.style.left = `${left}px`;
    cardEl.style.top = `${card.y - size.h / 2}px`;
    cardEl.style.width = `${size.w}px`;
    cardEl.style.height = `${size.h}px`;
  }
};

// ---------- interaction wiring (per element) ----------

const attachCardInteractions = (cardEl, id, textEl) => {
  let drag = null;

  cardEl.addEventListener('pointerdown', (e) => {
    if (cardEl.classList.contains('editing')) return;
    if (e.target.closest('button')) return;
    if (e.button !== 0) return;
    const card = store.state.cards.find((c) => c.id === id);
    if (!card) return;
    const cRect = cardEl.getBoundingClientRect();
    drag = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: e.clientX - (cRect.left + cRect.width / 2),
      offsetY: e.clientY - (cRect.top + cRect.height / 2),
      origCol: card.columnId,
      origSlot: card.slot || 0,
      origY: card.y,
      moved: false,
      lastTarget: null,
    };
    try { cardEl.setPointerCapture(e.pointerId); } catch {}
    e.preventDefault();
  });

  cardEl.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < 5) return;
    if (!drag.moved) {
      drag.moved = true;
      cardEl.classList.add('dragging');
    }
    const s = store.state;
    const cRect = canvasEl.getBoundingClientRect();
    const cursorX = e.clientX - drag.offsetX - cRect.left;
    const cursorY = e.clientY - drag.offsetY - cRect.top;

    // Natural layout: every card *except* the one being dragged.
    const baseLayout = computeLayout(s, { excludeCardId: id });
    const target = targetFromX(cursorX, s, baseLayout);
    if (!target) return;
    drag.lastTarget = target;

    // Preview layout: as if the dragged card were already at the target slot.
    const previewLayout = computeLayout(s, {
      excludeCardId: id,
      virtualCard: { columnId: target.colId, slot: target.slot },
    });
    applyLayout(previewLayout, id);

    const type = typeOf(cursorY, s);
    const size = CARD_SIZES[type];
    const slotLeft = previewLayout.colLefts[target.colIdx] + target.slot * SLOT_W;
    const left = slotLeft + (SLOT_W - size.w) / 2;
    cardEl.className = `card card-${type} dragging`;
    cardEl.style.left = `${left}px`;
    cardEl.style.top = `${Math.max(40 - size.h / 2, cursorY - size.h / 2)}px`;
    cardEl.style.width = `${size.w}px`;
    cardEl.style.height = `${size.h}px`;
    const meta = cardEl.querySelector('.card-meta');
    if (meta) meta.textContent = type;
  });

  const finishDrag = (e) => {
    if (!drag || (e && e.pointerId !== drag.pointerId)) return;
    const pid = drag.pointerId;
    try { cardEl.releasePointerCapture(pid); } catch {}
    if (!drag.moved) { drag = null; return; }
    const s = store.state;
    const cRect = canvasEl.getBoundingClientRect();
    const cursorY = e.clientY - drag.offsetY - cRect.top;
    const newY = Math.max(40, cursorY);
    // Prefer the last target computed during pointermove (handles the
    // pointerup landing exactly at the edge of two columns gracefully).
    const target = drag.lastTarget ?? (() => {
      const cursorX = e.clientX - drag.offsetX - cRect.left;
      return targetFromX(cursorX, s, computeLayout(s, { excludeCardId: id }));
    })();
    if (
      target &&
      (target.colId !== drag.origCol ||
       target.slot !== drag.origSlot ||
       Math.round(newY) !== Math.round(drag.origY))
    ) {
      store.dispatch(makeCommand('MOVE_CARD', {
        id,
        from: { columnId: drag.origCol, slot: drag.origSlot, y: drag.origY },
        to:   { columnId: target.colId, slot: target.slot,    y: newY },
      }));
    } else {
      render(); // snap back to committed layout
    }
    drag = null;
  };
  cardEl.addEventListener('pointerup', finishDrag);
  cardEl.addEventListener('pointercancel', finishDrag);

  cardEl.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    if (e.target.closest('button')) return;
    cardEl.classList.add('editing');
    textEl.focus();
    const range = document.createRange();
    range.selectNodeContents(textEl);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  });

  textEl.addEventListener('blur', () => {
    cardEl.classList.remove('editing');
    const next = textEl.innerText.replace(/\r?\n+$/g, '');
    const current = store.state.cards.find((c) => c.id === id);
    if (current && next !== current.text) {
      store.dispatch(makeCommand('EDIT_CARD', { id, from: current.text, to: next }));
    } else {
      textEl.textContent = current?.text ?? '';
    }
  });
  textEl.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const current = store.state.cards.find((c) => c.id === id);
      textEl.textContent = current?.text ?? '';
      textEl.blur();
      e.preventDefault();
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      textEl.blur();
    }
  });
};

const attachDividerDrag = (el, key) => {
  let drag = null;
  el.addEventListener('pointerdown', (e) => {
    drag = { startY: e.clientY, origY: store.state[key], pointerId: e.pointerId };
    el.classList.add('dragging');
    try { el.setPointerCapture(e.pointerId); } catch {}
    e.preventDefault();
  });
  el.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const dy = e.clientY - drag.startY;
    const s = store.state;
    const lo = key === 'flowEpicY' ? 80 : s.flowEpicY + 60;
    const hi = key === 'flowEpicY' ? s.epicStoryY - 60 : (s.releases[0]?.y ?? Infinity) - 80;
    const nextY = clamp(drag.origY + dy, lo, hi);
    el.style.top = `${nextY}px`;
  });
  const end = (e) => {
    if (!drag || (e && e.pointerId !== drag.pointerId)) return;
    try { el.releasePointerCapture(drag.pointerId); } catch {}
    el.classList.remove('dragging');
    const nextY = parseFloat(el.style.top);
    if (Math.round(nextY) !== Math.round(drag.origY)) {
      store.dispatch(makeCommand('MOVE_DIVIDER', { key, from: drag.origY, to: nextY }));
    } else {
      render();
    }
    drag = null;
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
};

const attachReleaseDrag = (el, id) => {
  let drag = null;
  el.addEventListener('pointerdown', (e) => {
    const rel = store.state.releases.find((r) => r.id === id);
    if (!rel) return;
    drag = { startY: e.clientY, origY: rel.y, pointerId: e.pointerId };
    el.classList.add('dragging');
    try { el.setPointerCapture(e.pointerId); } catch {}
    e.preventDefault();
  });
  el.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const dy = e.clientY - drag.startY;
    const s = store.state;
    const lo = s.epicStoryY + 80;
    const nextY = Math.max(lo, drag.origY + dy);
    el.style.top = `${nextY}px`;
    const tab = canvasEl.querySelector(`[data-release-tab="${id}"]`);
    if (tab) tab.style.top = `${nextY}px`;
  });
  const end = (e) => {
    if (!drag || (e && e.pointerId !== drag.pointerId)) return;
    try { el.releasePointerCapture(drag.pointerId); } catch {}
    el.classList.remove('dragging');
    const nextY = parseFloat(el.style.top);
    if (Math.round(nextY) !== Math.round(drag.origY)) {
      store.dispatch(makeCommand('MOVE_RELEASE', { id, from: drag.origY, to: nextY }));
    } else {
      render();
    }
    drag = null;
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
};

// ---------- action log modal ----------

let modalEl = null;
let modalKeyHandler = null;

const openLog = () => {
  if (modalEl) return;
  modalEl = h('div', {
    class: 'modal-backdrop',
    onclick: (e) => { if (e.target === modalEl) closeLog(); },
  }, h('div', { class: 'modal-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Action log' }));
  document.body.appendChild(modalEl);
  document.body.classList.add('modal-open');
  modalKeyHandler = (e) => { if (e.key === 'Escape') closeLog(); };
  document.addEventListener('keydown', modalKeyHandler);
  renderLog();
};

const closeLog = () => {
  if (!modalEl) return;
  document.removeEventListener('keydown', modalKeyHandler);
  modalKeyHandler = null;
  modalEl.remove();
  modalEl = null;
  document.body.classList.remove('modal-open');
};

const renderLog = () => {
  if (!modalEl) return;
  const sheet = modalEl.querySelector('.modal-sheet');
  const past = store.history.past;
  const future = store.history.future;

  const header = h('div', { class: 'modal-header' },
    h('h2', { class: 'modal-title', text: 'Action log' }),
    h('span', { class: 'modal-stats', text: `${past.length} done · ${future.length} ahead` }),
    h('button', { class: 'modal-close', type: 'button', onclick: closeLog, 'aria-label': 'Close', text: '×' }),
  );

  const list = h('div', { class: 'modal-list' });

  // "Ahead" section: future is a stack — future[last] is next to redo, so the
  // original-timeline order, newest → oldest of the undone items, is
  // future[0] … future[last].
  future.forEach((cmd, i) => {
    list.appendChild(makeLogRow(cmd, 'ahead', () => jumpAhead(i)));
  });

  list.appendChild(h('div', { class: 'modal-now' },
    h('span', { class: 'modal-now-rule' }),
    h('span', { class: 'modal-now-label', text: 'now' }),
    h('span', { class: 'modal-now-rule' }),
  ));

  // Past section: newest first.
  for (let i = past.length - 1; i >= 0; i--) {
    const idx = i;
    list.appendChild(makeLogRow(past[i], 'past', () => jumpBack(idx)));
  }

  if (past.length === 0 && future.length === 0) {
    list.appendChild(h('div', { class: 'modal-empty', text: 'No actions yet. Start moving stickies around.' }));
  }

  replaceChildren(sheet, header, list);
};

const jumpAhead = (futureIdx) => {
  const count = store.history.future.length - futureIdx;
  for (let i = 0; i < count; i++) {
    if (!store.redo()) break;
  }
};

const jumpBack = (pastIdx) => {
  const count = store.history.past.length - 1 - pastIdx;
  for (let i = 0; i < count; i++) {
    if (!store.undo()) break;
  }
};

const makeLogRow = (cmd, kind, onJump) => {
  const t = new Date(cmd.t || Date.now());
  const time = `${pad2(t.getHours())}:${pad2(t.getMinutes())}:${pad2(t.getSeconds())}`;
  return h('button', {
    type: 'button',
    class: `log-row log-row-${kind}`,
    onclick: onJump,
  },
    h('span', { class: 'log-type', text: cmd.type.toLowerCase().replace(/_/g, ' ') }),
    h('span', { class: 'log-summary', text: summarizeCmd(cmd) }),
    h('span', { class: 'log-time', text: time }),
  );
};

const pad2 = (n) => (n < 10 ? '0' : '') + n;

const truncate = (s, n) => {
  if (!s) return '';
  s = String(s).replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
};

const summarizeCmd = (cmd) => {
  const p = cmd.payload || {};
  switch (cmd.type) {
    case 'SET_TITLE':       return `“${truncate(p.to, 36)}”`;
    case 'RENAME_COLUMN':   return `“${truncate(p.from, 16)}” → “${truncate(p.to, 16)}”`;
    case 'RENAME_RELEASE':  return `“${truncate(p.from, 16)}” → “${truncate(p.to, 16)}”`;
    case 'EDIT_CARD':       return `“${truncate(p.to, 38)}”`;
    case 'ADD_COLUMN':      return `“${truncate(p.column?.label || 'untitled', 28)}”`;
    case 'REMOVE_COLUMN':   return `“${truncate(p.column?.label || 'untitled', 28)}”`;
    case 'ADD_CARD':        return `“${truncate(p.card?.text || 'empty', 38)}”`;
    case 'REMOVE_CARD':     return `“${truncate(p.card?.text || 'empty', 38)}”`;
    case 'MOVE_CARD': {
      const sameCol  = p.from?.columnId === p.to?.columnId;
      const sameSlot = (p.from?.slot ?? 0) === (p.to?.slot ?? 0);
      if (sameCol && sameSlot) return 'vertical only';
      if (sameCol)             return `slot ${p.from?.slot ?? 0} → ${p.to?.slot ?? 0}`;
      return 'across columns';
    }
    case 'ADD_RELEASE':     return `“${truncate(p.release?.label || 'release', 28)}”`;
    case 'REMOVE_RELEASE':  return `“${truncate(p.release?.label || 'release', 28)}”`;
    case 'MOVE_RELEASE':    return `y: ${Math.round(p.from)} → ${Math.round(p.to)}`;
    case 'MOVE_DIVIDER':    return `${p.key}: ${Math.round(p.from)} → ${Math.round(p.to)}`;
    default:                return '';
  }
};
