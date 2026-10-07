import { surfaceStep } from './config';
import { colorIdentity, isSrgb, toColor } from './color';
import type { BuilderConfig, ColorValue, GeneratedRole, Mode, ModeTheme } from './types';

const modes: Mode[] = ['light', 'dark'];
type Themes = Record<Mode, ModeTheme>;
type Entry = { role: GeneratedRole; chroma: number; hue: number };

function grayRoles(themes: Themes, activeModes: readonly Mode[] = modes): GeneratedRole[] {
  return activeModes.flatMap((mode) => [
    ...themes[mode].surfaces,
    ...Object.values(themes[mode].foreground),
    ...Object.values(themes[mode].families.neutral.roles) as GeneratedRole[],
  ]);
}

/** Reuse nearby positions, never independently snap members of a state group. */
export function reuseGrayPositions(config: BuilderConfig, input: Themes, valid: (themes: Themes) => boolean): Themes {
  const themes = structuredClone(input);
  const grayCount = () => new Set(grayRoles(themes).map((role) => colorIdentity(role.color))).size;
  const radius = (mode: Mode, spacing: number) => Math.min(0.01, surfaceStep(config, mode) / 2, spacing / 2);
  const hierarchy = () => modes.every((mode) => {
    const before = input[mode].foreground.base.color.l - input[mode].foreground.muted.color.l;
    const after = themes[mode].foreground.base.color.l - themes[mode].foreground.muted.color.l;
    return Math.abs(before) < 1e-9 || before * after > 0;
  });

  // Trial mutations stay inside this cloned graph and are rolled back before ranking.
  const choose = (entries: Entry[], candidates: ColorValue[][]) => {
    const original = entries.map(({ role }) => role.color);
    if (original.some((color) => color.source)) return;
    let count = grayCount();
    let best: ColorValue[] | undefined;
    for (const colors of candidates) {
      if (colors.some((color) => !isSrgb(color))) continue;
      entries.forEach(({ role }, i) => { role.color = colors[i]; });
      const nextCount = grayCount();
      if (nextCount < count && hierarchy() && valid(themes)) {
        count = nextCount;
        best = colors;
      }
      entries.forEach(({ role }, i) => { role.color = original[i]; });
    }
    if (best) entries.forEach(({ role }, i) => { role.color = best[i]; });
  };

  for (const mode of modes) {
    for (const group of ['muted', 'emphasis'] as const) {
      // Split foreground/border groups move with emphasis too, retaining their offsets.
      // A lock anywhere in that group pins the entire group across both families.
      if (group === 'emphasis' && config.anchors.some((anchor) => anchor.locked && (anchor.mode === mode || anchor.mode === 'both'))) continue;
      const entries = config.families.flatMap((family) => Object.entries(themes[mode].families[family.id].roles)
        .filter(([name]) => (name.startsWith('muted.') || name.startsWith('border.muted.')) === (group === 'muted'))
        .map(([, role]) => ({ role: role!, chroma: family.chroma, hue: family.hue })));
      const neutral = Object.entries(themes[mode].families.neutral.roles)
        .filter(([name]) => (name.startsWith('muted.') || name.startsWith('border.muted.')) === (group === 'muted'))
        .map(([, role]) => role!);
      // A mode-specific control must not move roles in the other mode through reuse.
      const existing = grayRoles(themes, [mode]).filter((role) => !neutral.includes(role));
      const limit = radius(mode, config[group].separation);
      const offsets = [...new Set(neutral.flatMap((role) => existing.map((target) => Number((target.color.l - role.color.l).toFixed(10)))))]
        .filter((delta) => Math.abs(delta) > 1e-9 && Math.abs(delta) <= limit + 1e-9)
        .sort((a, b) => Math.abs(a) - Math.abs(b) || a - b);
      const candidates = offsets.filter((delta) => entries.every(({ role }) => role.color.l + delta >= 0 && role.color.l + delta <= 1))
        .map((delta) => entries.map(({ role, chroma, hue }) => toColor({ l: role.color.l + delta, c: chroma, h: hue })));
      choose(entries, candidates);
    }
  }

  // Global text can reuse an existing gray without moving any family position.
  for (const mode of modes) for (const name of ['muted', 'base'] as const) {
    const role = themes[mode].foreground[name];
    const colors = grayRoles(themes, [mode]).filter((other) => other !== role).map((other) => other.color)
      .filter((color) => !color.source && Math.abs(color.l - role.color.l) <= radius(mode, Infinity) + 1e-9
        && Math.abs(color.h - role.color.h) < 1e-9 && Math.abs(color.c - role.color.c) < 1e-9)
      .sort((a, b) => Math.abs(a.l - role.color.l) - Math.abs(b.l - role.color.l) || a.l - b.l);
    choose([{ role, chroma: role.color.c, hue: role.color.h }], colors.map((color) => [color]));
  }
  return themes;
}
