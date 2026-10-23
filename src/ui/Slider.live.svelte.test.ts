// @vitest-environment happy-dom
import { flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, expect, it, vi } from 'vitest';
import Slider from './Slider.svelte';
import type { ControlAvailabilityView } from './controlAvailability';
const mounted: Record<string, unknown>[] = [];
afterEach(async () => { for (const component of mounted.splice(0)) await unmount(component); document.body.replaceChildren(); vi.useRealTimers(); });
function setup(onChange?: (value: number) => Promise<unknown>, availability?: ControlAvailabilityView) {
  const props = $state({ label: 'Test value', value: .1, min: 0, max: 1, step: .001, availability, ceiling: undefined as number | undefined, limitReason: '',
    rangeStyle: '' as string | ((min: number, max: number) => string), pending: false,
    onChange: vi.fn(onChange ?? (async value => { props.value = Math.min(value, .2); })) });
  mounted.push(mount(Slider, { target: document.body, props })); flushSync();
  const field = document.querySelector<HTMLInputElement>('input[type="number"]')!;
  const type = (value: string) => { field.focus(); field.value = value; field.dispatchEvent(new Event('input', { bubbles: true })); flushSync(); };
  return { props, field, type };
}
it('checks numeric input after a short typing pause and reflects the limited value while focused', async () => {
  vi.useFakeTimers(); const { props, field, type } = setup();
  type('.24'); await vi.advanceTimersByTimeAsync(299); expect(props.onChange).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1); flushSync();
  expect(props.onChange).toHaveBeenCalledWith(.24);
  expect(document.activeElement).toBe(field);
  expect(field.value).toBe('0.2');
});
it('does not overwrite a newer in-progress numeric edit when an older check finishes', async () => {
  vi.useFakeTimers(); let resolve!: () => void;
  const pending = new Promise<void>(done => { resolve = done; });
  const { props, field, type } = setup(async () => pending);
  type('.3'); await vi.advanceTimersByTimeAsync(300);
  type('.4'); props.value = .25; resolve(); await tick(); await tick(); flushSync();
  expect(field.value).toBe('.4');
  await vi.advanceTimersByTimeAsync(300); expect(props.onChange).toHaveBeenLastCalledWith(.4);
});
it('commits immediately on Enter without submitting twice and lets Escape cancel an undispatched edit', async () => {
  vi.useFakeTimers(); const { props, field, type } = setup();
  type('.3'); field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await vi.advanceTimersByTimeAsync(500); expect(props.onChange).not.toHaveBeenCalled();
  expect(field.value).toBe('0.1');
  type('.15'); field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await tick(); await vi.advanceTimersByTimeAsync(500);
  expect(props.onChange).toHaveBeenCalledTimes(1);
  expect(props.onChange).toHaveBeenCalledWith(.15);
});
it('does not send an incomplete empty number to contrast checking', async () => {
  vi.useFakeTimers(); const { props, field, type } = setup();
  type(''); await vi.advanceTimersByTimeAsync(400); expect(props.onChange).not.toHaveBeenCalled();
  field.blur(); await tick(); flushSync();
  expect(document.querySelector('[role="status"]')?.textContent).toContain('Enter a number');
});


