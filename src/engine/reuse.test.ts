import { readFileSync } from 'node:fs';
import { surfaceStep } from './config';
import { describe, expect, it } from 'vitest';
import { generateSystem } from './generate';
import { contrast, toColor } from './color';
import { reuseGrayPositions } from './reuse';
import { configFromReference, parseKdsTokens } from './reference';
import type { FamilyRole } from './types';

const config = () => configFromReference(parseKdsTokens(readFileSync(new URL('../reference/kds-tokens.css', import.meta.url), 'utf8')));

describe('constrained gray reuse', () => {
  it('reuses a nearby surface for a whole muted group without losing spacing or shared family lightness', () => {
    const input = config();
    input.muted.distance = { light: 0.055, dark: 0.055 };
    const result = generateSystem(input);
    for (const mode of ['light', 'dark'] as const) {
      const theme = result.modes[mode];
      const roles = theme.families.neutral.roles;
      expect(roles['muted.hover']!.primitive).toBe(theme.surfaces[2].primitive);
      const sign = mode === 'light' ? -1 : 1;
      for (const [i, state] of ['base', 'hover', 'active'].entries()) {
        const name = `muted.${state}` as FamilyRole;
        expect(theme.families.info.roles[name]!.color.l).toBeCloseTo(roles[name]!.color.l, 9);
        expect((roles[name]!.color.l - roles['muted.base']!.color.l) * sign).toBeCloseTo(i * input.muted.separation, 9);
      }
      for (const [i, surface] of theme.surfaces.entries()) {
        expect(surface.color.l).toBeCloseTo(input.surfaces[mode].l + sign * i * surfaceStep(input, mode), 9);
      }
    }
    expect(result.primitives.filter((p) => p.family === 'gray').length).toBeLessThan(23);
    expect(result.checks.every((check) => check.pass)).toBe(true);
  });

  it('keeps selected states distinct and exact locks intact', () => {
    const input = config();
    input.emphasis.selected = true;
    input.anchors = [{ family: 'neutral', mode: 'light', role: 'emphasis.base', color: 'oklch(0.491 0.0074 208.77)', locked: true }];
    const result = generateSystem(input);
    expect(result.modes.light.families.neutral.roles['emphasis.base']!.color.css).toBe(input.anchors[0].color);
    for (const mode of ['light', 'dark'] as const) for (const family of Object.values(result.modes[mode].families)) {
      for (const group of ['muted', 'emphasis'] as const) {
        const colors = ['base', 'hover', 'active', 'selected'].map((state) => family.roles[`${group}.${state}` as FamilyRole]!.color);
        expect(new Set(colors.map((color) => color.css)).size).toBe(4);
        for (let i = 1; i < colors.length; i++) expect(Math.abs(colors[i].l - colors[i - 1].l)).toBeCloseTo(input[group].separation, 9);
      }
    }
  });

  it('retains a separate gray when the nearby existing gray would fail text contrast', () => {
    const input = config();
    input.families.forEach((family) => { family.chroma = 0; family.hue = 0; });
    input.surfaces.light.l = 1;
    input.surfaces.levels = 1;
    input.muted = { distance: 0, separation: 0 };
    input.emphasis.separation = 0;
    const themes = generateSystem(input).modes;
    const safe = toColor({ l: 0.56808, c: 0, h: 0 });
    const unsafe = toColor({ l: 0.5681, c: 0, h: 0 });
    expect(contrast(safe, '#fff')).toBeGreaterThanOrEqual(4.5);
    expect(contrast(unsafe, '#fff')).toBeLessThan(4.5);
    themes.light.foreground.muted.color = safe;
    for (const [name, role] of Object.entries(themes.light.families.neutral.roles)) {
      if (!name.startsWith('muted.') && !name.startsWith('border.muted.')) role!.color = unsafe;
    }
    const snapshot = structuredClone(themes);
    const result = reuseGrayPositions(input, themes, (candidate) =>
      contrast(candidate.light.foreground.muted.color, candidate.light.surfaces[0].color) >= 4.5);
    expect(result.light.foreground.muted.color).toEqual(safe);
    expect(themes).toEqual(snapshot);
    expect(contrast(result.light.foreground.muted.color, result.light.surfaces[0].color)).toBeGreaterThanOrEqual(4.5);
  });
});
