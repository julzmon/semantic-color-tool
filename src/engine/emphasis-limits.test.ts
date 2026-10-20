import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { configFromReference, parseKdsTokens } from './reference';
import { balanceConfiguration } from './balance';
import { generateSystem } from './generate';
import { mixEmphasis, emphasisTarget } from './emphasis';
import { cssTokenModel } from './tokens';
import type { GeneratedSystem } from './types';
const defaults = () => configFromReference(parseKdsTokens(readFileSync(new URL('../reference/kds-tokens.css', import.meta.url), 'utf8')));
function expectCaps(system: GeneratedSystem) {
  for (const mode of ['light', 'dark'] as const) for (const family of system.config.families) {
    const roles = system.modes[mode].families[family.id].roles;
    const base = roles['emphasis.base']!.color;
    for (const state of ['hover', 'active', 'selected'] as const) {
      const strength = 1 - system.config.emphasis.mixWeights![state];
      expect(strength).toBeLessThanOrEqual(.25 + 1e-9);
      const actual = roles[`emphasis.${state}`]?.color;
      if (!actual) continue;
      expect(Math.abs(actual.l - base.l)).toBeLessThanOrEqual(.12 + 1e-9);
      expect(actual.c).toBeGreaterThanOrEqual(base.c * .75 - 1e-9);
      expect(actual).toEqual(mixEmphasis(base, system.config.emphasis.mixWeights![state], emphasisTarget(system.config, mode)));
    }
  }
  expect(system.checks.every(check => check.pass)).toBe(true);
}
it.each([false, true])('limits all shared strengths across families and themes (reverse: %s)', reverseDarkStates => {
  const previous = defaults();
  const requested = structuredClone(previous);
  requested.emphasis = { ...requested.emphasis, selected: true, reverseDarkStates, mixWeights: { hover: .1, active: .05, selected: 0 } };
  const before = structuredClone(requested);
  const result = balanceConfiguration(previous, requested);
  expectCaps(result.system);
  expect(result.config).toEqual(result.system.config);
  expect(requested).toEqual(before);
  expect(result.message).toMatch(/lightness|state change/i);
  expect(parseFloat(cssTokenModel(result.system).settings.find(token => token.name === '--kds-emphasis-active-weight')!.value))
    .toBeCloseTo(result.config.emphasis.mixWeights!.active * 100, 9);
}, 15000);
it('caps locked-base state changes while keeping the exact base and targets', () => {
  const previous = defaults(); const requested = structuredClone(previous);
  requested.emphasis.selected = true;
  requested.emphasis.mixWeights = { hover: .8, active: .4, selected: .2 };
  requested.anchors = [{ family: 'brand', mode: 'both', role: 'emphasis.base', color: 'oklch(0.45 0.12 29)', locked: true }];
  const result = balanceConfiguration(previous, requested);
  expectCaps(result.system);
  expect(result.config.anchors).toEqual(requested.anchors);
  expect(result.config.targets).toEqual(requested.targets);
  for (const mode of ['light', 'dark'] as const) expect(result.system.modes[mode].families.brand.roles['emphasis.base']!.color.source).toBe(requested.anchors[0].color);
  const again = balanceConfiguration(result.config, result.config);
  expect(again.config).toEqual(result.config);
  expect(again.message).toBe('');
}, 15000);
it('retains raw engine recipes and legacy generation without enforcing application policy', () => {
  const config = defaults(); config.emphasis.mixWeights = { hover: .2, active: .1, selected: 0 };
  expect(generateSystem(config).config.emphasis.mixWeights).toEqual(config.emphasis.mixWeights);
  delete config.emphasis.mixWeights;
  const generated = generateSystem(config);
  expect(balanceConfiguration(config, config).config).toEqual(generated.config);
});

it('uses the stricter base/direction formula and preserves the 25% ceiling at short distances', async () => {
  const { emphasisStrengthLimit } = await import('./emphasis-limits');
  const system = generateSystem(defaults());
  for (const mode of ['light', 'dark'] as const) for (const family of system.config.families) {
    system.modes[mode].families[family.id].roles['emphasis.base']!.color.l = .2;
  }
  expect(emphasisStrengthLimit(system)).toBe(.25);
  system.config.emphasis.reverseDarkStates = true;
  expect(emphasisStrengthLimit(system)).toBe(.15); // .12 / (1 - .2)
  system.config.emphasis.reverseDarkStates = false;
  system.modes.light.families.brand.roles['emphasis.base']!.color.l = .5;
  expect(emphasisStrengthLimit(system)).toBe(.24);
  system.modes.dark.families.info.roles['emphasis.base']!.color.l = .8;
  expect(emphasisStrengthLimit(system)).toBe(.15);
});

it('scales a distinct state group together instead of collapsing pressed and selected at the cap', () => {
  const previous = defaults(); const requested = structuredClone(previous);
  requested.emphasis.selected = true;
  requested.emphasis.mixWeights = { hover: .91, active: .82, selected: .73 };
  const result = balanceConfiguration(previous, requested);
  const weights = result.config.emphasis.mixWeights!;
  expect(weights.hover).toBeGreaterThan(weights.active);
  expect(weights.active).toBeGreaterThan(weights.selected);
  expect((1 - weights.hover) / (1 - weights.selected)).toBeCloseTo(1 / 3, 4);
  expect((1 - weights.active) / (1 - weights.selected)).toBeCloseTo(2 / 3, 4);
  expectCaps(result.system);
});
