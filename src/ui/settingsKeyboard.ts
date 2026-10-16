/** Keyboard containment applies only to the opened modal settings drawer. */
export function handleModalKeydown(event: KeyboardEvent, open: boolean, close: () => void): void {
  if (!open) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    close();
    return;
  }
  if (event.key !== 'Tab') return;
  const panel = event.currentTarget as HTMLElement;
  const document = panel.ownerDocument;
  const focusable = [...panel.querySelectorAll<HTMLElement>('button, input, select, textarea, summary, a[href], [tabindex]')]
    .filter(element => element.tabIndex >= 0 && !element.matches(':disabled') && !element.closest('[inert]')
      && element.checkVisibility({ visibilityProperty: true }));
  if (!focusable.length) { event.preventDefault(); return; }
  const first = focusable[0], last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}
