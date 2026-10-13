/** Compatibility fallback for dialogs using closedby="any". */
export function lightDismiss(dialog: HTMLDialogElement) {
  if ('closedBy' in dialog) return;
  let startedOutside = false;
  const outside = (event: MouseEvent) => {
    if (event.target !== dialog) return false;
    const rect = dialog.getBoundingClientRect();
    return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
  };
  const onPointerDown = (event: PointerEvent) => { startedOutside = event.button === 0 && outside(event); };
  const reset = () => { startedOutside = false; };
  const onClick = (event: MouseEvent) => {
    const dismiss = startedOutside && event.detail > 0 && outside(event);
    reset();
    if (dismiss) dialog.close();
  };
  dialog.addEventListener('pointerdown', onPointerDown);
  dialog.addEventListener('pointercancel', reset);
  dialog.addEventListener('click', onClick);
  dialog.addEventListener('close', reset);
  return { destroy() {
    dialog.removeEventListener('pointerdown', onPointerDown);
    dialog.removeEventListener('pointercancel', reset);
    dialog.removeEventListener('click', onClick);
    dialog.removeEventListener('close', reset);
  } };
}
