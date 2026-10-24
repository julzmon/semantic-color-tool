// @vitest-environment happy-dom
import reference from 'virtual:kds-reference';
import { flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import * as balancing from './engine/balance';
import * as feasibility from './engine/feasibility';
import { defaultConfiguration } from './ui/defaultConfiguration';
import { CONFIGURATION_STORAGE_KEY } from './ui/configuration';
import App from './App.svelte';

const defaults = defaultConfiguration(reference);
const verified = balancing.balanceConfiguration(defaults, defaults);
const workers: FakeWorker[] = [];
class FakeWorker {
  sent: { previous: typeof defaults; requested: typeof defaults; action?: string }[] = [];
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  terminate = vi.fn();
  constructor() { workers.push(this); }
  postMessage(value: (typeof this.sent)[number]) { this.sent.push(value); }
  reply(data: unknown) { this.onmessage?.({ data }); }
}
const mounted: Record<string, unknown>[] = [];
beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
    clear: () => values.clear(),
  });
});
afterEach(async () => {
  for (const component of mounted.splice(0)) await unmount(component);
  document.body.replaceChildren(); window.localStorage.clear(); workers.length = 0;
  vi.restoreAllMocks(); vi.unstubAllGlobals();
});
function start() {
  vi.stubGlobal('Worker', FakeWorker);
  mounted.push(mount(App, { target: document.body })); flushSync();
  return workers[0];
}
async function reply(worker: FakeWorker, data: unknown = { result: structuredClone(verified) }) {
  worker.reply(data); await tick(); flushSync();
}
function button(text: string) {
  return [...document.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent?.trim() === text)!;
}
function toggle(element: HTMLElement, open: boolean) {
  element.dispatchEvent(Object.assign(new Event('beforetoggle'), { newState: open ? 'open' : 'closed' }));
  element.dispatchEvent(Object.assign(new Event('toggle'), { newState: open ? 'open' : 'closed' }));
  flushSync();
}

it('reduces lightness in the worker, reports progress, saves the result and supports Undo', async () => {
  const worker = start(); await reply(worker);
  const original = window.localStorage.getItem(CONFIGURATION_STORAGE_KEY);
  const reduce = button('Reduce lightness stops');
  reduce.click(); flushSync();
  expect(reduce.disabled).toBe(true);
  expect(worker.sent.at(-1)?.action).toBe('reduce-lightness');
  expect(document.querySelector('.configuration-status [role=status]')?.textContent).toContain('Reducing');
  const result = structuredClone(verified);
  result.config.surfaces.step = { light: 0.012, dark: 0.014 };
  result.system.config = result.config;
  result.message = 'Reduced shared lightness stops from 30 to 27.';
  await reply(worker, { result });
  expect(document.querySelector('.configuration-status')?.textContent).toContain('30 to 27');
  expect(document.querySelector('.lightness-feedback')?.textContent).toContain('30 to 27');
  expect(window.localStorage.getItem(CONFIGURATION_STORAGE_KEY)).not.toBe(original);
  expect(reduce.disabled).toBe(false);
  reduce.click(); flushSync();
  await reply(worker, { result: { ...result, message: 'No safe reduction was found within the bounded search.' } });
  expect(document.querySelector('.lightness-feedback')?.textContent).toContain('No safe reduction');
  button('Undo last change').click(); flushSync();
  expect(window.localStorage.getItem(CONFIGURATION_STORAGE_KEY)).toBe(original);
  expect(document.querySelector('.configuration-status')?.textContent).toContain('undone');
});

