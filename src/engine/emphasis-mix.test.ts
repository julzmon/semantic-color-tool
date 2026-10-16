import { readFileSync } from 'node:fs';
import { converter, interpolate } from 'culori';
import { expect, it } from 'vitest';
import { generateSystem } from './generate';
import { configFromReference, parseKdsTokens } from './reference';
import { cssTokenModel } from './tokens';

const defaults = () => configFromReference(parseKdsTokens(readFileSync(new URL('../reference/kds-tokens.css', import.meta.url), 'utf8')));
const oklch = converter('oklch');

it.each([false, true])('generates every emphasis state from shared opaque mix weights (reverse: %s)', reverseDarkStates => {
  const config = defaults();
  config.emphasis = { ...config.emphasis, selected: true, reverseDarkStates,
    mixWeights: { hover: 0.92, active: 0.85, selected: 0.8 } };
  const system = generateSystem(config);
  expect(cssTokenModel(system).settings.find(token => token.name === '--kds-emphasis-state-target')?.value)
    .toBe(reverseDarkStates ? 'light-dark(oklch(0 0 none), oklch(1 0 none))' : 'oklch(0 0 none)');
  for (const mode of ['light', 'dark'] as const) for (const family of config.families) {
    const roles = system.modes[mode].families[family.id].roles;
    const base = roles['emphasis.base']!.color;
    for (const state of ['hover', 'active', 'selected'] as const) {
      const expected = oklch(interpolate([base.css, mode === 'dark' && reverseDarkStates ? 'white' : 'black'], 'oklch')(1 - config.emphasis.mixWeights![state]))!;
      const actual = roles[`emphasis.${state}`]!.color;
      expect(actual.l).toBeCloseTo(expected.l, 9);
      expect(actual.c).toBeCloseTo(expected.c, 9);
      expect(actual.h).toBeCloseTo(expected.h ?? base.h, 9);
    }
  }
  expect(system.checks.every(check => check.pass)).toBe(true);
});

it('rejects malformed or unordered shared weights', () => {
  for (const mixWeights of [
    { hover: NaN, active: 0.85, selected: 0.8 },
    { hover: 1.1, active: 0.85, selected: 0.8 },
    { hover: 0.8, active: 0.9, selected: 0.7 },
  ]) {
    const config = defaults();
    expect(() => generateSystem({ ...config, emphasis: { ...config.emphasis, mixWeights } })).toThrow(/weight/i);
  }
});

it('preserves a literal locked base while deriving its states by mixing', () => {
  const config = defaults();
  config.emphasis.mixWeights = { hover: 0.92, active: 0.85, selected: 0.8 };
  config.anchors = [{ family: 'brand', mode: 'both', role: 'emphasis.base', color: 'oklch(0.45 0.12 29)', locked: true }];
  const system = generateSystem(config);
  for (const mode of ['light', 'dark'] as const) {
    const roles = system.modes[mode].families.brand.roles;
    expect(roles['emphasis.base']!.color.source).toBe(config.anchors[0].color);
    expect(roles['emphasis.active']!.color.c).toBeCloseTo(0.12 * 0.85, 9);
    expect(roles['emphasis.active']!.color.source).toBeUndefined();
  }
});

it('uses a dark-only exact base in the shared lightness search for every family', () => {
  const config = defaults();
  config.anchors = [{ family: 'brand', mode: 'dark', role: 'emphasis.base', color: 'oklch(0.45 0.12 29)', locked: true }];
  const system = generateSystem(config);
  for (const mode of ['light', 'dark'] as const) for (const family of config.families) {
    expect(system.modes[mode].families[family.id].roles['emphasis.base']!.color.l).toBe(0.45);
  }
  expect(system.checks.every(check => check.pass)).toBe(true);
});

it('reuses a verified CSS model but invalidates it when its inputs change', () => {
  const system = generateSystem(defaults());
  const first = cssTokenModel(system);
  expect(cssTokenModel(system)).toBe(first);
  system.config.emphasis.mixWeights!.active = 0.84;
  const changed = cssTokenModel(system);
  expect(changed).not.toBe(first);
  expect(changed.settings.find(token => token.name === '--kds-emphasis-active-weight')?.value).toBe('84%');
});
