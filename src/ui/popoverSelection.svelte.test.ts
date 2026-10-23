// @vitest-environment happy-dom
import reference from 'virtual:kds-reference';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, expect, it } from 'vitest';
import { configFromReference } from '../engine/config';
import { generateSystem } from '../engine/generate';
import NeutralRoleMap from './NeutralRoleMap.svelte';
import Primitives from './Primitives.svelte';

const system = generateSystem(configFromReference(reference));
const mounted: Record<string, unknown>[] = [];
afterEach(async () => {
  for (const component of mounted.splice(0)) await unmount(component);
  document.body.replaceChildren();
});
function toggle(popup: HTMLElement, open: boolean) {
  popup.dispatchEvent(Object.assign(new Event('beforetoggle'), { newState: open ? 'open' : 'closed' }));
  flushSync();
}

it('loads the role map without a selected swatch or focused control', () => {
  mounted.push(mount(NeutralRoleMap, { target: document.body, props: { system, modes: ['light', 'dark'] } }));
  flushSync();
  expect(document.querySelector('.role-map-stop.selected, .role-map-stop[aria-pressed="true"]')).toBeNull();
  expect(document.querySelector('.color-inspection-anchor')).toBeNull();
  expect(document.activeElement).toBe(document.body);
});

it('highlights only the inspected mode and clears selection styling on dismissal without blurring keyboard focus', () => {
  mounted.push(mount(NeutralRoleMap, { target: document.body, props: { system, modes: ['light', 'dark'] } }));
  flushSync();
  const stop = document.querySelector<HTMLButtonElement>('.role-map-stop')!;
  const popup = document.getElementById('neutral-color-details')!;
  stop.focus(); stop.click(); toggle(popup, true);
  expect([...document.querySelectorAll('.role-map-stop.selected')]).toEqual([stop]);
  expect(document.querySelectorAll('.role-map-stop[aria-pressed="true"]')).toHaveLength(1);
  toggle(popup, false);
  expect(document.querySelector('.role-map-stop.selected, .role-map-stop[aria-pressed="true"]')).toBeNull();
  expect(document.activeElement).toBe(stop);
  stop.click(); toggle(popup, true);
  expect(document.querySelector('.role-map-stop.selected')).toBe(stop);
});

it('clears palette selection on dismissal while preserving the focused invoker', () => {
  mounted.push(mount(Primitives, { target: document.body, props: { system } }));
  flushSync();
  const swatch = document.querySelector<HTMLButtonElement>('.primitive-grid button')!;
  const popup = document.getElementById('palette-color-details')!;
  swatch.focus(); swatch.click(); toggle(popup, true);
  expect(swatch.getAttribute('aria-pressed')).toBe('true');
  toggle(popup, false);
  expect(swatch.getAttribute('aria-pressed')).toBe('false');
  expect(document.activeElement).toBe(swatch);
});
