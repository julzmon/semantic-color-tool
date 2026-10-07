import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { configFromReference, parseKdsTokens } from './reference';
import { generateSystem, mutedGeneration } from './generate';
import { isSrgb } from './color';
import type { BuilderConfig, Mode } from './types';

function config(scale?: { light: number; dark: number }): BuilderConfig {
  const input = configFromReference(parseKdsTokens(readFileSync(new URL('../reference/kds-tokens.css', import.meta.url), 'utf8')));
  input.surfaces.light.l = 0.85;
  input.surfaces.dark.l = 0.2;
  input.surfaces.step = { light: 0.035, dark: 0.035 };
  input.muted.distance = { light: 0.12, dark: 0.16 };
  input.families = input.families.map((family) => ({ ...family, chroma: 0.015 }));
  if (scale) input.muted.chromaScale = scale;
  else delete input.muted.chromaScale;
  return input;
}

describe('muted chroma adjustment', () => {
  it('preserves legacy output at 100% and emits normalized scale settings', () => {
    const legacy = generateSystem(config());
    const explicit = generateSystem(config({ light: 1, dark: 1 }));
    expect(legacy.modes).toEqual(explicit.modes);
    expect(legacy.checks).toEqual(explicit.checks);
    expect(legacy.config.muted).toMatchObject({ chromaScale: { light: 1, dark: 1 } });
  });

  it.each(['light', 'dark'] as const)('scales every muted state before gamut mapping in %s mode', (mode) => {
    for (const factor of [0, 0.5, 1, 2]) {
      const input = config({ light: factor, dark: factor });
      const family = input.families[1];
      for (const color of mutedGeneration(input, mode, family).colors) {
        expect(color.c).toBeCloseTo(family.chroma * factor, 8);
        expect(isSrgb(color)).toBe(true);
      }
    }
  });

  it('retains achromatic muted fills and derived borders through reuse', () => {
    const input = config({ light: 0, dark: 0 });
    input.muted.distance = { light: 0.03, dark: 0.03 };
    input.muted.separation = 0.035;
    const result = generateSystem(input);
    for (const mode of ['light', 'dark'] as const) {
      for (const family of Object.values(result.modes[mode].families)) {
        for (const [name, role] of Object.entries(family.roles)) {
          if (name.startsWith('muted.') || name.startsWith('border.muted.')) expect(role!.color.c).toBe(0);
        }
      }
    }
    expect(result.checks.every((check) => check.pass)).toBe(true);
  });

  it('changes dark muted colors independently of light muted colors and surfaces', () => {
    const before = generateSystem(config({ light: 1, dark: 1 }));
    const after = generateSystem(config({ light: 1, dark: 0 }));
    for (const family of Object.keys(before.modes.light.families) as Array<keyof typeof before.modes.light.families>) {
      for (const name of ['muted.base', 'muted.hover', 'muted.active', 'border.muted.base', 'border.muted.hover'] as const) {
        expect(after.modes.light.families[family].roles[name]!.color).toEqual(before.modes.light.families[family].roles[name]!.color);
      }
    }
    for (const mode of ['light', 'dark'] as Mode[]) expect(after.modes[mode].surfaces.map((role) => role.color)).toEqual(before.modes[mode].surfaces.map((role) => role.color));
    expect(after.modes.dark.families.brand.roles['muted.base']!.color.c).toBe(0);
    expect(before.modes.dark.families.brand.roles['muted.base']!.color.c).toBeGreaterThan(0);
  });

  it('gamut maps high requested chroma while retaining contrast validation', () => {
    const input = config({ light: 2, dark: 2 });
    input.families[1].chroma = 0.3;
    const result = generateSystem(input);
    expect(result.primitives.every((primitive) => isSrgb(primitive.color))).toBe(true);
    expect(result.modes.light.families.brand.roles['muted.base']!.color.gamutMapped).toBe(true);
    expect(result.checks.every((check) => check.pass)).toBe(true);
  });

  it.each([-0.01, 2.01, NaN, Infinity, '1', null])('rejects invalid chroma scale %s', (invalid) => {
    const input = config();
    input.muted = { ...input.muted, chromaScale: { light: invalid, dark: 1 } } as BuilderConfig['muted'];
    expect(() => generateSystem(input)).toThrow(/muted chroma/i);
  });
});
