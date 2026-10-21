// @vitest-environment happy-dom
import { mount, unmount, flushSync } from 'svelte';
import { afterEach, expect, it, vi } from 'vitest';
import BrandAnchors from './BrandAnchors.svelte';
import reference from 'virtual:kds-reference';
import { configFromReference } from '../engine/config';
import type { ColorAnchor } from '../engine/types';
const defaultConfig = configFromReference(reference);

const brand = defaultConfig.families.find(f => f.id === 'brand')!;
let component: ReturnType<typeof mount>;
afterEach(async () => { if (component) await unmount(component); document.body.innerHTML = ''; });
function setup(anchors: ColorAnchor[] = [], accepted = true) {
  const target = document.createElement('div'); document.body.append(target);
  let current = $state.raw(anchors);
  const onChange = vi.fn(async (next: ColorAnchor[]) => { if (accepted) current = next; return accepted; });
  component = mount(BrandAnchors, { target, props: { brand, get anchors() { return current; }, color: '#c02030', onChange } });
  flushSync(); return onChange;
}
it('starts with one HEX or OKLCH entry and a color picker', () => {
  setup();
  expect(document.querySelector<HTMLInputElement>('[aria-label="Brand color HEX or OKLCH"]')!.value).toBe('#c02030');
  expect(document.querySelector('input[type="color"]')).not.toBeNull();
  expect(document.body.textContent).not.toContain('Add color');
  expect(document.body.textContent).not.toContain('Brand anchor 1');
  expect(document.querySelector('[aria-label="Locked color lightness"]')).toBeNull();
});
it('locks the exact entered source without a conversion', async () => {
  const onChange = setup();
  const input = document.querySelector<HTMLInputElement>('[aria-label="Brand color HEX or OKLCH"]')!;
  input.value = '#12aBcD'; input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('blur')); await new Promise(resolve => setTimeout(resolve, 0));
  expect(onChange.mock.calls.at(-1)![0][0].color).toBe('#12aBcD');
  flushSync();
  const lock = document.querySelector<HTMLInputElement>('input[type=checkbox]')!;
  lock.checked = true; lock.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise(resolve => setTimeout(resolve, 0)); flushSync();
  expect(onChange.mock.calls.at(-1)![0][0]).toMatchObject({ color: '#12aBcD', locked: true });
});
it('shows lock destinations, hides color editing until explicitly requested', async () => {
  setup([{ family: 'brand', color: '#c02030', locked: true, role: 'emphasis.base', mode: 'light' }]);
  expect(document.querySelector<HTMLInputElement>('[aria-label="Brand color HEX or OKLCH"]')!.readOnly).toBe(true);
  expect(document.body.textContent).toContain('Apply to');
  expect(document.body.textContent).toContain('Theme');
  expect(document.body.textContent).not.toContain('Locked color lightness');
  [...document.querySelectorAll('button')].find(el => el.textContent === 'Edit locked color')!.click(); await new Promise(resolve => setTimeout(resolve, 0)); flushSync();
  expect(document.querySelector<HTMLInputElement>('[aria-label="Brand color HEX or OKLCH"]')!.readOnly).toBe(false);
  expect(document.querySelector('[aria-label="Locked color lightness value"]')).not.toBeNull();
});
it('retains the previous source when an edit is rejected', async () => {
  setup([], false);
  const input = document.querySelector<HTMLInputElement>('[aria-label="Brand color HEX or OKLCH"]')!;
  input.value = '#ffffff'; input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('blur'));
  await new Promise(resolve => setTimeout(resolve, 0)); flushSync();
  expect(input.value).toBe('#c02030');
  expect(document.body.textContent).toContain('Previous color retained');
});

it('rejects invalid and transparent source text without changing the configuration', async () => {
  const onChange = setup();
  const input = document.querySelector<HTMLInputElement>('[aria-label="Brand color HEX or OKLCH"]')!;
  for (const value of ['not a color', '#1234']) {
    input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('blur'));
    await new Promise(resolve => setTimeout(resolve, 0)); flushSync();
    expect(onChange).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Enter an opaque HEX color');
  }
});
it('retains additional imported colors when locking the primary color', async () => {
  const additional: ColorAnchor = { family: 'brand', color: '#333333', locked: true, role: 'foreground.base', mode: 'dark' };
  const onChange = setup([{ family: 'brand', color: '#c02030', locked: false, role: 'emphasis.base', mode: 'light' }, additional]);
  const lock = document.querySelector<HTMLInputElement>('.brand-entry-controls > .checkbox-row input')!;
  lock.checked = true; lock.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(onChange.mock.calls.at(-1)![0][1]).toEqual(additional);
});

it('switches displayed formats without changing the exact locked source', async () => {
  const source = '#12aBcD';
  const onChange = setup([{ family: 'brand', color: source, locked: true, role: 'emphasis.base', mode: 'light' }]);
  const selector = document.querySelector<HTMLSelectElement>('[aria-label="Brand color format"]')!;
  const input = document.querySelector<HTMLInputElement>('[aria-label="Brand color HEX or OKLCH"]')!;
  selector.value = 'oklch'; selector.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise(resolve => setTimeout(resolve, 0)); flushSync();
  expect(input.value).toMatch(/^oklch\(/);
  expect(input.readOnly).toBe(true);
  expect(onChange).not.toHaveBeenCalled();
  selector.value = 'hex'; selector.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise(resolve => setTimeout(resolve, 0)); flushSync();
  expect(input.value).toBe(source);
  expect(onChange).not.toHaveBeenCalled();
});
it('accepts an OKLCH source in the selected input format without rounding it', async () => {
  const onChange = setup();
  const selector = document.querySelector<HTMLSelectElement>('[aria-label="Brand color format"]')!;
  selector.value = 'oklch'; selector.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise(resolve => setTimeout(resolve, 0)); flushSync();
  const source = 'oklch(0.5432191 0.1034567 228.12345)';
  const input = document.querySelector<HTMLInputElement>('[aria-label="Brand color HEX or OKLCH"]')!;
  input.value = source; input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('blur'));
  await new Promise(resolve => setTimeout(resolve, 0)); flushSync();
  expect(onChange.mock.calls.at(-1)![0][0].color).toBe(source);
});

it('shows compact values at rest and exact values on focus without submitting a change', async () => {
  const source = 'oklch(0.5432191 0.1034567 228.12345)';
  const onChange = setup([{ family: 'brand', color: source, locked: true, role: 'emphasis.base', mode: 'light' }]);
  const input = document.querySelector<HTMLInputElement>('[aria-label="Brand color HEX or OKLCH"]')!;
  expect(input.value).toBe('oklch(0.543 0.103 228.1)');
  input.focus(); flushSync();
  expect(input.value).toBe(source);
  input.blur(); await new Promise(resolve => setTimeout(resolve, 0)); flushSync();
  expect(input.value).toBe('oklch(0.543 0.103 228.1)');
  expect(onChange).not.toHaveBeenCalled();
  const lock = document.querySelector<HTMLInputElement>('.brand-entry-controls > .checkbox-row input')!;
  lock.checked = false; lock.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise(resolve => setTimeout(resolve, 0)); flushSync();
  expect(onChange.mock.calls.at(-1)![0][0].color).toBe(source);
});
