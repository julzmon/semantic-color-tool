import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { generateSystem } from './generate';
import { configFromReference, parseKdsTokens } from './reference';
import { isSrgb } from './color';
import { balanceConfiguration } from './balance';
import { parseConfigurationJson, saveStoredConfiguration, loadStoredConfiguration } from '../ui/configuration';
import { exportJson } from './export';
import type { BuilderConfig } from './types';

const defaults = configFromReference(parseKdsTokens(readFileSync(new URL('../reference/kds-tokens.css', import.meta.url), 'utf8')));
function withStrength(light: number, dark: number): BuilderConfig {
  const input = structuredClone(defaults);
  input.muted.borderStrength = { light, dark };
  return input;
}

it('preserves legacy colors and checks at zero border strength', () => {
  const old = generateSystem(defaults), zero = generateSystem(withStrength(0, 0));
  expect(zero.modes).toEqual(old.modes);
  expect(zero.checks).toEqual(old.checks);
});

it.each(['light', 'dark'] as const)('strengthens only the requested %s borders', mode => {
  const before = generateSystem(defaults);
  const input = withStrength(mode === 'light' ? 0.1 : 0, mode === 'dark' ? 0.1 : 0);
  const result = balanceConfiguration(defaults, input).system;
  for (const current of ['light', 'dark'] as const) {
    expect(result.modes[current].surfaces.map(role => role.color)).toEqual(before.modes[current].surfaces.map(role => role.color));
    expect(Object.values(result.modes[current].foreground).map(role => role.color)).toEqual(Object.values(before.modes[current].foreground).map(role => role.color));
    for (const family of defaults.families) {
      for (const [path, old] of Object.entries(before.modes[current].families[family.id].roles)) {
        const color = result.modes[current].families[family.id].roles[path as keyof typeof before.modes.light.families.brand.roles]!.color;
        if (current === mode && path.startsWith('border.muted.')) {
          expect(color.l).toBeCloseTo(old!.color.l + (mode === 'light' ? -0.1 : 0.1), 8);
          expect(isSrgb(color)).toBe(true);
        } else expect(color).toEqual(old!.color);
      }
    }
  }
  expect(result.checks).toEqual(before.checks);
});

it('keeps Default and Hover distinct at lightness limits', () => {
  const input = withStrength(0.3, 0.3);
  input.surfaces.light.l = 0.4;
  input.surfaces.dark.l = 0.8;
  const baseline = generateSystem({ ...input, muted: { ...input.muted, borderStrength: { light: 0, dark: 0 } } });
  const result = generateSystem(input);
  for (const mode of ['light', 'dark'] as const) for (const family of defaults.families) {
    const roles = result.modes[mode].families[family.id].roles;
    const previous = baseline.modes[mode].families[family.id].roles;
    expect(roles['border.muted.base']!.color.l).not.toBe(roles['border.muted.hover']!.color.l);
    expect(Math.abs(roles['border.muted.base']!.color.l - roles['border.muted.hover']!.color.l)).toBeCloseTo(Math.abs(previous['border.muted.base']!.color.l - previous['border.muted.hover']!.color.l), 8);
    for (const path of ['border.muted.base', 'border.muted.hover'] as const) expect(isSrgb(roles[path]!.color)).toBe(true);
  }
});

it('round-trips strength through exports and saved configurations', () => {
  const input = withStrength(0.075, 0.12);
  const generated = generateSystem(input);
  expect(parseConfigurationJson(exportJson(generated), defaults).muted.borderStrength).toEqual(input.muted.borderStrength);
  let value = '';
  const storage = { getItem: () => value, setItem: (_key: string, text: string) => { value = text; } };
  expect(saveStoredConfiguration(storage, input)).toBe(true);
  expect(loadStoredConfiguration(storage, defaults).config.muted.borderStrength).toEqual(input.muted.borderStrength);
});

it('retains requested border strength when limiting an unrelated infeasible edit', () => {
  const requested = withStrength(0.06, 0.09);
  requested.muted.distance = { light: 0.055, dark: 0.8 };
  const result = balanceConfiguration(defaults, requested);
  expect(result.config.muted.borderStrength).toEqual(requested.muted.borderStrength);
  expect(result.system.checks.every(check => check.pass)).toBe(true);
});

it.each([-0.01, 0.301, NaN, Infinity, '0.1', null])('rejects invalid border strength %s', value => {
  const input = withStrength(0, 0);
  input.muted.borderStrength = { light: value, dark: 0 } as BuilderConfig['muted']['borderStrength'];
  expect(() => generateSystem(input)).toThrow(/muted border strength/i);
});