it('retains the palette on reduction failure and ignores a reduction superseded by Reset', async () => {
  const worker = start(); await reply(worker);
  const original = window.localStorage.getItem(CONFIGURATION_STORAGE_KEY);
  button('Reduce lightness stops').click(); flushSync();
  await reply(worker, { error: 'No verified result available' });
  expect(window.localStorage.getItem(CONFIGURATION_STORAGE_KEY)).toBe(original);
  expect(button('Reduce lightness stops').disabled).toBe(false);
  expect(document.querySelector('.configuration-status')?.textContent).toContain('No verified result');
  button('Reduce lightness stops').click(); flushSync();
  button('Reset').click(); flushSync();
  await reply(worker, { result: { ...structuredClone(verified), message: 'Obsolete reduction' } });
  expect(document.querySelector('.configuration-status')?.textContent).not.toContain('Obsolete reduction');
  expect(worker.sent.at(-1)?.action).toBeUndefined();
  await reply(worker);
  expect(document.querySelector('.configuration-status')?.textContent).toContain('Default colors restored');
});

it('renders loading and restores through the worker before showing the workspace', async () => {
  const calculate = vi.spyOn(balancing, 'balanceConfiguration');
  const worker = start();
  expect(calculate).not.toHaveBeenCalled();
  expect(document.querySelector('[role=status]')?.textContent).toContain('Loading');
  expect(document.querySelector('.settings-sidebar')).toBeNull();
  expect(worker.sent).toHaveLength(1);
  expect(worker.sent[0].requested).toEqual(defaults);
  await reply(worker);
  expect(document.querySelector('.settings-sidebar')).not.toBeNull();
  expect(document.querySelector('.preview-grid')?.textContent).toContain('Light theme');
  expect(document.querySelector('.preview-grid')?.textContent).toContain('Dark theme');
  expect(document.querySelector('#workspace .workspace-tabs')).not.toBeNull();
  expect(document.querySelector('.mode-switch, [aria-label="Preview mode"]')).toBeNull();
  expect(document.querySelector('#workspace')?.textContent).toContain('Color palette');
  expect(document.body.textContent).not.toContain('Quick color controls');
});

it('retains saved settings on startup failure and supports retrying worker initialization', async () => {
  const saved = JSON.stringify({ formatVersion: 1, config: verified.config });
  window.localStorage.setItem(CONFIGURATION_STORAGE_KEY, saved);
  vi.stubGlobal('Worker', class { constructor() { throw new Error('Worker unavailable'); } });
  mounted.push(mount(App, { target: document.body })); flushSync();
  expect(document.querySelector('[role=alert]')?.textContent).toContain('Worker unavailable');
  expect(window.localStorage.getItem(CONFIGURATION_STORAGE_KEY)).toBe(saved);
  vi.stubGlobal('Worker', FakeWorker);
  button('Retry loading').click(); flushSync();
  await reply(workers[0]);
  expect(document.querySelector('.settings-sidebar')).not.toBeNull();
});

it('retries defaults in the worker when saved settings cannot be restored', async () => {
  const stored = { ...verified.config, solvingStrategy: 'prefer-shared' };
  window.localStorage.setItem(CONFIGURATION_STORAGE_KEY, JSON.stringify({ formatVersion: 1, config: stored }));
  const worker = start();
  expect(worker.sent[0].requested.solvingStrategy).toBe('prefer-shared');
  await reply(worker, { error: 'Saved locks cannot pass' });
  expect(worker.sent).toHaveLength(2);
  expect(worker.sent[1].requested).toEqual(defaults);
  await reply(worker);
  expect(document.querySelector('.configuration-status')?.textContent).toContain('restored defaults');
});

it('retains saved settings if restoration and default initialization both fail', async () => {
  const saved = JSON.stringify({ formatVersion: 1, config: verified.config });
  window.localStorage.setItem(CONFIGURATION_STORAGE_KEY, saved);
  const worker = start();
  await reply(worker, { error: 'Saved settings rejected' });
  await reply(worker, { error: 'Worker calculation failed' });
  expect(document.querySelector('[role=alert]')?.textContent).toContain('Worker calculation failed');
  expect(window.localStorage.getItem(CONFIGURATION_STORAGE_KEY)).toBe(saved);
});

