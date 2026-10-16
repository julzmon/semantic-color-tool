import { expect, it, vi } from 'vitest';
import { handleModalKeydown } from './settingsKeyboard';

function context() {
  const control = (visible = true, disabled = false) => ({
    tabIndex: 0,
    checkVisibility: () => visible,
    matches: () => disabled,
    closest: () => null,
    focus: vi.fn(),
  });
  const first = control(), last = control(), hidden = control(false), disabled = control(true, true);
  const document = { activeElement: last, defaultView: null };
  const panel = { ownerDocument: document, querySelectorAll: () => [first, last, hidden, disabled] };
  const event = { key: 'Tab', shiftKey: false, currentTarget: panel, preventDefault: vi.fn() };
  return { first, last, hidden, disabled, document, event, close: vi.fn() };
}

it('leaves ordinary sidebar navigation and Escape untouched', () => {
  const test = context();
  handleModalKeydown(test.event as unknown as KeyboardEvent, false, test.close);
  test.event.key = 'Escape';
  handleModalKeydown(test.event as unknown as KeyboardEvent, false, test.close);
  expect(test.event.preventDefault).not.toHaveBeenCalled();
  expect(test.first.focus).not.toHaveBeenCalled();
  expect(test.close).not.toHaveBeenCalled();
});

it('wraps modal focus among visible enabled controls only', () => {
  const test = context();
  handleModalKeydown(test.event as unknown as KeyboardEvent, true, test.close);
  expect(test.event.preventDefault).toHaveBeenCalledOnce();
  expect(test.first.focus).toHaveBeenCalledOnce();
  test.document.activeElement = test.first;
  test.event.shiftKey = true;
  handleModalKeydown(test.event as unknown as KeyboardEvent, true, test.close);
  expect(test.last.focus).toHaveBeenCalledOnce();
  expect(test.hidden.focus).not.toHaveBeenCalled();
  expect(test.disabled.focus).not.toHaveBeenCalled();
});

it('closes the opened drawer on Escape', () => {
  const test = context();
  test.event.key = 'Escape';
  handleModalKeydown(test.event as unknown as KeyboardEvent, true, test.close);
  expect(test.close).toHaveBeenCalledOnce();
  expect(test.event.preventDefault).toHaveBeenCalledOnce();
});
