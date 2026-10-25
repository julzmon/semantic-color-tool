import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { configFromReference, parseKdsTokens } from './reference';
import { generateSystem } from './generate';
import { contrast, colorIdentity, isSrgb, toColor } from './color';
import { inspectFeasibility, familyCandidate } from './feasibility';
import { exportJson } from './export';
import { parseConfigurationJson } from '../ui/configuration';
const defaults = () => configFromReference(parseKdsTokens(readFileSync(new URL('../reference/kds-tokens.css', import.meta.url), 'utf8')));

describe('verified lightness samples', () => {
  it('reports discrete samples using mapped hue/chroma and every foreground state relationship', () => {
    const system = generateSystem(defaults());
    const report = inspectFeasibility(system, 'light', '--kds-fg-brand-base');
    expect(report.step).toBe(.001);
    expect(report.chosen).toBe(system.modes.light.families.brand.roles['foreground.base']!.color.l);
    expect(report.relationships.some(r => r.includes('muted-active'))).toBe(true);
    expect(report.samples.length).toBeGreaterThan(0);
    const family = system.config.families.find(f => f.id === 'brand')!;
    const backgrounds = [...system.modes.light.surfaces, ...Object.entries(system.modes.light.families.brand.roles).filter(([path]) => path.startsWith('muted.')).map(([, role]) => role!)];
    for (const l of report.samples) for (const candidateL of [l, l - system.config.emphasis.separation]) {
      expect(candidateL).toBeGreaterThanOrEqual(0);
      const color = toColor({ l: candidateL, c: family.chroma, h: family.hue });
      expect(isSrgb(color)).toBe(true);
      for (const background of backgrounds) expect(contrast(color, background.color)).toBeGreaterThanOrEqual(system.config.targets.normalText);
    }
    expect(report.samples).not.toContain(.95);
    expect(report.runs.flatMap(run => run.values)).toEqual(report.samples);
  });
  it('includes both-theme emphasis states and exact locks in joint feasibility', () => {
    const config = defaults(); config.emphasis.reverseDarkStates = true; config.emphasis.selected = true;
    config.anchors = [{ family: 'brand', mode: 'both', role: 'emphasis.base', color: '#c00000', locked: true }];
    const system = generateSystem(config);
    const report = inspectFeasibility(system, 'light', '--kds-bg-brand-emphasis-base');
    expect(report.relationships.some(r => r.includes('dark') && r.includes('selected'))).toBe(true);
    expect(report.locked).toBe(true);
    expect(report.samples.length).toBeLessThanOrEqual(1);
  });
});

describe('shared-lightness solving', () => {
  it('normalizes retired strategy and round-trips shared-lightness solving', () => {
    const config = defaults(); delete config.solvingStrategy;
    expect(generateSystem({ ...config, solvingStrategy: 'standard' }).modes).toEqual(generateSystem(config).modes);
    config.solvingStrategy = 'prefer-shared';
    expect(parseConfigurationJson(exportJson(generateSystem(config)), defaults()).solvingStrategy).toBe('standard');
    expect(parseConfigurationJson(JSON.stringify(defaults()), config).solvingStrategy).toBe('standard');
  });
  it('keeps foreground and emphasis independent when sharing would fragment family lightness', () => {
    const config = defaults(); config.solvingStrategy = 'prefer-shared';
    const system = generateSystem(config);
    const light = system.modes.light.families.brand.roles;
    const dark = system.modes.dark.families.brand.roles;
    expect(colorIdentity(light['foreground.base']!.color)).not.toBe(colorIdentity(light['emphasis.base']!.color));
    expect(colorIdentity(dark['foreground.base']!.color)).not.toBe(colorIdentity(dark['emphasis.base']!.color));
    expect(system.checks.every(c => c.pass)).toBe(true);
    expect(light['foreground.base']!.color.l - light['foreground.hover']!.color.l).toBeCloseTo(config.emphasis.separation, 8);
  });
  it('retains locks and verifies reversed dark states when sharing bases across themes', () => {
    const config = defaults(); config.solvingStrategy = 'prefer-shared'; config.emphasis.reverseDarkStates = true;
    config.anchors = [{ family: 'brand', mode: 'dark', role: 'foreground.base', color: '#ffffff', locked: true }];
    const system = generateSystem(config);
    expect(system.modes.dark.families.brand.roles['foreground.base']!.color.css).toBe('#ffffff');
    for (const family of config.families) {
      expect(colorIdentity(system.modes.light.families[family.id].roles['emphasis.base']!.color)).toBe(colorIdentity(system.modes.dark.families[family.id].roles['emphasis.base']!.color));
      for (const mode of ['light','dark'] as const) for (const state of ['base','hover','active'] as const) {
        const fill = system.modes[mode].families[family.id].roles[`emphasis.${state}`]!.color;
        expect(isSrgb(fill)).toBe(true);
        expect(contrast(fill, system.modes[mode].foreground.onEmphasis.color)).toBeGreaterThanOrEqual(config.targets.normalText);
      }
    }
  });
  it('reports unresolved hierarchy rather than treating contrast as hierarchy', () => {
    const config = defaults(); config.emphasis.mixWeights = { hover: 1, active: 1, selected: 1 };
    expect(generateSystem(config).diagnostics.some(d => d.includes('hierarchy'))).toBe(true);
  });
});

