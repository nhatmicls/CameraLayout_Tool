/**
 * True when `target` is a form control a keyboard shortcut must not hijack:
 * free text entry (`INPUT`/`TEXTAREA`) or a native `<select>`, whose own
 * arrow-key/typeahead navigation needs the keystroke. Shared by every
 * drawing-tool overlay and selection-keyboard-shortcut hook that reads
 * `e.target` before acting on Escape/Backspace/Delete (DRY - these must all
 * agree on the SAME set of elements, or a shortcut fires while the user is
 * mid-select in a `<select>` in one place but not another).
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')
}
