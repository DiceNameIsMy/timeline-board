/**
 * Resolve shortcuts without DOM dependencies. Native control keys are preserved
 * while typing or inside dialogs; the editor alone accepts Ctrl/Cmd+Enter.
 * @param {{key: string, ctrlKey?: boolean, metaKey?: boolean, altKey?: boolean, shiftKey?: boolean, isComposing?: boolean, repeat?: boolean, defaultPrevented?: boolean}} event
 * @param {{editorOpen: boolean, dialogOpen: boolean, typing: boolean, inTimeline: boolean, hasEntry: boolean}} context
 * @returns {string|null}
 */
export function keyboardCommand(event, context) {
  if (event.defaultPrevented || event.isComposing || event.altKey) return null;
  if (context.editorOpen) {
    return (event.ctrlKey || event.metaKey) && event.key === 'Enter' && !event.repeat ? 'save' : null;
  }
  if (context.dialogOpen || context.typing || event.ctrlKey || event.metaKey) return null;
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  const commands = { n: 'add', t: 'today', '1': 'zoom-1', '3': 'zoom-3', '6': 'zoom-6', '?': 'help', PageUp: 'previous', PageDown: 'next', j: 'select-next', k: 'select-previous' };
  if (commands[key]) {
    if (event.repeat && ['add', 'help'].includes(commands[key])) return null;
    return commands[key];
  }
  if (context.hasEntry && key === 'x' && !event.repeat) return 'complete';
  if (!context.inTimeline) return null;
  return { ArrowLeft: 'scroll-left', ArrowRight: 'scroll-right', ArrowDown: 'select-next', ArrowUp: 'select-previous', Home: 'today', Enter: 'edit' }[key] ?? null;
}