it('keeps exact conflicting locks separate without claiming impossibility', () => {
  const config = defaults(); config.solvingStrategy = 'prefer-shared';
  config.anchors = [
    { family: 'brand', mode: 'both', role: 'emphasis.base', color: '#b00000', locked: true },
    { family: 'brand', mode: 'light', role: 'foreground.base', color: '#800000', locked: true },
  ];
  const system = generateSystem(config);
  expect(system.modes.light.families.brand.roles['emphasis.base']!.color.css).toBe('#b00000');
  expect(system.modes.light.families.brand.roles['foreground.base']!.color.css).toBe('#800000');
  const report = inspectFeasibility(system, 'light', '--kds-fg-brand-base');
  expect(report.jointSamples).toEqual([]);
  expect(report.decision).toContain('does not prove impossibility');
});

it('does not allow on-emphasis text to equal a fill even with a 1:1 target', () => {
  const config = defaults(); config.targets = { normalText: 1, largeText: 1, ui: 1 };
  const system = generateSystem(config);
  for (const mode of ['light', 'dark'] as const) for (const family of config.families) {
    expect(colorIdentity(system.modes[mode].foreground.onEmphasis.color)).not.toBe(colorIdentity(system.modes[mode].families[family.id].roles['emphasis.base']!.color));
  }
});

it('retains default surfaces, muted fills, text hierarchy and emphasis recipes when preferring sharing', () => {
  const config = defaults(); const standard = generateSystem(config);
  config.solvingStrategy = 'prefer-shared'; const shared = generateSystem(config);
  for (const mode of ['light', 'dark'] as const) {
    expect(shared.modes[mode].surfaces.map(r => r.color)).toEqual(standard.modes[mode].surfaces.map(r => r.color));
    expect(shared.modes[mode].foreground.base.color).toEqual(standard.modes[mode].foreground.base.color);
    expect(shared.modes[mode].foreground.muted.color).toEqual(standard.modes[mode].foreground.muted.color);
    for (const family of config.families) {
      const roles = shared.modes[mode].families[family.id].roles;
      for (const state of ['base','hover','active'] as const) {
        expect(roles[`muted.${state}`]!.color).toEqual(standard.modes[mode].families[family.id].roles[`muted.${state}`]!.color);
        if (state !== 'base') {
          expect(roles[`emphasis.${state}`]!.color.l).toBeCloseTo(roles['emphasis.base']!.color.l * config.emphasis.mixWeights![state], 9);
          expect(roles[`emphasis.${state}`]!.color.l).toBeLessThan(roles['emphasis.base']!.color.l);
        }
      }
    }
  }
});

it('evaluates derived foreground hover through the full state group and supports link aliases', () => {
  const system = generateSystem(defaults());
  const report = inspectFeasibility(system, 'light', '--kds-fg-brand-hover');
  expect(report.chosenValid).toBe(true);
  for (const l of report.samples) expect(familyCandidate(system, 'brand', l + system.config.emphasis.separation, ['light'], false).valid).toBe(true);
  expect(inspectFeasibility(system, 'light', '--kds-fg-link-hover').samples).toEqual(inspectFeasibility(system, 'light', '--kds-fg-info-hover').samples);
});

it('reports lightness overlap without conflating it with complete-color sharing', () => {
  const system = generateSystem(defaults());
  const report = inspectFeasibility(system, 'light', '--kds-fg-brand-base');
  expect(report.lightnessOverlaps.length).toBe(5);
  for (const overlap of report.lightnessOverlaps) {
    expect(overlap.samples.every(l => report.samples.includes(l))).toBe(true);
    const family = system.config.families.find(f => overlap.role.includes(`fg-${f.id}-`))!;
    for (const l of overlap.samples) expect(familyCandidate(system, family.id, l, ['light'], false).valid).toBe(true);
  }
  expect(report.sharing.lightnessOnly.some(name => name.includes('fg-info-base'))).toBe(true);
  expect(report.sharing.completeColor.some(name => name.includes('fg-info-base'))).toBe(false);
});

