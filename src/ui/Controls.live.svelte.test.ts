// @vitest-environment happy-dom
import reference from 'virtual:kds-reference';
import { flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, expect, it, vi } from 'vitest';
import { generateSystem } from '../engine/generate';
import { configFromReference } from '../engine/config';
import Controls from './Controls.svelte';
const defaults = () => configFromReference(reference);
const workers: FakeWorker[] = [];
class FakeWorker {
  sent: any[] = []; onmessage: any; onerror: any; terminate = vi.fn();
  constructor() { workers.push(this); }
  postMessage(data: unknown) { this.sent.push(data); }
  requests() { return this.sent.filter(message => message.config); }
  reply(data: unknown) { this.onmessage({ data }); }
}
const mounted: Record<string, unknown>[] = [];
afterEach(async () => { for (const component of mounted.splice(0)) await unmount(component); document.body.replaceChildren(); workers.length = 0; vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it('lazily checks the active control and discards samples when settings or locks change', async () => {
  vi.stubGlobal('Worker', FakeWorker);
  const config = defaults();
  config.families.find(family => family.id === 'info')!.hue = 29;
  let accepted = $state.raw(generateSystem(config));
  let checking = $state(false);
  const props = { get config() { return accepted.config; }, get system() { return accepted; }, get checking() { return checking; }, settingsOpen: false,
    onKeydown: () => {}, onClose: () => {}, onChange: vi.fn(async () => true), onReset: () => {}, onUndo: () => {} };
  mounted.push(mount(Controls, { target: document.body, props })); flushSync();
  expect(workers).toHaveLength(0);
  document.querySelector<HTMLInputElement>('[aria-label="Info hue value"]')!.focus(); flushSync();
  const worker = workers[0]; const original = worker.requests().at(-1);
  expect(original.key).toBe('families.info.hue');
  worker.reply({ id: original.id, sample: { value: 30, safe: true, failedChecks: 0 } });
  worker.reply({ id: original.id, complete: true }); await tick(); flushSync();
  expect(document.querySelector<HTMLInputElement>('[aria-label="Info hue value"]')!.getAttribute('aria-valuemin')).toBe(String(Math.min(config.families.find(f => f.id === 'info')!.hue, 30)));
  checking = true; flushSync();
  expect(document.querySelector<HTMLInputElement>('[aria-label="Info hue value"]')!.getAttribute('aria-valuemin')).toBe(String(Math.min(config.families.find(f => f.id === 'info')!.hue, 30)));
  const locked = structuredClone(config);
  locked.anchors = [{ family: 'brand', mode: 'both', role: 'emphasis.base', color: '#006b75', locked: true }];
  accepted = generateSystem(locked); checking = false; flushSync();
  const latest = worker.requests().at(-1);
  expect(latest.id).not.toBe(original.id);
  expect(latest.config.anchors).toEqual(locked.anchors);
  worker.reply({ id: original.id, sample: { value: 300, safe: true, failedChecks: 0 } }); flushSync();
  expect(document.querySelector<HTMLInputElement>('[aria-label="Info hue value"]')!.getAttribute('aria-valuemax')).toBe('360');
  worker.reply({ id: latest.id, sample: { value: 0, acceptedValue: 20, safe: true, failedChecks: 0 } });
  worker.reply({ id: latest.id, sample: { value: 360, acceptedValue: 60, safe: true, failedChecks: 0 } });
  worker.reply({ id: latest.id, complete: true }); await tick(); flushSync();
  const field = document.querySelector<HTMLInputElement>('[aria-label="Info hue value"]')!;
  expect(field.getAttribute('aria-valuemax')).toBe('60');
  const range = field.closest('.slider-control')!.querySelector<HTMLInputElement>('input[type=range]')!;
  range.value = '90'; range.dispatchEvent(new Event('input', { bubbles: true })); await tick();
  expect(props.onChange).toHaveBeenCalledWith(expect.objectContaining({ anchors: locked.anchors, families: expect.arrayContaining([expect.objectContaining({ id: 'info', hue: 60 })]) }));
  expect(document.querySelector('.live-control-values, datalist')).toBeNull();
});

it('cancels probes while the mobile panel is hidden and resumes when the desktop sidebar becomes visible', () => {
  vi.stubGlobal('Worker', FakeWorker);
  let narrow = true; const listeners = new Set<() => void>();
  vi.spyOn(window, 'matchMedia').mockImplementation(() => ({ get matches() { return narrow; }, addEventListener: (_: string, callback: () => void) => listeners.add(callback), removeEventListener: (_: string, callback: () => void) => listeners.delete(callback) } as unknown as MediaQueryList));
  const config = defaults(); let open = $state(true);
  mounted.push(mount(Controls, { target: document.body, props: { config, system: generateSystem(config), get settingsOpen() { return open; }, onKeydown: () => {}, onClose: () => {}, onChange: async () => true, onReset: () => {}, onUndo: () => {} } })); flushSync();
  document.querySelector<HTMLInputElement>('[aria-label="Brand hue value"]')!.focus(); flushSync();
  const worker = workers[0]; expect(worker.requests()).toHaveLength(1);
  open = false; flushSync();
  expect(worker.sent.at(-1).config).toBeUndefined();
  expect(document.querySelector('.live-control-values')).toBeNull();
  narrow = false; listeners.forEach(listener => listener()); flushSync();
  expect(worker.requests()).toHaveLength(2);
});

it('shows the shared emphasis cap on all state sliders without focusing or probing them', async () => {
  const { balanceConfiguration } = await import('../engine/balance');
  const { emphasisStrengthLimit, mutedStrengthLimit } = await import('../engine/emphasis-limits');
  const config = defaults(); config.emphasis.selected = true;
  config.muted.mixWeights = {hover:.95,active:.9,selected:.85};
  const accepted = balanceConfiguration(config, config);
  mounted.push(mount(Controls, { target: document.body, props: { config: accepted.config, system: accepted.system, onKeydown: () => {}, onClose: () => {}, onChange: async () => true, onReset: () => {}, onUndo: () => {} } })); flushSync();
  for (const group of ['muted','emphasis'] as const) {
  const maximum = Number(((group === 'muted' ? mutedStrengthLimit : emphasisStrengthLimit)(accepted.system) * 100).toFixed(3));
  for (const label of ['Hover', 'Pressed', 'Selected']) {
    const field = document.querySelector<HTMLInputElement>(`[aria-label="${label} ${group} strength value"]`)!;
    const range = field.closest('.slider-control')!.querySelector<HTMLInputElement>('input[type=range]')!;
    expect(field.step).toBe('0.1');
    expect(Number(range.getAttribute('aria-valuemax'))).toBe(maximum);
    expect(maximum).toBeLessThanOrEqual(25);
    expect(Number(range.max)).toBe(maximum);
    expect(range.style.getPropertyValue('--range-limits')).toBe('');
  }
  }
  expect(workers).toHaveLength(0);
});

it('uses one Brand entry and swaps family sliders for lock destinations', async () => {
  const initial = defaults();
  let accepted = $state.raw(generateSystem(initial));
  const currentConfig = () => accepted.config;
  const onChange = vi.fn(async (next: typeof initial) => { accepted = generateSystem(next); return true; });
  mounted.push(mount(Controls, { target: document.body, props: { get config() { return accepted.config; }, get system() { return accepted; }, onChange, onKeydown() {}, onClose() {}, onReset() {}, onUndo() {} } }));
  flushSync();
  const input = document.querySelector<HTMLInputElement>('[aria-label="Brand color HEX or OKLCH"]')!;
  const selector = document.querySelector<HTMLSelectElement>('[aria-label="Brand color format"]')!;
  selector.value = 'hex'; selector.dispatchEvent(new Event('change', { bubbles: true }));
  await tick(); flushSync();
  input.value = '#c02030'; input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('blur'));
  await tick(); flushSync();
  expect(currentConfig().anchors[0].color).toBe('#c02030');
  const hue = document.querySelector<HTMLInputElement>('[aria-label="Brand hue value"]')!;
  expect(Number(hue.value)).toBeCloseTo(currentConfig().families.find(family => family.id === 'brand')!.hue, 2);
  const lock = document.querySelector<HTMLInputElement>('.brand-entry-controls > .checkbox-row input')!;
  lock.checked = true; lock.dispatchEvent(new Event('input', { bubbles: true }));
  await tick(); await tick(); flushSync();
  expect(currentConfig().anchors[0]).toMatchObject({ color: '#c02030', locked: true });
  expect(document.querySelector('[aria-label="Brand hue value"]')).toBeNull();
  expect(document.querySelector('[aria-label="Brand chroma value"]')).toBeNull();
  expect(document.body.textContent).toContain('Apply to');
  lock.checked = false; lock.dispatchEvent(new Event('input', { bubbles: true }));
  await tick(); await tick(); flushSync();
  expect(document.querySelector('[aria-label="Brand hue value"]')).not.toBeNull();
  expect(input.value).toBe('#c02030');
});