it('shows limits on the original track and clamps numeric and range requests', async () => {
  vi.useFakeTimers();
  const availability: ControlAvailabilityView = { descriptor: { key: 'test', label: 'Test value', value: .1, min: 0, max: 1, step: .001, unit: '' }, status: 'ready', samples: [{ value: 0, acceptedValue: .05, safe: true, failedChecks: 0 }, { value: 1, acceptedValue: .2, safe: true, failedChecks: 0 }] };
  const { props, field, type } = setup(undefined, availability);
  const range = document.querySelector<HTMLInputElement>('input[type="range"]')!;
  expect(field.getAttribute('aria-valuemin')).toBe('0.05'); expect(field.getAttribute('aria-valuemax')).toBe('0.2');
  expect(field.min).toBe('0');
  expect(range.getAttribute('aria-valuemin')).toBe('0.05');
  expect(range.getAttribute('aria-valuemax')).toBe('0.2');
  expect(range.min).toBe('0.05'); expect(range.max).toBe('0.2');
  expect(document.querySelector('datalist, .live-control-values, button')).toBeNull();
  type('.9'); await vi.advanceTimersByTimeAsync(300); flushSync();
  expect(props.onChange).toHaveBeenLastCalledWith(.2);
  range.value = '0'; range.dispatchEvent(new Event('input', { bubbles: true }));
  await tick(); await tick(); flushSync();
  expect(props.onChange).toHaveBeenLastCalledWith(.05);
  expect(range.value).toBe('0.05');
  props.availability = { ...availability, status: 'checking', retained: true }; flushSync();
  range.value = '1'; range.dispatchEvent(new Event('input', { bubbles: true })); await tick();
  expect(props.onChange).toHaveBeenLastCalledWith(.2);
  props.availability = { ...availability, status: 'checking', samples: [] }; flushSync();
  expect(range.getAttribute('aria-valuemin')).toBe('0');
  expect(field.max).toBe('1');
  expect(range.style.getPropertyValue('--range-limits')).toBe('');
  expect(range.getAttribute('aria-busy')).toBe('true');
  expect(document.querySelector('.adjustment-note')).toBeNull();
});

it('keeps the newest slider position when an older range request finishes', async () => {
  const requests: { value: number; resolve: () => void }[] = [];
  const { props } = setup(value => new Promise<void>(resolve => requests.push({ value, resolve })));
  const range = document.querySelector<HTMLInputElement>('input[type="range"]')!;
  range.value = '.3'; range.dispatchEvent(new Event('input', { bubbles: true }));
  range.value = '.4'; range.dispatchEvent(new Event('input', { bubbles: true }));
  requests[0].resolve(); await tick(); await tick();
  expect(range.valueAsNumber).toBe(.4);
  props.value = .4; requests[1].resolve(); await tick(); await tick();
  expect(range.valueAsNumber).toBe(.4);
});

it('keeps the original numeric step grid when balanced limits are fractional', () => {
  const availability: ControlAvailabilityView = { descriptor: { key: 'test', label: 'Test value', value: 20, min: 0, max: 100, step: 1, unit: '%' }, status: 'ready', samples: [{ value: 0, acceptedValue: 10.2, safe: true, failedChecks: 0 }, { value: 100, acceptedValue: 90.8, safe: true, failedChecks: 0 }] };
  const { props, field } = setup(undefined, availability);
  props.min = 0; props.max = 100; props.step = 1; props.value = 20; flushSync();
  expect(field.getAttribute('aria-valuemin')).toBe('10.2');
  expect(field.min).toBe('0'); expect(field.step).toBe('1');
  expect(field.validity.stepMismatch).toBe(false);
  props.value = 10.2; flushSync();
  const range = document.querySelector<HTMLInputElement>('input[type=range]')!;
  expect(range.valueAsNumber).toBe(10.2);
  range.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
  expect(props.onChange).toHaveBeenLastCalledWith(11);
});

it('enforces the immediate design ceiling before asynchronous contrast limits arrive', async () => {
  vi.useFakeTimers(); const { props, type } = setup();
  Object.assign(props, { ceiling: .157, limitReason: 'State change limit' }); flushSync();
  const range = document.querySelector<HTMLInputElement>('input[type=range]')!;
  expect(range.getAttribute('aria-valuemax')).toBe('0.157');
  type('.8'); await vi.advanceTimersByTimeAsync(300);
  expect(props.onChange).toHaveBeenLastCalledWith(.157);
  expect(range.getAttribute('title')).toContain('State change limit');
});