it('inspects the exact foreground anchor without copying it into emphasis', () => {
  const config = defaults(); config.solvingStrategy = 'prefer-shared';
  config.anchors = [{ family: 'brand', mode: 'light', role: 'foreground.base', color: '#000080', locked: true }];
  const system = generateSystem(config);
  const roles = system.modes.light.families.brand.roles;
  expect(roles['foreground.base']!.color.css).toBe('#000080');
  expect(colorIdentity(roles['emphasis.base']!.color)).not.toBe(colorIdentity(roles['foreground.base']!.color));
  const report = inspectFeasibility(system, 'light', '--kds-fg-brand-base');
  expect(report.chosenValid).toBe(true);
  expect(report.samples).toEqual([roles['foreground.base']!.color.l]);
});

it.each([true, false])('retains locked role hue in its own derived state group (mix: %s)', mixed => {
  const config = defaults(); config.solvingStrategy = 'prefer-shared';
  if (!mixed) delete config.emphasis.mixWeights;
  const path = mixed ? 'emphasis.base' : 'foreground.base';
  config.anchors = [{ family: 'brand', mode: 'light', role: path, color: '#000080', locked: true }];
  const system = generateSystem(config);
  const roles = system.modes.light.families.brand.roles;
  expect(roles[path]!.color.css).toBe('#000080');
  const derived = mixed ? ['emphasis.hover', 'emphasis.active'] as const : ['foreground.hover'] as const;
  for (const role of derived) expect(roles[role]!.color.h).toBeCloseTo(roles[path]!.color.h, 8);
  expect(system.checks.every(c => c.pass)).toBe(true);
});

it('checks independent on-emphasis identity constraints in adaptive mode', () => {
  const config = defaults(); config.emphasis.strategy = 'adaptive';
  config.targets = { normalText: 1, largeText: 1, ui: 1 };
  config.families.forEach(f => { f.chroma = 0; });
  const system = generateSystem(config);
  const l = system.modes.light.families.neutral.roles['emphasis.base']!.color.l;
  expect(inspectFeasibility(system, 'light', '--kds-fg-on-emphasis').samples).not.toContain(l);
});

it('does not bridge gaps or off-grid locks into continuous feasible intervals', async () => {
  const { sampleRuns } = await import('./feasibility');
  expect(sampleRuns([.1, .101, .4, .4005, .401])).toEqual([
    { first: .1, last: .101, values: [.1, .101] }, { first: .4, last: .4, values: [.4] },
    { first: .4005, last: .4005, values: [.4005] }, { first: .401, last: .401, values: [.401] },
  ]);
});

it('keeps on-emphasis separate even when incompatible exact fills leave contrast unresolved', () => {
  const config = defaults(); config.targets = { normalText: 21, largeText: 21, ui: 21 };
  config.anchors = [
    { family: 'brand', mode: 'both', role: 'emphasis.base', color: '#ffffff', locked: true },
    { family: 'info', mode: 'both', role: 'emphasis.base', color: '#000000', locked: true },
  ];
  const system = generateSystem(config);
  expect(system.checks.some(c => !c.pass)).toBe(true);
  for (const mode of ['light','dark'] as const) for (const family of config.families) for (const state of ['base','hover','active'] as const) {
    expect(colorIdentity(system.modes[mode].foreground.onEmphasis.color)).not.toBe(colorIdentity(system.modes[mode].families[family.id].roles[`emphasis.${state}`]!.color));
  }
  expect(system.modes.light.families.brand.roles['emphasis.base']!.color.css).toBe('#ffffff');
});

// The hosted Linux runner takes ~6.5s for this bounded integration search.
it('normalizes retired strategy through contrast-limited balancing', async () => {
  const { balanceConfiguration } = await import('./balance');
  const previous = defaults(); const requested = structuredClone(previous);
  requested.solvingStrategy = 'prefer-shared'; requested.muted.distance = { light: .055, dark: .8 };
  const result = balanceConfiguration(previous, requested);
  expect(result.config.solvingStrategy).toBe('standard');
  expect(result.system.checks.every(check => check.pass)).toBe(true);
  expect(result.config.muted.distance).not.toEqual(requested.muted.distance);
}, 15_000);
