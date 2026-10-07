'use strict';

// Only immutable document/view strings belong here. File handles, byte
// baselines, confirmed saves, forms and conflict latches stay with their owner.
const HISTORY_LIMITS = Object.freeze({ steps: 100, bytes: 16 * 1024 * 1024 });
function createHistory({ steps = HISTORY_LIMITS.steps, bytes = HISTORY_LIMITS.bytes } = {}) {
  let past = [], future = [], limited = false;
  const size = entry => 2 * (entry.before.text.length + entry.before.view.length + entry.after.text.length + entry.after.view.length);
  const same = (a, b) => a.text === b.text && a.view === b.view;
  return {
    clear() { past = []; future = []; limited = false; },
    record(before, after) {
      if (same(before, after)) return;
      future = [];
      past.push({ before: { ...before }, after: { ...after } });
      let total = past.reduce((sum, entry) => sum + size(entry), 0);
      while (past.length > steps || total > bytes) { total -= size(past.shift()); limited = true; }
    },
    undo() { const entry = past.pop(); if (!entry) return null; future.push(entry); return { ...entry.before }; },
    redo() { const entry = future.pop(); if (!entry) return null; past.push(entry); return { ...entry.after }; },
    state() { return { undoCount: past.length, redoCount: future.length, limited }; }
  };
}
module.exports = { createHistory, HISTORY_LIMITS };
