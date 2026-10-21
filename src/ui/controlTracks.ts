import { toColor } from '../engine/color';
import { MAX_MUTED_BORDER_STRENGTH, mutedChromaScale, mutedDistance, surfaceStep } from '../engine/config';
import { adjustMutedBorders, generateStates, mutedGeneration, surfaceGeneration } from '../engine/generate';
import { mutedTarget } from '../engine/muted';
import { emphasisTarget, mixEmphasis } from '../engine/emphasis';
import type { BuilderConfig, ColorValue, FamilyConfig, GeneratedSystem, Mode, OklchColor } from '../engine/types';

interface TrackBounds { min: number; max: number }

// Sample the engine's sRGB output so gamut limits and lightness bounds match
// the generated colors rather than the browser's own gamut-mapping algorithm.
function gradient(min: number, max: number, sample: (value: number) => ColorValue, segments = 24): string {
  const stops = Array.from({ length: segments + 1 }, (_, index) => {
    const fraction = index / segments;
    return `${sample(min + (max - min) * fraction).css} ${Number((fraction * 100).toFixed(6))}%`;
  });
  return `linear-gradient(90deg, ${stops.join(', ')})`;
}

export function familyControlColor(family: FamilyConfig): string {
  return toColor({ l: 0.62, c: family.chroma, h: family.hue }).css;
}

export function familyTrackStyle(family: FamilyConfig, component: 'hue' | 'chroma', bounds?: TrackBounds): string {
  return `--range-track: ${gradient(bounds?.min ?? 0, bounds?.max ?? (component === 'hue' ? 360 : 0.3), value => toColor({
    l: 0.62, c: component === 'chroma' ? value : family.chroma, h: component === 'hue' ? value : family.hue,
  }), component === 'hue' ? 72 : 24)}`;
}

export function surfaceTrackStyle(config: BuilderConfig, mode: Mode, component: 'lightness' | 'spacing', bounds?: TrackBounds): string {
  const neutral = config.families.find(family => family.id === 'neutral')!;
  const track = component === 'lightness'
    ? gradient(bounds?.min ?? 0, bounds?.max ?? 1, l => toColor({ l, c: neutral.chroma, h: neutral.hue }))
    : gradient(bounds?.min ?? 0.001, bounds?.max ?? 0.2, value => surfaceGeneration({ ...config, surfaces: { ...config.surfaces,
      step: { light: surfaceStep(config, 'light'), dark: surfaceStep(config, 'dark'), [mode]: value },
    } }, mode).colors.at(-1)!);
  return `--range-track: ${track}`;
}

export function mutedTrackStyle(config: BuilderConfig, mode: Mode, component: 'distance' | 'chroma', bounds?: TrackBounds): string {
  const brand = config.families.find(family => family.id === 'brand')!;
  return `--range-track: ${gradient(bounds?.min ?? (component === 'distance' ? -0.08 : 0),
    bounds?.max ?? (component === 'distance' ? mode === 'dark' ? 0.5 : 0.16 : 200), value => {
      const muted = component === 'distance'
        ? { ...config.muted, distance: { light: mutedDistance(config, 'light'), dark: mutedDistance(config, 'dark'), [mode]: value } }
        : { ...config.muted, chromaScale: { light: mutedChromaScale(config, 'light'), dark: mutedChromaScale(config, 'dark'), [mode]: value / 100 } };
      return mutedGeneration({ ...config, muted }, mode, brand).colors[0];
    })}`;
}

export function mutedBorderTrackStyle(config: BuilderConfig, mode: Mode, bounds?: TrackBounds): string {
  const brand = config.families.find(family => family.id === 'brand')!;
  const colors = mutedGeneration(config, mode, brand).colors;
  return `--range-track: ${gradient(bounds ? bounds.min / 100 * MAX_MUTED_BORDER_STRENGTH : 0, bounds ? bounds.max / 100 * MAX_MUTED_BORDER_STRENGTH : MAX_MUTED_BORDER_STRENGTH, strength => adjustMutedBorders({ ...config,
    muted: { ...config.muted, borderStrength: { light: strength, dark: strength } },
  }, mode, brand, colors[1], colors[2])[0])}`;
}

export function stateTrackStyle(config: BuilderConfig, system: GeneratedSystem, kind: 'muted' | 'emphasis', bounds?: TrackBounds): string {
  const brand = config.families.find(family => family.id === 'brand')!;
  const count = config.emphasis.selected ? 4 : 3;
  const mixed = kind === 'emphasis' && !!config.emphasis.mixWeights;
  const tracks = (['light', 'dark'] as const).map(mode => gradient(bounds?.min ?? (mixed ? 0 : kind === 'muted' ? 0.005 : 0.01),
    bounds?.max ?? (mixed ? 100 : kind === 'muted' ? 0.07 : 0.1), separation => {
      if (kind === 'muted') return mutedGeneration({ ...config, muted: { ...config.muted, separation } }, mode, brand).colors.at(-1)!;
      // Hold the accepted emphasis base fixed; contrast protection can move it
      // after an edit. Shared emphasis uses light-mode direction in both modes.
      const shared = config.emphasis.reverseDarkStates || config.emphasis.strategy !== 'adaptive';
      const base = system.modes[shared ? 'light' : mode].families.brand.roles['emphasis.base']!.color;
      if (mixed) return mixEmphasis(base, 1 - separation / 100, emphasisTarget(config, mode));
      const direction = mode === 'dark' && (config.emphasis.reverseDarkStates || !shared) ? 'dark' : 'light';
      return generateStates(base, direction, separation, count).colors.at(-1)!;
    }));
  return `--range-track: ${tracks[0]} top / 100% 50% no-repeat, ${tracks[1]} bottom / 100% 50% no-repeat`;
}

/** Actual accepted muted bases, with the same opaque mixing rule as the generator. */
export function mutedStateTrackStyle(system: GeneratedSystem, bounds: TrackBounds): string {
  const tracks = (['light','dark'] as const).map(mode => {
    const base = system.modes[mode].families.brand.roles['muted.base']!.color;
    return gradient(bounds.min, bounds.max, strength => mixEmphasis(base, 1 - strength / 100, mutedTarget(mode)));
  });
  return `--range-track: ${tracks[0]} top / 100% 50% no-repeat, ${tracks[1]} bottom / 100% 50% no-repeat`;
}

/** Preview explicit edits to an exact source; acceptance still verifies contrast. */
export function exactColorTrackStyle(source: OklchColor, key: keyof OklchColor, bounds: TrackBounds): string {
  return `--range-track: ${gradient(bounds.min, bounds.max, value => toColor({ ...source, [key]: value }), key === 'h' ? 72 : 24)}`;
}
