import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { configFromReference, parseKdsTokens } from './reference';
import { generateSystem } from './generate';
import { balanceConfiguration } from './balance';

const defaults = () => configFromReference(parseKdsTokens(readFileSync(new URL('../reference/kds-tokens.css', import.meta.url), 'utf8')));

it.each([false, true])('reverses dark emphasis states while preserving shared bases (selected: %s)', selected => {
  const input = defaults();
  input.emphasis = { ...input.emphasis, selected, reverseDarkStates: true };
  const system = generateSystem(input);
  for (const family of input.families) {
    const light = system.modes.light.families[family.id].roles;
    const dark = system.modes.dark.families[family.id].roles;
    expect(dark['emphasis.base']!.color).toEqual(light['emphasis.base']!.color);
    for (const state of (selected ? ['hover', 'active', 'selected'] as const : ['hover', 'active'] as const)) {
      const weight = input.emphasis.mixWeights![state];
      expect(light[`emphasis.${state}`]!.color.l).toBeCloseTo(light['emphasis.base']!.color.l * weight, 9);
      expect(dark[`emphasis.${state}`]!.color.l).toBeCloseTo(dark['emphasis.base']!.color.l * weight + 1 - weight, 9);
    }
  }
});

it('retains reversal when contrast protection limits unsafe shared strengths', () => {
  const previous = defaults();
  const requested = { ...previous, anchors: [{ family: 'brand' as const, mode: 'both' as const, role: 'emphasis.base' as const, color: 'oklch(0.45 0.12 29)', locked: true }],
    emphasis: { ...previous.emphasis, reverseDarkStates: true, mixWeights: { hover: 0.6, active: 0.5, selected: 0.4 } } };
  const accepted = balanceConfiguration(previous, requested);
  expect(accepted.config.emphasis.reverseDarkStates).toBe(true);
  expect(accepted.system.checks.every(check => check.pass)).toBe(true);
  expect(accepted.config.emphasis.mixWeights!.active).toBeGreaterThan(requested.emphasis.mixWeights.active);
  expect(accepted.message).toContain('shared emphasis strengths');
  for (const family of previous.families) {
    const light = accepted.system.modes.light.families[family.id].roles;
    const dark = accepted.system.modes.dark.families[family.id].roles;
    expect(dark['emphasis.base']!.color).toEqual(light['emphasis.base']!.color);
    expect(dark['emphasis.active']!.color.l).toBeGreaterThan(dark['emphasis.base']!.color.l);
  }
});

it('rejects malformed reversal settings', () => {
  const input = defaults();
  expect(() => generateSystem({ ...input, emphasis: { ...input.emphasis, reverseDarkStates: 'yes' as unknown as boolean } })).toThrow(/reverse/i);
});

it('preserves exact Brand locks when reversing states', () => {
  const input = defaults();
  const color = 'oklch(0.45 0.12 29)';
  input.anchors = [{ family: 'brand', mode: 'both', role: 'emphasis.base', color, locked: true }];
  input.emphasis = { ...input.emphasis, reverseDarkStates: true, separation: 0.01 };
  const system = generateSystem(input);
  for (const mode of ['light', 'dark'] as const) expect(system.modes[mode].families.brand.roles['emphasis.base']!.color.css).toBe(color);
});

it('can turn reversal off again without changing the shared base policy', () => {
  const initial = defaults();
  const enabled = balanceConfiguration(initial, { ...initial, emphasis: { ...initial.emphasis, reverseDarkStates: true } });
  const disabled = balanceConfiguration(enabled.config, { ...enabled.config, emphasis: { ...enabled.config.emphasis, reverseDarkStates: false } });
  expect(disabled.config.emphasis.reverseDarkStates).toBe(false);
  expect(disabled.system.checks.every(check => check.pass)).toBe(true);
  for (const family of initial.families) {
    expect(disabled.system.modes.dark.families[family.id].roles['emphasis.active']!.color)
      .toEqual(disabled.system.modes.light.families[family.id].roles['emphasis.active']!.color);
  }
});
