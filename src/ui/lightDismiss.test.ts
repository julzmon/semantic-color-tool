import { expect, it, vi } from 'vitest';
import { lightDismiss } from './lightDismiss';

function setup(native = false) {
  const dialog = Object.assign(new EventTarget(), {
    close: vi.fn(),
    getBoundingClientRect: () => ({ left: 100, right: 500, top: 100, bottom: 500 }),
    ...(native ? { closedBy: 'any' } : {}),
  });
  const action = lightDismiss(dialog as unknown as HTMLDialogElement);
  const event = (type: string, x: number, y: number) => {
    const event = Object.assign(new Event(type), { clientX: x, clientY: y, button: 0, detail: 1 });
    dialog.dispatchEvent(event);
  };
  return { dialog, action, event };
}

it('closes the fallback dialog after a click outside its bounds', () => {
  const { dialog, event } = setup();
  event('pointerdown', 50, 200);
  event('click', 50, 200);
  expect(dialog.close).toHaveBeenCalledOnce();
});

it('keeps the fallback dialog open for clicks inside its padding', () => {
  const { dialog, event } = setup();
  event('pointerdown', 105, 105);
  event('click', 105, 105);
  expect(dialog.close).not.toHaveBeenCalled();
});

it('does not dismiss when a gesture starts inside and ends outside', () => {
  const { dialog, event } = setup();
  event('pointerdown', 200, 200);
  event('click', 50, 200);
  expect(dialog.close).not.toHaveBeenCalled();
});

it('does not dismiss when a gesture starts outside and ends inside', () => {
  const { dialog, event } = setup();
  event('pointerdown', 50, 200);
  event('click', 200, 200);
  expect(dialog.close).not.toHaveBeenCalled();
});

it('cleans up the fallback listeners', () => {
  const { dialog, action, event } = setup();
  action?.destroy();
  event('pointerdown', 50, 200);
  event('click', 50, 200);
  expect(dialog.close).not.toHaveBeenCalled();
});

it('lets the browser handle dismissal when closedBy is supported', () => {
  const { dialog, event } = setup(true);
  event('pointerdown', 50, 200);
  event('click', 50, 200);
  expect(dialog.close).not.toHaveBeenCalled();
});
