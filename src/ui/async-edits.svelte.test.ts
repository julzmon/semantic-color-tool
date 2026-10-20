// @vitest-environment happy-dom
import reference from 'virtual:kds-reference';
import { flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, expect, it, vi } from 'vitest';
import { configFromReference } from '../engine/config';
import { generateSystem } from '../engine/generate';
import type { ColorAnchor } from '../engine/types';
import AnchorCard from './AnchorCard.svelte';
import ExportPanel from './ExportPanel.svelte';

const initialSystem = generateSystem(configFromReference(reference));
const mounted: Record<string, unknown>[] = [];
afterEach(async () => {
  for (const component of mounted.splice(0)) await unmount(component);
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

function input(label: string): HTMLInputElement {
  const field = [...document.querySelectorAll('label')].find(item => item.textContent?.trim() === label);
  return document.getElementById(field!.htmlFor) as HTMLInputElement;
}

function edit(field: HTMLInputElement, value: string) {
  field.focus();
  field.value = value;
  field.dispatchEvent(new Event('input', { bubbles: true }));
  flushSync();
}

function button(label: string): HTMLButtonElement {
  return [...document.querySelectorAll('button')].find(item => item.textContent?.trim() === label)!;
}

it.each(['copy', 'download'] as const)('waits for prefix validation before %s', async action => {
  const validation = deferred<boolean>();
  const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
  const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
  let downloadedName = '';
  const clickLink = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    downloadedName = this.download;
  });
  const props = $state({ system: initialSystem, prefix: initialSystem.config.prefix,
    onPrefixChange: async (prefix: string) => {
      props.prefix = prefix;
      const accepted = await validation.promise;
      if (accepted) props.system = generateSystem({ ...initialSystem.config, prefix });
      return accepted;
    }, onImport: () => {},
  });
  mounted.push(mount(ExportPanel, { target: document.body, props }));
  flushSync();
  const prefix = input('Token prefix');
  edit(prefix, 'review-test');
  prefix.blur();
  button(action === 'copy' ? 'Copy CSS' : '↓ Download').click();
  await tick();
  expect(writeText).not.toHaveBeenCalled();
  expect(createUrl).not.toHaveBeenCalled();
  validation.resolve(true);
  await vi.waitFor(() => {
    if (action === 'copy') expect(writeText).toHaveBeenCalledWith(expect.stringContaining('--review-test-bg-surface-base'));
    else expect(clickLink).toHaveBeenCalledOnce();
  });
  expect(document.querySelector('.export-status')?.textContent).toContain('review-test-color-system.css');
  if (action === 'download') {
    expect(downloadedName).toBe('review-test-color-system.css');
    expect(await (createUrl.mock.calls[0][0] as Blob).text()).toContain('--review-test-bg-surface-base');
  }
});

it.each([false, undefined])('cancels export if the pending prefix commit returns %s', async result => {
  const validation = deferred<boolean | undefined>();
  const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
  mounted.push(mount(ExportPanel, { target: document.body, props: {
    system: initialSystem, prefix: initialSystem.config.prefix,
    onPrefixChange: () => validation.promise, onImport: () => {},
  } }));
  flushSync();
  const prefix = input('Token prefix');
  edit(prefix, 'review-test');
  prefix.blur();
  button('Copy CSS').click();
  validation.resolve(result);
  await tick();
  await tick();
  expect(writeText).not.toHaveBeenCalled();
  expect(document.querySelector('.export-status')?.textContent).toContain('not accepted');
});

it.each([true, false])('preserves the next anchor coordinate when earlier validation returns %s', async accepted => {
  const validation = deferred<boolean>();
  const original: ColorAnchor = { family: 'brand', mode: 'light', role: 'emphasis.base',
    color: 'oklch(0.5 0.12 29)', locked: true };
  const changes: ColorAnchor[] = [];
  const props = $state({ anchor: original, index: 0, allAnchors: [original],
    onChange: async (next: ColorAnchor) => {
      changes.push(next);
      props.anchor = next;
      const result = await validation.promise;
      props.anchor = { ...(result ? next : original) };
      return result;
    }, onRemove: () => {},
  });
  mounted.push(mount(AnchorCard, { target: document.body, props }));
  flushSync();
  edit(input('Lightness'), '0.51');
  input('Lightness').blur();
  flushSync();
  edit(input('Chroma'), '0.13');
  validation.resolve(accepted);
  await tick();
  await tick();
  expect(input('Chroma').value).toBe('0.13');
  input('Chroma').blur();
  await tick();
  expect(changes).toHaveLength(2);
  expect(changes[1].color).toBe(`oklch(${accepted ? '0.51' : '0.5'} 0.13 29)`);
});

it('checks Brand coordinates after a typing pause while keeping incomplete entries local', async () => {
  vi.useFakeTimers();
  const anchor: ColorAnchor = { family: 'brand', mode: 'light', role: 'emphasis.base', color: 'oklch(0.5 0.12 29)', locked: true };
  const props = $state({ anchor, index: 0, allAnchors: [anchor], onChange: vi.fn(async (next: ColorAnchor) => { props.anchor = next; return true; }), onRemove: () => {} });
  mounted.push(mount(AnchorCard, { target: document.body, props })); flushSync();
  edit(input('Lightness'), ''); await vi.advanceTimersByTimeAsync(400);
  expect(props.onChange).not.toHaveBeenCalled();
  edit(input('Lightness'), '0.51'); await vi.advanceTimersByTimeAsync(299);
  expect(props.onChange).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1); flushSync();
  expect(props.onChange).toHaveBeenCalledWith(expect.objectContaining({ color: 'oklch(0.51 0.12 29)', locked: true }));
  expect(document.activeElement).toBe(input('Lightness'));
  edit(input('Lightness'), '0.53'); input('Lightness').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await vi.advanceTimersByTimeAsync(400); flushSync();
  expect(props.onChange).toHaveBeenCalledTimes(1);
  expect(input('Lightness').value).toBe('0.51');
});
