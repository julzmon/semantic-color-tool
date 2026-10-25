// @vitest-environment happy-dom
import { flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, expect, it, vi } from 'vitest';
import { configFromReference } from '../engine/config';
import { generateSystem } from '../engine/generate';
import { effectiveCurve, withChromaCurves } from '../engine/chroma-curves';
import type { BuilderConfig } from '../engine/types';
import reference from 'virtual:kds-reference';
import ChromaCurves from './ChromaCurves.svelte';

const mounted: ReturnType<typeof mount>[] = [];
afterEach(async () => {
  for (const component of mounted.splice(0)) await unmount(component);
  document.body.replaceChildren();
});
function setup(config = withChromaCurves(configFromReference(reference)), checking = false) {
  const onChange = vi.fn(async (_next: BuilderConfig) => true);
  mounted.push(mount(ChromaCurves, { target: document.body, props: {
    config, system: generateSystem(config), onChange, checking,
  } }));
  flushSync();
  return { config, onChange };
}
function range(label: string) {
  const element = [...document.querySelectorAll('label')].find(node => node.textContent === label);
  expect(element, label).toBeDefined();
  return document.getElementById(element!.htmlFor) as HTMLInputElement;
}
async function change(label: string, value: number) {
  const input = range(label);
  input.value = String(value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await tick();
}

it('shows two always-open curve groups, shared semantic families, and accessible plots', () => {
  setup();
  expect([...document.querySelectorAll('h4')].map(heading => heading.textContent)).toEqual(['Brand', 'Semantic colors']);
  expect(document.querySelector('details, summary')).toBeNull();
  expect(document.querySelectorAll('svg[role="img"]')).toHaveLength(2);
  for (const svg of document.querySelectorAll('svg')) {
    expect(document.getElementById(svg.getAttribute('aria-labelledby')!)?.textContent).toContain('chroma by lightness');
    expect(svg.querySelector('desc')?.textContent).toContain('hue-specific sRGB');
  }
  expect(document.querySelectorAll('.gamut-curve')).toHaveLength(5);
  const text = document.body.textContent!;
  for (const name of ['Info', 'Positive', 'Negative', 'Warning']) expect(text).toContain(name);
  expect(text).not.toContain('Neutral');
  expect(document.querySelectorAll('input[type="range"]')).toHaveLength(8);
});

it('sends shared semantic edits through contrast checking without altering Brand', async () => {
  const { config, onChange } = setup();
  await change('Semantic peak chroma', 0.17);
  expect(onChange).toHaveBeenCalledTimes(1);
  const next = onChange.mock.calls[0][0];
  expect(next.chromaCurves!.semantic.peakChroma).toBe(0.17);
  expect(next.chromaCurves!.brand).toEqual(config.chromaCurves!.brand);
  expect(next.families).toEqual(config.families);
  expect(next.anchors).toEqual(config.anchors);
  expect(config.chromaCurves!.semantic.peakChroma).not.toBe(0.17);
});

it('pins locked Brand peak values while preserving editable end shapes', async () => {
  const config = withChromaCurves(configFromReference(reference));
  config.anchors = [{ family: 'brand', mode: 'both', role: 'emphasis.base', color: 'oklch(0.6 0.18 25)', locked: true }];
  const { onChange } = setup(config);
  const chroma = document.querySelector<HTMLInputElement>('[aria-label="Brand peak chroma value"]')!;
  const lightness = document.querySelector<HTMLInputElement>('[aria-label="Brand peak lightness value"]')!;
  expect(chroma.readOnly).toBe(true);
  expect(lightness.readOnly).toBe(true);
  expect(Number(chroma.value)).toBeCloseTo(effectiveCurve(config, 'brand').peakChroma);
  expect(Number(lightness.value)).toBeCloseTo(0.6);
  expect(document.querySelectorAll('.pin')).toHaveLength(1);
  expect(document.querySelectorAll('input[type="range"]')).toHaveLength(6);
  await change('Brand dark-end shape', 75);
  expect(onChange.mock.calls[0][0].chromaCurves!.brand.darkBend).toBe(0.75);
  expect(onChange.mock.calls[0][0].anchors).toEqual(config.anchors);
  expect(onChange.mock.calls[0][0].chromaCurves!.semantic).toEqual(config.chromaCurves!.semantic);
});

it('shows pending state and keeps exact pin chroma inside the graph scale', () => {
  const config = withChromaCurves(configFromReference(reference));
  config.anchors = [{ family: 'brand', mode: 'both', role: 'emphasis.base', color: 'oklch(0.6 0.45 25)', locked: true }];
  setup(config, true);
  expect(document.querySelector('section')?.getAttribute('aria-busy')).toBe('true');
  const marker = document.querySelector('circle.pin')!;
  expect(Number(marker.getAttribute('cy'))).toBeGreaterThanOrEqual(16);
  expect(Number(marker.getAttribute('cy'))).toBeLessThanOrEqual(126);
  expect(document.querySelector('svg desc')?.textContent).toContain('0.450');
});
