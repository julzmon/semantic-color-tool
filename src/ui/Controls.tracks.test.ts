import { readFileSync } from 'node:fs';
import { converter } from 'culori';
import { render } from 'svelte/server';
import { expect, it } from 'vitest';
import { configFromReference, parseKdsTokens } from '../engine/reference';
import { generateSystem } from '../engine/generate';
import type { BuilderConfig, Mode } from '../engine/types';
import Controls from './Controls.svelte';

const defaults = configFromReference(parseKdsTokens(readFileSync(new URL('../reference/kds-tokens.css', import.meta.url), 'utf8')));
const system = generateSystem(defaults);
const oklch = converter('oklch');
function track(config: BuilderConfig, label: string, occurrence = 0) {
  const markup = render(Controls, { props: { config, system, onKeydown() {}, onClose() {}, onChange: async () => true, onReset() {}, onUndo() {} } }).body;
  const labels = [...markup.matchAll(/<label for="([^"]+)">([^<]+)<\/label>/g)].filter(match => match[2] === label);
  const input = markup.match(new RegExp(`<input id="${labels[occurrence][1]}"[^>]*type="range"[^>]*>`))?.[0];
  expect(input).toBeDefined();
  const style = input!.match(/style="([^"]+)"/)?.[1] ?? '';
  const stops = [...style.matchAll(/(oklch\([^)]+\)) ([\d.]+)%/g)].map(match => ({ color: oklch(match[1])!, position: Number(match[2]) }));
  expect(stops.length, `${label} must preview its actual range`).toBeGreaterThan(2);
  return { style, stops };
}

it('aligns hue stops with OKLCH degrees instead of an approximate RGB rainbow', () => {
  const { stops } = track(defaults, 'Brand hue');
  for (const stop of stops) expect(stop.color.h! % 360).toBeCloseTo(stop.position * 3.6 % 360, 5);
});

it('keeps chroma range endpoints independent of the current chroma', () => {
  const low = structuredClone(defaults);
  const high = structuredClone(defaults);
  low.families.find(f => f.id === 'brand')!.chroma = 0;
  high.families.find(f => f.id === 'brand')!.chroma = 0.3;
  const first = track(low, 'Brand chroma');
  const second = track(high, 'Brand chroma');
  expect(first.style).toBe(second.style);
  expect(first.stops[0].color.c).toBe(0);
  expect(first.stops.at(-1)!.color.c).toBeGreaterThan(0.1);
});

it('previews the deepest surface with the proper direction and neutral tint', () => {
  const config = structuredClone(defaults);
  config.surfaces.levels = 3;
  config.surfaces.light.l = 0.9;
  config.surfaces.dark.l = 0.2;
  for (const [index, mode] of ['light', 'dark'].entries()) {
    const { stops } = track(config, 'Level spacing', index);
    expect(stops[0].color.l).toBeCloseTo(config.surfaces[mode as Mode].l + (mode === 'light' ? -1 : 1) * 0.002);
    expect(stops.at(-1)!.color.l).toBeCloseTo(mode === 'light' ? 0.5 : 0.6);
    expect(stops[0].color.h).toBeCloseTo(config.families.find(f => f.id === 'neutral')!.hue);
  }
  config.surfaces.levels = 1;
  const { stops } = track(config, 'Level spacing');
  expect(new Set(stops.map(stop => stop.color.l)).size).toBe(1);
});

it('previews muted Brand lightness and chroma independently in each theme', () => {
  const config = structuredClone(defaults);
  config.surfaces.light.l = 0.8;
  config.surfaces.dark.l = 0.2;
  config.muted.distance = { light: 0.1, dark: 0.1 };
  for (const [index, mode] of ['light', 'dark'].entries()) {
    const distance = track(config, 'Muted distance', index).stops;
    expect(distance[0].color.l).toBeCloseTo(mode === 'light' ? 0.88 : 0.12);
    expect(distance.at(-1)!.color.l).toBeCloseTo(mode === 'light' ? 0.64 : 0.7);
    const chroma = track(config, 'Muted chroma', index).stops;
    expect(chroma[0].color.c).toBe(0);
    for (const stop of chroma) expect(stop.color.l).toBeCloseTo(mode === 'light' ? 0.7 : 0.3);
    expect(chroma.at(-1)!.color.c).toBeGreaterThan(0);
  }
});

it('shows state spacing as light/dark Brand bands and respects reversed dark emphasis', () => {
  const config = structuredClone(defaults);
  const matched = track(config, 'Emphasis state spacing');
  const midpoint = matched.stops.length / 2;
  expect(matched.style).toContain('top / 100% 50% no-repeat');
  expect(matched.style).toContain('bottom / 100% 50% no-repeat');
  expect(matched.stops.slice(0, midpoint)).toEqual(matched.stops.slice(midpoint));
  config.emphasis.reverseDarkStates = true;
  const reversed = track(config, 'Emphasis state spacing').stops;
  expect(reversed[midpoint - 1].color.l).toBeLessThan(reversed[0].color.l);
  expect(reversed.at(-1)!.color.l).toBeGreaterThan(reversed[midpoint].color.l);
  const muted = track(config, 'Muted state spacing').stops;
  expect(muted[muted.length / 2 - 1].color.l).toBeLessThan(muted[0].color.l);
  expect(muted.at(-1)!.color.l).toBeGreaterThan(muted[muted.length / 2].color.l);
});

it('previews stronger muted borders independently in light and dark mode', () => {
  const light = track(defaults, 'Muted border strength', 0).stops;
  const dark = track(defaults, 'Muted border strength', 1).stops;
  expect(light.at(-1)!.color.l).toBeLessThan(light[0].color.l);
  expect(dark.at(-1)!.color.l).toBeGreaterThan(dark[0].color.l);
  for (const stop of [...light, ...dark]) expect(stop.color.h).toBeCloseTo(defaults.families.find(family => family.id === 'brand')!.hue, 5);
});
