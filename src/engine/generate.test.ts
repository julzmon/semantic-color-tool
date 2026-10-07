import { surfaceStep } from './config';
import { describe, expect, it } from 'vitest';
import { converter } from 'culori';
import { readFileSync } from 'node:fs';
import { contrast, toColor } from './color';
import { generateSystem } from './generate';
import { configFromReference, parseKdsTokens } from './reference';
import type { BuilderConfig, FamilyRole, Mode, OklchColor } from './types';

const oklch = converter('oklch');
const coordinates = (css: string): OklchColor => {
  const value = oklch(css)!;
  return { l: value.l, c: value.c, h: value.h ?? 0 };
};
function config(): BuilderConfig {
  const source = readFileSync(new URL('../reference/kds-tokens.css', import.meta.url), 'utf8');
  const result = configFromReference(parseKdsTokens(source));
  result.surfaces = { light: coordinates('#ffffff'), dark: coordinates('#151617'), levels: 3, step: 0.025 };
  result.muted = { distance: 0.07, separation: 0.035 };
  result.emphasis = { separation: 0.045, selected: false };
  return result;
}

describe('color mathematics', () => {
  it('computes the WCAG black-white ratio without rounding the result', () => {
    expect(contrast('#000', '#fff')).toBeCloseTo(21, 10);
    expect(contrast('#fff', '#000')).toBeCloseTo(21, 10);
    expect(contrast('#777', '#fff')).toBeLessThan(4.5);
  });
  it('reduces out-of-gamut chroma while retaining lightness and hue', () => {
    const value = toColor({ l: 0.6, c: 0.5, h: 240 });
    expect(value.gamutMapped).toBe(true);
    expect(value.c).toBeLessThan(0.5);
    expect(value.l).toBeCloseTo(0.6, 5);
    expect(value.h).toBeCloseTo(240, 5);
    const rgb = converter('rgb')(value.css)!;
    for (const channel of [rgb.r, rgb.g, rgb.b]) {
      expect(channel).toBeGreaterThanOrEqual(-1e-7);
      expect(channel).toBeLessThanOrEqual(1 + 1e-7);
    }
  });
  it('rejects invalid and translucent colors', () => {
    for (const value of ['garbage', '#fffffg', 'rgb(0 0 0 / .5)', 'transparent']) {
      expect(() => toColor(value)).toThrow();
    }
    expect(() => toColor({ l: NaN, c: 0, h: 0 })).toThrow();
  });
});