it('reaches exact fractional bounds with Home and End', async () => {
  const availability: ControlAvailabilityView = { descriptor: { key: 'test', label: 'Test value', value: .1, min: 0, max: 1, step: .001, unit: '' }, status: 'ready', samples: [{ value: 0, acceptedValue: .0508, safe: true, failedChecks: 0 }, { value: 1, acceptedValue: .2002, safe: true, failedChecks: 0 }] };
  const { props } = setup(undefined, availability);
  const range = document.querySelector<HTMLInputElement>('input[type=range]')!;
  range.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true })); await tick();
  expect(props.onChange).toHaveBeenLastCalledWith(.0508);
  range.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true })); await tick();
  expect(props.onChange).toHaveBeenLastCalledWith(.2002);
});

it('uses the full track, keeps the value when limits grow and clamps once when they shrink', async () => {
  const { props, field } = setup(async next => { props.value = next; });
  props.ceiling = .2; props.rangeStyle = (min, max) => `--test-range: ${min} ${max}`; flushSync();
  const range = document.querySelector<HTMLInputElement>('input[type=range]')!;
  expect(range.min).toBe('0'); expect(range.max).toBe('0.2');
  expect(range.style.getPropertyValue('--test-range')).toBe('0 0.2');
  props.ceiling = .4; flushSync(); await tick();
  expect(range.max).toBe('0.4'); expect(range.valueAsNumber).toBe(.1);
  expect(props.onChange).not.toHaveBeenCalled();
  props.ceiling = .075; flushSync(); await tick(); await tick(); flushSync();
  expect(range.max).toBe('0.075'); expect(range.valueAsNumber).toBe(.075);
  expect(field.value).toBe('0.075');
  expect(props.onChange).toHaveBeenCalledExactlyOnceWith(.075);
});
it('defers automatic limit clamping until an existing edit completes', async () => {
  const { props } = setup(async next => { props.value = next; });
  props.pending = true; props.ceiling = .05; flushSync(); await tick();
  const range = document.querySelector<HTMLInputElement>('input[type=range]')!;
  expect(range.valueAsNumber).toBe(.05);
  expect(props.onChange).not.toHaveBeenCalled();
  props.pending = false; flushSync(); await tick(); await tick();
  expect(props.onChange).toHaveBeenCalledExactlyOnceWith(.05);
});
it.each([[1 + Number.EPSILON, 1], [-Number.EPSILON, 0]])('does not submit floating-point boundary noise on mount (%s)', async (value, displayed) => {
  const onChange = vi.fn(async () => {});
  mounted.push(mount(Slider, { target: document.body, props: { label: 'Boundary value', value, min: 0, max: 1, onChange } }));
  flushSync(); await tick(); await tick();
  expect(onChange).not.toHaveBeenCalled();
  expect(document.querySelector<HTMLInputElement>('input[type=range]')!.valueAsNumber).toBe(displayed);
  expect(document.querySelector<HTMLInputElement>('input[type=number]')!.valueAsNumber).toBe(displayed);
});
it('reaches off-grid fractional bounds by dragging to either physical edge', async () => {
  const availability: ControlAvailabilityView = { descriptor: { key: 'test', label: 'Test value', value: .1, min: 0, max: 1, step: .001, unit: '' }, status: 'ready', samples: [{ value: 0, acceptedValue: .0508, safe: true, failedChecks: 0 }, { value: 1, acceptedValue: .2002, safe: true, failedChecks: 0 }] };
  const { props } = setup(async next => { props.value = next; }, availability);
  const range = document.querySelector<HTMLInputElement>('input[type=range]')!;
  range.value = range.min; range.dispatchEvent(new Event('input', { bubbles: true })); await tick(); await tick();
  expect(props.onChange).toHaveBeenLastCalledWith(.0508);
  range.value = range.max; range.dispatchEvent(new Event('input', { bubbles: true })); await tick(); await tick();
  expect(props.onChange).toHaveBeenLastCalledWith(.2002);
  expect(range.valueAsNumber).toBe(.2002);
});
