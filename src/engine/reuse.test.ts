import { readFileSync } from 'node:fs';
import { surfaceStep } from './config';
import { describe, expect, it } from 'vitest';
import { generateSystem } from './generate';
import { contrast, toColor } from './color';
import { reuseGrayPositions } from './reuse';
import { configFromReference, parseKdsTokens } from './reference';
import type { FamilyRole, ModeTheme } from './types';

const config = () => configFromReference(parseKdsTokens(readFileSync(new URL('../reference/kds-tokens.css', import.meta.url), 'utf8')));

describe('constrained gray reuse', () => {
  it('prefers a closer opposite-theme Base stop over a local alias with the same gray count', () => {
    const input = config();
    input.families = input.families.filter(family => family.id === 'neutral');
    const role = (l: number) => ({ color: toColor({ l, c: 0, h: 0 }), primitive: '', semantic: '', sharedWith: [] });
    const theme = (surface: number, base: number, muted: number): ModeTheme => ({
      surfaces: [role(surface)],
      foreground: { base: role(base), muted: role(muted), onEmphasis: role(1) },
      // This fixture intentionally contains only the configured neutral family.
      families: { neutral: { id: 'neutral', key: 'gray', roles: {} } } as ModeTheme['families'],
    });
    const themes = { light: theme(0.209, 0.2, 0.5), dark: theme(0.201, 0.94, 0.7) };
    const result = reuseGrayPositions(input, themes, () => true);
    expect(result.light.foreground.base.color.l).toBe(0.201);
  });

  it('preserves local Muted reuse before creating cross-theme Text Base aliases', () => {
    const input = config();
    input.families = input.families.filter(family => family.id === 'neutral');
    const role = (l: number) => ({ color: toColor({ l, c: 0, h: 0 }), primitive: '', semantic: '', sharedWith: [] });
    const theme = (surface: number, base: number, muted: number, onEmphasis: number): ModeTheme => ({
      surfaces: [role(surface)],
      foreground: { base: role(base), muted: role(muted), onEmphasis: role(onEmphasis) },
      // This fixture intentionally contains only the configured neutral family.
      families: { neutral: { id: 'neutral', key: 'gray', roles: {} } } as ModeTheme['families'],
    });
    const themes = { light: theme(0.9, 0.2, 0.5, 0.8), dark: theme(0.195, 0.94, 0.198, 0.7) };
    const result = reuseGrayPositions(input, themes, () => true);
    expect(result.dark.foreground.muted.color.l).toBe(0.195);
    expect(result.light.foreground.base.color.l).toBe(0.195);
  });

  it('reuses opposite-theme neutral stops for Text Base while keeping contrast and other roles intact', () => {
    const input = config();
    input.surfaces.light.l = 0.991;
    input.surfaces.dark.l = 0.1995037954531629;
    input.surfaces.levels = 3;
    input.surfaces.step = { light: 0.035, dark: 0.1 };
    input.muted.distance = { light: 0.055, dark: 0.16 };
    input.muted.separation = 0.025;
    const snapshot = structuredClone(input);
    const result = generateSystem(input);
    expect(result.modes.light.foreground.base.primitive).toBe(result.modes.dark.surfaces[0].primitive);
    expect(result.modes.dark.foreground.base.primitive).toBe(result.modes.light.families.neutral.roles['muted.base']!.primitive);
    expect(result.primitives.filter(p => p.family === 'gray')).toHaveLength(17);
    expect(result.checks.every(check => check.pass)).toBe(true);
    expect(input).toEqual(snapshot);
    for (const mode of ['light', 'dark'] as const) {
      const sign = mode === 'light' ? -1 : 1;
      const theme = result.modes[mode];
      expect((theme.foreground.base.color.l - theme.foreground.muted.color.l) * sign).toBeGreaterThan(0);
      theme.surfaces.forEach((surface, i) => expect(surface.color.l).toBeCloseTo(input.surfaces[mode].l + sign * i * surfaceStep(input, mode), 9));
    }
  });

  it('rejects an opposite-theme Text Base candidate that fails contrast', () => {
    const input = config();
    input.families.forEach(family => { family.chroma = 0; family.hue = 0; });
    const themes = generateSystem(input).modes;
    const safe = toColor({ l: 0.56808, c: 0, h: 0 });
    const unsafe = toColor({ l: 0.5681, c: 0, h: 0 });
    themes.light.foreground.base.color = safe;
    themes.light.foreground.muted.color = toColor({ l: 0.6, c: 0, h: 0 });
    themes.dark.surfaces[0].color = unsafe;
    const result = reuseGrayPositions(input, themes, candidate => contrast(candidate.light.foreground.base.color, '#fff') >= 4.5);
    expect(result.light.foreground.base.color).toEqual(safe);
  });

  it('rejects opposite-theme reuse that reverses Base and Muted text hierarchy', () => {
    const input = config();
    const themes = generateSystem(input).modes;
    const neutral = input.families.find(family => family.id === 'neutral')!;
    const original = toColor({ l: 0.2, c: neutral.chroma, h: neutral.hue });
    themes.light.foreground.base.color = original;
    themes.light.foreground.muted.color = toColor({ l: 0.202, c: neutral.chroma, h: neutral.hue });
    themes.dark.surfaces[0].color = toColor({ l: 0.205, c: neutral.chroma, h: neutral.hue });
    const result = reuseGrayPositions(input, themes, () => true);
    expect(result.light.foreground.base.color).toEqual(original);
  });

  it('reuses a nearby surface for a whole muted group without losing spacing or shared family lightness', () => {
    const input = config();
    input.surfaces.step = { light: 0.035, dark: 0.035 };
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
