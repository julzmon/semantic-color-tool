import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { configFromReference, parseKdsTokens } from './reference';
import { defaultConfiguration } from '../ui/defaultConfiguration';
import { generateSystem } from './generate';
import { sharedLightnessIssues } from './shared-lightness';
import { balanceConfiguration } from './balance';
import { reduceLightnessStops } from './reduceLightness';
import { exportCss, exportDtcg, exportDtcgFiles, exportJson } from './export';
import { parseConfigurationJson, loadStoredConfiguration } from '../ui/configuration';
import type { GeneratedSystem } from './types';

const reference = parseKdsTokens(readFileSync(new URL('../reference/kds-tokens.css', import.meta.url), 'utf8'));
const defaults = () => defaultConfiguration(reference);
function expectShared(system: GeneratedSystem) {
  for (const mode of ['light', 'dark'] as const) {
    const families = Object.values(system.modes[mode].families);
    for (const path of Object.keys(families[0].roles) as (keyof typeof families[0]['roles'])[]) {
      const values = families.map(f => f.roles[path]!.color.l);
      expect(Math.max(...values) - Math.min(...values), `${mode}:${path}`).toBeLessThanOrEqual(1e-9);
    }
  }
  for (const family of system.config.families) expect(system.modes.light.families[family.id].roles['emphasis.base']!.color.l)
    .toBeCloseTo(system.modes.dark.families[family.id].roles['emphasis.base']!.color.l, 9);
}

it.each([false, true].flatMap(reverse => [false, true].map(legacy => ({ reverse, legacy }))))('retires per-family sharing without breaking tonal alignment ($reverse, legacy=$legacy)', ({ reverse, legacy }) => {
  const input = defaults(); input.solvingStrategy = 'prefer-shared'; input.emphasis.reverseDarkStates = reverse;
  input.emphasis.selected = true; input.muted.borderStrength = { light: .07, dark: .1 };
  input.families.forEach((f, i) => { f.hue = i * 57; f.chroma = .04 + i * .02; });
  if (legacy) { delete input.emphasis.mixWeights; delete input.muted.mixWeights; }
  const initial = balanceConfiguration(input, input);
  expect(initial.config.solvingStrategy).toBe('standard');
  expectShared(initial.system);
  const reduced = reduceLightnessStops(initial.config);
  expectShared(reduced.system);
  expect(reduced.system.checks.every(c => c.pass)).toBe(true);
  expectShared(generateSystem(parseConfigurationJson(exportJson(reduced.system), defaults())));
}, 15000);

it('rejects contradictory lightness locks even when their text contrast passes', () => {
  const previous = defaults(); const requested = structuredClone(previous);
  requested.anchors = [
    { family: 'brand', role: 'emphasis.base', mode: 'both', color: '#cc0000', locked: true },
    { family: 'info', role: 'emphasis.base', mode: 'both', color: '#000080', locked: true },
  ];
  expect(() => balanceConfiguration(previous, requested)).toThrow(/shared lightness.*conflicting exact locks/i);
  expect(previous.anchors).toEqual(defaults().anchors);
});

it('propagates exact anchor lightness across families while preserving its source', () => {
  const input = defaults(); input.anchors = [{ family: 'brand', role: 'emphasis.base', mode: 'both', color: '#cc0000', locked: true }];
  const result = balanceConfiguration(input, input);
  expectShared(result.system);
  expect(result.system.modes.light.families.brand.roles['emphasis.base']!.color.css).toBe('#cc0000');
});

it.each([exportCss, exportDtcg, exportDtcgFiles, exportJson])('blocks structurally divergent exports independently of cached contrast checks (%#)', serialize => {
  const system = balanceConfiguration(defaults(), defaults()).system;
  system.modes.light.families.info.roles['emphasis.base']!.color = { ...system.modes.light.families.info.roles['emphasis.base']!.color, l: .25 };
  expect(system.checks.every(c => c.pass)).toBe(true);
  expect(() => serialize(system)).toThrow(/shared lightness/i);
});

it('migrates retired sharing on restore and discloses the color change', () => {
  const input = { ...configFromReference(reference), solvingStrategy: 'prefer-shared' };
  const stored = loadStoredConfiguration({ getItem: () => JSON.stringify({ config: input }), setItem: () => {} }, defaults());
  expect(stored.config.solvingStrategy).toBe('standard');
  expect(stored).toHaveProperty('migrationNotice', expect.stringMatching(/shared lightness.*colors may change/i));
});

it('rejects conflicting cross-theme emphasis locks before balancing', () => {
  const input = defaults();
  input.anchors = [
    { family: 'brand', role: 'emphasis.base', mode: 'light', color: '#cc0000', locked: true },
    { family: 'brand', role: 'emphasis.base', mode: 'dark', color: '#000080', locked: true },
  ];
  expect(() => balanceConfiguration(defaults(), input)).toThrow(/shared lightness.*conflicting exact locks/i);
});

it('blocks equal-lightness but contradictory shared-base locks in every acceptance path', () => {
  const input = defaults();
  input.anchors = [
    { family: 'brand', role: 'emphasis.base', mode: 'light', color: 'oklch(0.45 0.05 25)', locked: true },
    { family: 'brand', role: 'emphasis.base', mode: 'dark', color: 'oklch(0.45 0.05 220)', locked: true },
  ];
  const system = generateSystem(input);
  expect(system.checks.every(c => c.pass)).toBe(true);
  expect(() => balanceConfiguration(defaults(), input)).toThrow(/conflicting exact locks/i);
  expect(() => reduceLightnessStops(input)).toThrow(/shared lightness/i);
  for (const serialize of [exportCss, exportDtcg, exportDtcgFiles, exportJson]) expect(() => serialize(system)).toThrow(/shared lightness/i);
});

it('checks every corresponding state and border role in the final semantic graph', () => {
  const input = defaults(); input.emphasis.selected = true;
  const baseline = balanceConfiguration(input, input).system;
  expect(sharedLightnessIssues(baseline)).toEqual([]);
  for (const mode of ['light', 'dark'] as const) {
    for (const path of Object.keys(baseline.modes[mode].families.info.roles) as (keyof typeof baseline.modes.light.families.info.roles)[]) {
      const system = structuredClone(baseline);
      system.modes[mode].families.info.roles[path]!.color.l += .01;
      expect(sharedLightnessIssues(system).some(issue => issue.includes(`${mode} ${path}`))).toBe(true);
    }
  }
  const incomplete = structuredClone(baseline);
  delete incomplete.modes.dark.families.info.roles['muted.selected'];
  expect(sharedLightnessIssues(incomplete).some(issue => issue.includes('missing'))).toBe(true);
});
