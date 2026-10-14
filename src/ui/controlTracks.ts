import { toColor } from '../engine/color';
import { MAX_MUTED_BORDER_STRENGTH, mutedChromaScale, mutedDistance, surfaceStep } from '../engine/config';
import { adjustMutedBorders, generateStates, mutedGeneration, surfaceGeneration } from '../engine/generate';
import type { BuilderConfig, ColorValue, FamilyConfig, GeneratedSystem, Mode } from '../engine/types';

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

export function familyTrackStyle(family: FamilyConfig, component: 'hue' | 'chroma'): string {
  return `--range-track: ${gradient(0, component === 'hue' ? 360 : 0.3, value => toColor({
    l: 0.62, c: component === 'chroma' ? value : family.chroma, h: component === 'hue' ? value : family.hue,
  }), component === 'hue' ? 72 : 24)}`;
}

export function surfaceTrackStyle(config: BuilderConfig, mode: Mode, component: 'lightness' | 'spacing'): string {
  const neutral = config.families.find(family => family.id === 'neutral')!;
  const track = component === 'lightness'
    ? gradient(0, 1, l => toColor({ l, c: neutral.chroma, h: neutral.hue }))
    : gradient(0.001, 0.2, value => surfaceGeneration({ ...config, surfaces: { ...config.surfaces,
      step: { light: surfaceStep(config, 'light'), dark: surfaceStep(config, 'dark'), [mode]: value },
    } }, mode).colors.at(-1)!);
  return `--range-track: ${track}`;
}

export function mutedTrackStyle(config: BuilderConfig, mode: Mode, component: 'distance' | 'chroma'): string {
  const brand = config.families.find(family => family.id === 'brand')!;
  return `--range-track: ${gradient(component === 'distance' ? -0.08 : 0,
    component === 'distance' ? mode === 'dark' ? 0.5 : 0.16 : 200, value => {
      const muted = component === 'distance'
        ? { ...config.muted, distance: { light: mutedDistance(config, 'light'), dark: mutedDistance(config, 'dark'), [mode]: value } }
        : { ...config.muted, chromaScale: { light: mutedChromaScale(config, 'light'), dark: mutedChromaScale(config, 'dark'), [mode]: value / 100 } };
      return mutedGeneration({ ...config, muted }, mode, brand).colors[0];
    })}`;
}

export function mutedBorderTrackStyle(config: BuilderConfig, mode: Mode): string {
  const brand = config.families.find(family => family.id === 'brand')!;
  const colors = mutedGeneration(config, mode, brand).colors;
  return `--range-track: ${gradient(0, MAX_MUTED_BORDER_STRENGTH, strength => adjustMutedBorders({ ...config,
    muted: { ...config.muted, borderStrength: { light: strength, dark: strength } },
  }, mode, brand, colors[1], colors[2])[0])}`;
}

export function stateTrackStyle(config: BuilderConfig, system: GeneratedSystem, kind: 'muted' | 'emphasis'): string {
  const brand = config.families.find(family => family.id === 'brand')!;
  const count = config.emphasis.selected ? 4 : 3;
  const tracks = (['light', 'dark'] as const).map(mode => gradient(kind === 'muted' ? 0.005 : 0.01,
    kind === 'muted' ? 0.07 : 0.1, separation => {
      if (kind === 'muted') return mutedGeneration({ ...config, muted: { ...config.muted, separation } }, mode, brand).colors.at(-1)!;
      // Hold the accepted emphasis base fixed; contrast protection can move it
      // after an edit. Shared emphasis uses light-mode direction in both modes.
      const shared = config.emphasis.reverseDarkStates || config.emphasis.strategy !== 'adaptive';
      const base = system.modes[shared ? 'light' : mode].families.brand.roles['emphasis.base']!.color;
      const direction = mode === 'dark' && (config.emphasis.reverseDarkStates || !shared) ? 'dark' : 'light';
      return generateStates(base, direction, separation, count).colors.at(-1)!;
    }));
  return `--range-track: ${tracks[0]} top / 100% 50% no-repeat, ${tracks[1]} bottom / 100% 50% no-repeat`;
}