describe('semantic generation', () => {
  it('uses the configured prefix for generated primitives and semantic tokens', () => {
    const result = generateSystem({ ...config(), prefix: 'acme-ui' });
    expect(result.primitives.every((primitive) => primitive.name.startsWith('--acme-ui-key-'))).toBe(true);
    expect(result.semantics.every((token) => token.name.startsWith('--acme-ui-'))).toBe(true);
    expect(result.modes.light.surfaces[0]!.semantic).toBe('--acme-ui-bg-surface-base');
  });
  it('generates all KDS family semantics and preserves a locked Brand emphasis base', () => {
    const input = config();
    const locked = 'oklch(0.530761849 0.217799663 29.23388028)';
    input.anchors = [{ family: 'brand', mode: 'light', role: 'emphasis.base', color: locked, locked: true }];
    const result = generateSystem(input);
    expect(result.config.families.map((family) => family.id)).toEqual(['neutral', 'brand', 'info', 'positive', 'negative', 'warning']);
    expect(result.modes.light.families.brand.roles['emphasis.base']!.color.css).toBe(locked);
    expect(result.modes.light.families.brand.roles['emphasis.base']!.semantic).toBe('--kds-bg-brand-emphasis-base');
    for (const mode of ['light', 'dark'] as Mode[]) {
      for (const role of ['muted.base', 'muted.hover', 'muted.active', 'emphasis.base', 'emphasis.hover', 'emphasis.active', 'foreground.base', 'foreground.hover', 'border.muted.base', 'border.emphasis.base'] as FamilyRole[]) {
        const lightnesses = Object.values(result.modes[mode].families).map((family) => family.roles[role]!.color.l);
        expect(new Set(lightnesses.map((lightness) => lightness.toFixed(9))).size, `${mode}:${role}`).toBe(1);
      }
    }
    for (const family of ['brand', 'positive', 'negative', 'warning'] as const) {
      expect(result.semantics.some((token) => token.name === `--kds-bg-${family}-emphasis-base`)).toBe(true);
      expect(result.semantics.some((token) => token.name === `--kds-fg-${family}-base`)).toBe(true);
      expect(result.semantics.some((token) => token.name === `--kds-border-${family}-emphasis-base`)).toBe(true);
    }
  });
  it('supports independent surface steps and retains legacy shared steps', () => {
    const input = config();
    const legacy = generateSystem(input);
    const split = generateSystem({ ...input, surfaces: { ...input.surfaces, step: { light: 0.025, dark: 0.015 } } });
    expect(split.modes.light.surfaces.map((role) => role.color)).toEqual(legacy.modes.light.surfaces.map((role) => role.color));
    expect(split.modes.dark.surfaces[1].color.l - split.modes.dark.surfaces[0].color.l).toBeCloseTo(0.015, 9);
    expect(legacy.config.surfaces.step).toEqual({ light: 0.025, dark: 0.025 });
    expect(split.checks.every((check) => check.pass)).toBe(true);
    expect(() => generateSystem({ ...input, surfaces: { ...input.surfaces, step: { light: 0.025, dark: NaN } } })).toThrow();
  });
  it('uses independent muted distances while accepting the legacy shared value', () => {
    const legacy = config();
    legacy.muted.distance = 0.07;
    const split = structuredClone(legacy);
    split.muted.distance = { light: 0.07, dark: 0.16 };

    const legacySystem = generateSystem(legacy);
    const splitSystem = generateSystem(split);

    expect(splitSystem.config.muted.distance).toEqual({ light: 0.07, dark: 0.16 });
    for (const family of ['neutral', 'brand', 'info', 'positive', 'negative', 'warning'] as const) {
      expect(splitSystem.modes.light.families[family].roles['muted.base']!.color.l).toBeCloseTo(legacySystem.modes.light.families[family].roles['muted.base']!.color.l, 9);
      expect(splitSystem.modes.dark.families[family].roles['muted.base']!.color.l).toBeGreaterThan(legacySystem.modes.dark.families[family].roles['muted.base']!.color.l);
    }
    expect(splitSystem.checks.every((check) => check.pass)).toBe(true);
  });
  it('uses the gray family for every surface and reuses matching neutral positions', () => {
    const input = config();
    input.families[0].hue = 85;
    input.families[0].chroma = 0.04;
    input.muted.distance = 0;
    input.muted.separation = surfaceStep(input, 'light');
    const result = generateSystem(input);
    for (const mode of ['light', 'dark'] as const) {
      for (const [index, surface] of result.modes[mode].surfaces.entries()) {
        const expected = toColor({ l: surface.color.l, h: 85, c: 0.04 });
        expect(surface.color.css).toBe(expected.css);
        const state = ['base', 'hover', 'active'][index];
        expect(surface.primitive).toBe(result.modes[mode].families.neutral.roles[`muted.${state}` as FamilyRole]!.primitive);
      }
    }
    for (const primitive of result.primitives.filter((item) => item.family === 'gray')) expect(primitive.color.h).toBe(85);
  });
  it('shares lightness for corresponding roles across families while passing contrast', () => {
    for (const hue of [25, 105, 228]) {
      const input = config();
      input.families[1].hue = hue;
      const result = generateSystem(input);
      for (const mode of ['light', 'dark'] as const) {
        const { neutral, info } = result.modes[mode].families;
        for (const name of Object.keys(neutral.roles) as FamilyRole[]) {
          expect(info.roles[name]!.color.l, `${mode}:${name}`).toBeCloseTo(neutral.roles[name]!.color.l, 9);
        }
      }
      expect(result.checks.filter((check) => !check.pass)).toEqual([]);
    }
  });

  it('uses a locked brand lightness for the corresponding role in other families', () => {
    const input = config();
    input.anchors = [{ family: 'info', mode: 'light', role: 'emphasis.base', color: '#cc0000', locked: true }];
    const result = generateSystem(input);
    const { neutral, info } = result.modes.light.families;
    expect(neutral.roles['emphasis.base']!.color.l).toBeCloseTo(info.roles['emphasis.base']!.color.l, 9);
    expect(info.roles['emphasis.base']!.color.css).toBe('#cc0000');
  });
  it('passes every check when initialized from the bundled KDS reference', () => {
    const source = readFileSync(new URL('../reference/kds-tokens.css', import.meta.url), 'utf8');
    const result = generateSystem(configFromReference(parseKdsTokens(source)));
    expect(result.checks.filter((check) => !check.pass)).toEqual([]);
    expect(result.diagnostics).toEqual([]);
  });
  it('shares emphasis fills across light and dark modes by default', () => {
    const result = generateSystem(config());

    for (const family of Object.values(result.modes.light.families)) {
      const dark = result.modes.dark.families[family.id];
      for (const state of ['base', 'hover', 'active'] as const) {
        expect(dark.roles[`emphasis.${state}`]!.color.css).toBe(family.roles[`emphasis.${state}`]!.color.css);
      }
    }
  });
  it('validates emphasis borders, rather than emphasis fills, as UI boundaries', () => {
    const result = generateSystem(config());
    const uiChecks = result.checks.filter((check) => check.kind === 'ui-boundary');

    expect(uiChecks).not.toEqual([]);
    expect(uiChecks.every((check) => check.foreground.startsWith('--kds-border-'))).toBe(true);
  });
  it('accepts outward muted distance while exposing boundary conflicts', () => {
    const input = config();
    input.muted.distance = -0.08;
    const result = generateSystem(input);
    expect(result.diagnostics.join(' ')).toMatch(/muted distance/i);
    expect(result.modes.light.families.info.roles['muted.base']!.color.l).toBe(1);
  });
  it('passes every contextual normal, large, and UI check for the defaults', () => {
    const generated = generateSystem(config());
    expect(generated.checks.length).toBeGreaterThan(150);
    expect(generated.checks.filter((check) => !check.pass)).toEqual([]);
    expect(new Set(generated.checks.map((check) => check.kind))).toEqual(new Set(['normal-text', 'large-text', 'ui-boundary']));
    expect(generated.diagnostics).toEqual([]);
    for (const mode of ['light', 'dark'] as Mode[]) {
      const theme = generated.modes[mode];
      expect(theme.surfaces).toHaveLength(3);
      for (const family of Object.values(theme.families)) {
        expect(family.roles['emphasis.selected']).toBeUndefined();
        for (const roleName of ['foreground.base', 'foreground.hover'] as FamilyRole[]) {
          const checks = generated.checks.filter((check) => check.mode === mode && check.foreground === family.roles[roleName]!.semantic);
          expect(checks.filter((check) => check.kind === 'normal-text')).toHaveLength(6);
        }
      }
    }
  });
  it('honors independently supplied bases and full inward state spacing', () => {
    const input = config();
    input.surfaces.light = coordinates('#fcfaf5');
    input.surfaces.dark = coordinates('#242329');
    input.emphasis.selected = true;
    const result = generateSystem(input);
    for (const mode of ['light', 'dark'] as Mode[]) {
      const theme = result.modes[mode];
      const direction = mode === 'light' ? -1 : 1;
      expect(theme.surfaces[0].color.l).toBeCloseTo(input.surfaces[mode].l, 6);
      for (let index = 1; index < theme.surfaces.length; index++) {
        expect((theme.surfaces[index].color.l - theme.surfaces[index - 1].color.l) * direction).toBeCloseTo(surfaceStep(input, mode), 5);
      }
      for (const family of Object.values(theme.families)) {
        for (const group of ['muted', 'emphasis'] as const) {
          const states = ['base', 'hover', 'active', 'selected'].map((state) => family.roles[`${group}.${state}` as FamilyRole]!.color);
          const stateDirection = group === 'emphasis' && (input.emphasis.strategy ?? 'shared') === 'shared' ? -1 : direction;
          for (let index = 1; index < states.length; index++) {
            expect((states[index].l - states[index - 1].l) * stateDirection).toBeCloseTo(input[group].separation, 5);
          }
        }
      }
    }
  });
  it('keeps independent theme emphasis available as an adaptive strategy', () => {
    const input = config();
    input.emphasis.strategy = 'adaptive';

    const result = generateSystem(input);

    expect(result.modes.dark.families.brand.roles['emphasis.base']!.color.css)
      .not.toBe(result.modes.light.families.brand.roles['emphasis.base']!.color.css);
  });
  it('is deterministic, immutable, sorted, and produces no dangling references', () => {
    const input = config();
    const snapshot = JSON.stringify(input);
    const first = generateSystem(input);
    expect(generateSystem(input)).toEqual(first);
    expect(JSON.stringify(input)).toBe(snapshot);
    const known = new Set([...first.primitives.map((item) => item.name), ...first.semantics.map((item) => item.name)]);
    for (const semantic of first.semantics) {
      expect(known.has(semantic.light)).toBe(true);
      expect(known.has(semantic.dark)).toBe(true);
    }
    for (const key of ['gray', 'blue']) {
      const primitives = first.primitives.filter((item) => item.family === key);
      primitives.forEach((item, index) => {
        expect(item.name).toMatch(new RegExp(`^--kds-key-${key}-[0-9]+(?:-[0-9]+)?$`));
        if (index) expect(item.color.l).toBeLessThanOrEqual(primitives[index - 1].color.l);
      });
    }
    expect(first.semantics.find((item) => item.name === '--kds-fg-link-base')).toMatchObject({ light: '--kds-fg-info-base', dark: '--kds-fg-info-base' });
    expect(first.semantics.some((item) => item.name.includes('fg-info-emphasis'))).toBe(false);
    const tones = new Map<string, number>();
    for (const item of first.primitives) {
      const tone = item.name.split('-')[5];
      if (tones.has(tone)) expect(item.color.l).toBeCloseTo(tones.get(tone)!, 9);
      tones.set(tone, item.color.l);
    }
  });
  it('unions identical primitive colors across modes and records every usage', () => {
    const input = config();
    input.surfaces.light = input.surfaces.dark = coordinates('#808080');
    input.surfaces.levels = 1;
    const result = generateSystem(input);
    const light = result.modes.light.surfaces[0];
    const dark = result.modes.dark.surfaces[0];
    expect(light.primitive).toBe(dark.primitive);
    const primitive = result.primitives.find((item) => item.name === light.primitive)!;
    expect(primitive.usages).toContain('light:--kds-bg-surface-base');
    expect(primitive.usages).toContain('dark:--kds-bg-surface-base');
  });
  it('includes link aliases in primitive usage and shared-color inspection', () => {
    const result = generateSystem(config());
    const foreground = result.modes.light.families.info.roles['foreground.base']!;
    expect(foreground.sharedWith).toContain('--kds-fg-link-base');
    expect(result.primitives.find((primitive) => primitive.name === foreground.primitive)!.usages).toContain('light:--kds-fg-link-base');
  });
  it('preserves distinct exact spellings when equal-color anchors cannot share one CSS declaration', () => {
    const input = config();
    input.anchors = [
      { family: 'info', mode: 'light', role: 'emphasis.base', color: '#000', locked: true },
      { family: 'info', mode: 'dark', role: 'emphasis.base', color: '#000000', locked: true },
    ];
    const result = generateSystem(input);
    for (const mode of ['light', 'dark'] as Mode[]) {
      const emphasis = result.modes[mode].families.info.roles['emphasis.base']!;
      const primitive = result.primitives.find((item) => item.name === emphasis.primitive)!;
      expect(primitive.color.css).toBe(emphasis.color.css);
    }
  });
  it('finds a common intermediate on-emphasis foreground when black and white both conflict with locks', () => {
    const input = config();
    input.targets = { normalText: 3, largeText: 3, ui: 1 };
    input.emphasis.separation = 0.01;
    input.anchors = [
      { family: 'neutral', mode: 'light', role: 'emphasis.base', color: 'oklch(0.1 0 0)', locked: true },
      { family: 'info', mode: 'light', role: 'emphasis.base', color: 'oklch(0.95 0 0)', locked: true },
    ];
    const result = generateSystem(input);
    const checks = result.checks.filter((check) => check.mode === 'light' && check.foreground === '--kds-fg-on-emphasis');
    expect(result.diagnostics.join(' ')).toContain('shared-lightness constraint is unsatisfied');
    expect(result.modes.light.families.neutral.roles['emphasis.base']!.color.css).toBe('oklch(0.1 0 0)');
    expect(result.modes.light.families.info.roles['emphasis.base']!.color.css).toBe('oklch(0.95 0 0)');
    expect(checks.every((check) => check.pass)).toBe(true);
    expect(result.modes.light.foreground.onEmphasis.color.l).toBeGreaterThan(0.1);
    expect(result.modes.light.foreground.onEmphasis.color.l).toBeLessThan(0.95);
  });
  it('splits emphasis from foreground when a feasible emphasis lock fails text contrast', () => {
    const input = config();
    input.anchors = [{ family: 'info', mode: 'light', role: 'emphasis.base', color: '#717171', locked: true }];
    const result = generateSystem(input);
    const roles = result.modes.light.families.info.roles;
    expect(roles['emphasis.base']!.color.css).toBe('#717171');
    expect(roles['emphasis.base']!.primitive).not.toBe(roles['foreground.base']!.primitive);
    expect(result.checks.filter((check) => check.mode === 'light' && check.foreground === roles['foreground.base']!.semantic).every((check) => check.pass)).toBe(true);
    expect(result.checks.filter((check) => check.mode === 'light' && !check.pass)).toEqual([]);
  });
  it('preserves exact HEX and OKLCH locks and exposes conflicts without false passes', () => {
    const input = config();
    const locked = 'oklch(0.64 0.42 240)';
    input.anchors = [
      { family: 'info', mode: 'both', role: 'emphasis.base', color: locked, locked: true },
      { family: 'neutral', mode: 'light', role: 'foreground.base', color: '#FAFAFA', locked: true },
    ];
    const result = generateSystem(input);
    for (const mode of ['light', 'dark'] as Mode[]) {
      expect(result.modes[mode].families.info.roles['emphasis.base']!.color.css).toBe(locked);
      expect(result.modes[mode].families.info.roles['emphasis.base']!.color.c).toBe(0.42);
    }
    expect(result.modes.light.families.neutral.roles['foreground.base']!.color.css).toBe('#FAFAFA');
    expect(result.diagnostics.join(' ')).toMatch(/gamut/i);
    expect(result.checks.some((check) => !check.pass)).toBe(true);
    expect(result.checks.filter((check) => check.foregroundColor.source === locked || check.backgroundColor.source === locked).every((check) => !check.pass)).toBe(true);
  });
  it('derives locked hover and active states from the anchored hue and chroma', () => {
    const input = config();
    input.anchors = [{ family: 'info', mode: 'light', role: 'emphasis.base', color: '#cc0000', locked: true }];
    const roles = generateSystem(input).modes.light.families.info.roles;
    const base = roles['emphasis.base']!.color;
    for (const state of ['hover', 'active'] as const) {
      const value = roles[`emphasis.${state}`]!.color;
      expect(value.h).toBeCloseTo(base.h, 6);
      expect(value.c).toBeLessThanOrEqual(base.c + 1e-8);
    }
  });
  it('retains raw failed checks for impossible targets and diagnoses spacing bounds', () => {
    const input = config();
    input.targets = { normalText: 21, largeText: 21, ui: 21 };
    input.muted.separation = 0.6;
    input.emphasis.separation = 0.6;
    const result = generateSystem(input);
    expect(result.diagnostics.join(' ')).toMatch(/infeasible|cannot|impossible/i);
    expect(result.checks.filter((check) => !check.pass).length).toBeGreaterThan(50);
    expect(result.checks.every((check) => check.pass === (check.ratio >= check.target))).toBe(true);
  });
  it('rejects malformed configs and overlapping locks', () => {
    const input = config();
    expect(() => generateSystem({ ...input, muted: { ...input.muted, separation: NaN } })).toThrow();
    expect(() => generateSystem({ ...input, surfaces: { ...input.surfaces, levels: 0 } })).toThrow();
    expect(() => generateSystem({ ...input, families: [] })).toThrow();
    expect(() => generateSystem({ ...input, anchors: [
      { family: 'info', mode: 'both', role: 'emphasis.base', color: '#fff', locked: true },
      { family: 'info', mode: 'light', role: 'emphasis.base', color: '#000', locked: true },
    ] })).toThrow();
  });
});