it('terminates the startup worker on unmount and ignores its late reply', async () => {
  const worker = start();
  await unmount(mounted.pop()!);
  expect(worker.terminate).toHaveBeenCalledOnce();
  await reply(worker);
  expect(document.querySelector('.settings-sidebar')).toBeNull();
});

it('uses the worker for Reset and ignores an older edit result', async () => {
  const calculate = vi.spyOn(balancing, 'balanceConfiguration');
  const worker = start(); await reply(worker);
  const count = document.querySelector<HTMLButtonElement>('[aria-label="4 surfaces"]')!;
  count.click(); flushSync();
  button('Reset').click(); flushSync();
  expect(calculate).not.toHaveBeenCalled();
  await reply(worker, { result: { ...structuredClone(verified), message: 'Obsolete edit' } });
  expect(worker.sent.at(-1)?.requested).toEqual(defaults);
  expect(document.querySelector('.configuration-status')?.textContent).not.toContain('Obsolete edit');
  await reply(worker);
  expect(document.querySelector('.configuration-status')?.textContent).toContain('Default colors restored');
  expect(document.querySelector('[aria-label="3 surfaces"]')?.getAttribute('aria-pressed')).toBe('true');
});

it('unmounts expensive token diagnostics when the popup or full-details section closes', async () => {
  const inspect = vi.spyOn(feasibility, 'inspectFeasibility');
  const worker = start(); await reply(worker);
  document.querySelector<HTMLButtonElement>('[aria-label="Inspect Brand foreground Base in light theme"]')!.click();
  flushSync();
  const popup = document.getElementById('preview-color-info')!;
  toggle(popup, true);
  expect(popup.querySelector('.inspector')).toBeNull();
  const full = popup.querySelector<HTMLDetailsElement>('.color-inspection-details')!;
  full.open = true; full.dispatchEvent(new Event('toggle')); flushSync();
  expect(popup.querySelector('.inspector')).not.toBeNull();
  const details = popup.querySelector<HTMLDetailsElement>('.feasibility-details')!;
  details.open = true; details.dispatchEvent(new Event('toggle')); flushSync();
  expect(inspect).toHaveBeenCalledOnce();
  toggle(popup, false);
  expect(popup.querySelector('.inspector')).toBeNull();
  document.querySelector<HTMLButtonElement>('[aria-label="Inspect Info foreground Base in light theme"]')!.click(); flushSync();
  expect(inspect).toHaveBeenCalledOnce();
  toggle(popup, true); flushSync();
  full.open = false; full.dispatchEvent(new Event('toggle')); flushSync();
  expect(popup.querySelector('.inspector')).toBeNull();
});

it('does not mount stale popup diagnostics after leaving and returning to Overview', async () => {
  const worker = start(); await reply(worker);
  document.querySelector<HTMLButtonElement>('[aria-label="Inspect Brand foreground Base in light theme"]')!.click(); flushSync();
  toggle(document.getElementById('preview-color-info')!, true);
  const details = document.querySelector<HTMLDetailsElement>('#preview-color-info .color-inspection-details')!;
  details.open = true; details.dispatchEvent(new Event('toggle')); flushSync();
  expect(document.querySelector('#preview-color-info .inspector')).not.toBeNull();
  button('Color palette').click(); flushSync();
  button('Overview').click(); flushSync();
  expect(document.querySelector('#preview-color-info .inspector')).toBeNull();
});

it('clears preview anchor highlighting when its popup closes', async () => {
  const worker = start(); await reply(worker);
  const invoker = document.querySelector<HTMLButtonElement>('[aria-label="Inspect Brand foreground Base in light theme"]')!;
  invoker.focus(); invoker.click(); flushSync();
  const popup = document.getElementById('preview-color-info')!;
  toggle(popup, true);
  expect(document.querySelector('.preview-shell .color-inspection-anchor')).toBe(invoker);
  toggle(popup, false);
  expect(document.querySelector('.preview-shell .color-inspection-anchor')).toBeNull();
  expect(document.activeElement).toBe(invoker);
});
