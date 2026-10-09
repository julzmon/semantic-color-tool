import { readFileSync } from 'node:fs';
import { render } from 'svelte/server';
import { expect, it } from 'vitest';
import { configFromReference } from '../engine/config';
import { generateSystem } from '../engine/generate';
import { parseKdsTokens } from '../engine/reference';
import NeutralRoleMap from './NeutralRoleMap.svelte';
import { buildNeutralRoleMap } from './neutralRoleMap';

const system = generateSystem(configFromReference(parseKdsTokens(
  readFileSync(new URL('../reference/kds-tokens.css', import.meta.url), 'utf8'),
)));

it('renders aligned light and dark maps with accessible stop buttons', () => {
  const markup = render(NeutralRoleMap, { props: { system, modes: ['light', 'dark'] } }).body;
  expect(markup).toContain('Light neutral roles');
  expect(markup).toContain('Dark neutral roles');
  expect(markup).toContain('Neutral role map. Scroll horizontally');
  expect(markup).toContain('aria-pressed="true"');
  expect(markup).toContain('Text');
  expect(markup).toContain('Borders');
  expect(markup).toContain('Surfaces');
  expect(markup).toContain('Fills');
  expect(markup).toContain('SELECTED STOP');
});

it('orders actual neutral primitives and preserves shared role stacks', () => {
  const map = buildNeutralRoleMap(system);
  expect(map.stops.length).toBeGreaterThan(0);
  expect(map.stops.every((stop) => system.primitives.some((item) => item.name === stop.primitive && item.family === 'gray'))).toBe(true);
  expect(map.stops.map((stop) => stop.color.l)).toEqual([...map.stops].map((stop) => stop.color.l).sort((a, b) => b - a));
  expect(map.stops.some((stop) => Object.values(stop.labels.light).flat().length > 1)).toBe(true);
});

it('does not leak labels or checks between modes', () => {
  const map = buildNeutralRoleMap(system);
  for (const stop of map.stops) {
    expect(stop.labels.light).not.toBe(stop.labels.dark);
    expect(new Set(stop.checks.light.map((check) => check.id)).size).toBe(stop.checks.light.length);
    expect(new Set(stop.checks.dark.map((check) => check.id)).size).toBe(stop.checks.dark.length);
    expect(stop.checks.light.every((check) => check.mode === 'light')).toBe(true);
    expect(stop.checks.dark.every((check) => check.mode === 'dark')).toBe(true);
  }
});

it('identifies neutral states derived from an exact lock instead of claiming global tint', () => {
  const input = structuredClone(system.config);
  const neutral = input.families.find(family => family.id === 'neutral')!;
  neutral.hue = 215;
  neutral.chroma = 0.02;
  input.anchors = [{ family: 'neutral', mode: 'both', role: 'emphasis.base', color: 'oklch(0.491 0.0074 120)', locked: true }];
  const locked = generateSystem(input);
  for (const mode of ['light', 'dark'] as const) {
    expect(locked.modes[mode].families.neutral.roles['emphasis.base']!.color.source).toBe(input.anchors[0].color);
    for (const state of ['hover', 'active'] as const) {
      const color = locked.modes[mode].families.neutral.roles[`emphasis.${state}`]!.color;
      expect(color.h).toBe(120);
      expect(color.c).toBe(0.0074);
    }
  }
  const markup = render(NeutralRoleMap, { props: { system: locked, modes: ['light', 'dark'] } }).body;
  expect(markup).toContain('Uses an exact locked neutral state group');
});
