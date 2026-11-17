export function createMaskEditorHistory() {
  let version = 0;
  let source = null;
  let current = null;
  const undo = [];
  const redo = [];
  const change = value => { current = value; version++; };
  return {
    get current() { return current; },
    get source() { return source; },
    get canUndo() { return undo.length > 0; },
    get canRedo() { return redo.length > 0; },
    load(identity, initial) { source = identity; undo.length = redo.length = 0; change(initial); },
    ticket() { return { version, source }; },
    isCurrent(ticket) { return ticket.version === version && ticket.source === source; },
    commit(value, ticket) {
      if (ticket && !this.isCurrent(ticket)) return false;
      undo.push(current);
      if (undo.length > 20) undo.shift();
      redo.length = 0;
      change(value);
      return true;
    },
    undo() { if (undo.length) { redo.push(current); change(undo.pop()); } },
    redo() { if (redo.length) { undo.push(current); change(redo.pop()); } },
    invalidate() { version++; },
  };
}
