import reference from 'virtual:kds-reference';
import { describe, expect, it } from 'vitest';
import { defaultConfiguration } from '../ui/defaultConfiguration';
import { balanceConfiguration } from './balance';
import { generateSystem } from './generate';
import { countLightnessStops, reduceLightnessStops } from './reduceLightness';
import type { ColorValue, GeneratedSystem, Mode } from './types';

const accepted = () => {
  const config = defaultConfiguration(reference);
  return balanceConfiguration(config, config);
};
const colorsByRole = (system: GeneratedSystem): Record<string, ColorValue> => Object.fromEntries((['light', 'dark'] as Mode[]).flatMap(mode => {
  const theme = system.modes[mode];
  return [...theme.surfaces.map((role, i) => [`${mode}:surface:${i}`, role.color]),
    ...Object.entries(theme.foreground).map(([name, role]) => [`${mode}:fg:${name}`, role.color]),
    ...Object.values(theme.families).flatMap(family => Object.entries(family.roles).map(([name, role]) => [`${mode}:${family.id}:${name}`, role!.color]))];
})) as Record<string, ColorValue>;

describe('shared lightness stop reduction', () => {
  it('reduces default stops deterministically without changing protected controls or input', () => {
    const initial = accepted();
    const snapshot = structuredClone(initial.config);
    const result = reduceLightnessStops(initial.config);
    expect(countLightnessStops(result.system)).toBeLessThan(countLightnessStops(initial.system));
    expect(result.system.checks.every(check => check.pass)).toBe(true);
    expect(result.config.families).toEqual(initial.config.families);
    expect(result.config.targets).toEqual(initial.config.targets);
    expect(result.config.anchors).toEqual(initial.config.anchors);
    expect(result.config.emphasis).toEqual(initial.config.emphasis);
    expect(result.config.muted.mixWeights).toEqual(initial.config.muted.mixWeights);
    expect(initial.config).toEqual(snapshot);
    expect(generateSystem(result.config)).toEqual(result.system);
    expect(balanceConfiguration(result.config, result.config).system).toEqual(result.system);
    expect(reduceLightnessStops(initial.config)).toEqual(result);
    const before = colorsByRole(initial.system);
    for (const [key, color] of Object.entries(colorsByRole(result.system))) {
      expect(Math.abs(color.l - before[key].l), key).toBeLessThanOrEqual(0.020000001);
    }
    expect(result.message).toContain('shared lightness stops');
    const repeated = reduceLightnessStops(result.config);
    expect(repeated.config).toEqual(result.config);
    expect(repeated.system).toEqual(result.system);
    expect(repeated.message).toContain('No safe reduction was found');
  }, 15_000);

  it('preserves exact locked Brand colors and mixed state ordering in both themes', () => {
    const initial = accepted();
    initial.config.anchors = [{ family: 'brand', mode: 'light', role: 'emphasis.base', color: '#cc0000', locked: true }];
    const locked = balanceConfiguration(initial.config, initial.config);
    const result = reduceLightnessStops(locked.config);
    expect(result.system.modes.light.families.brand.roles['emphasis.base']!.color.css).toBe('#cc0000');
    expect(result.system.checks.every(check => check.pass)).toBe(true);
    for (const mode of ['light', 'dark'] as Mode[]) {
      const theme = result.system.modes[mode];
      for (const family of Object.values(theme.families)) {
        for (const group of ['muted', 'emphasis'] as const) {
          const states = ['base', 'hover', 'active'].map(state => family.roles[`${group}.${state}` as keyof typeof family.roles]!.color.l);
          const direction = group === 'muted' && mode === 'dark' ? 1 : -1;
          expect((states[1] - states[0]) * direction).toBeGreaterThan(0);
          expect((states[2] - states[1]) * direction).toBeGreaterThan(0);
        }
      }
    }
  }, 15_000);

  it.each([false, true])('preserves selected/reversed-dark state ordering (legacy=%s)', legacy => {
    const input = accepted().config;
    input.emphasis.selected = true;
    input.emphasis.reverseDarkStates = true;
    if (legacy) { delete input.muted.mixWeights; delete input.emphasis.mixWeights; }
    const initial = balanceConfiguration(input, input);
    const result = reduceLightnessStops(initial.config);
    expect(result.system.checks.every(check => check.pass)).toBe(true);
    expect(result.config.emphasis).toEqual(initial.config.emphasis);
    expect(countLightnessStops(result.system)).toBeLessThanOrEqual(countLightnessStops(initial.system));
    for (const mode of ['light', 'dark'] as Mode[]) {
      for (const family of Object.values(initial.system.modes[mode].families)) {
        for (const group of ['muted', 'emphasis'] as const) {
          const roles = ['base', 'hover', 'active', 'selected'].map(state => `${group}.${state}` as keyof typeof family.roles);
          for (let index = 1; index < roles.length; index++) {
            const before = family.roles[roles[index]]!.color.l - family.roles[roles[index - 1]]!.color.l;
            const changed = result.system.modes[mode].families[family.id].roles;
            const after = changed[roles[index]]!.color.l - changed[roles[index - 1]]!.color.l;
            if (Math.abs(before) > 1e-10) expect(Math.sign(before) * after).toBeGreaterThan(1e-10);
          }
        }
      }
    }
  }, 15_000);

  it('preserves strength limits so saved optimized colors survive restore unchanged', () => {
    const input = defaultConfiguration(reference);
    input.muted.distance = { light: 0.047, dark: 0.136 };
    input.emphasis.selected = true;
    const initial = balanceConfiguration(input, input);
    const result = reduceLightnessStops(initial.config);
    const restored = balanceConfiguration(result.config, result.config);
    expect(restored.config).toEqual(result.config);
    expect(restored.system).toEqual(result.system);
  }, 15_000);

  it('rejects failing input rather than presenting it as accessibility protected', () => {
    const initial = accepted();
    initial.config.targets.normalText = 21;
    expect(() => reduceLightnessStops(initial.config)).toThrow(/passing/i);
  });
});
