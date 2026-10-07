import { converter } from 'culori';
import { FAMILY_DEFINITIONS } from './families';
import type { BuilderConfig, KdsReference, Mode, OklchColor } from './types';

const toOklch = converter('oklch');

/** Seed designer controls from the real source colors, never from silent fallbacks. */
export function configFromReference(reference: KdsReference): BuilderConfig {
  const requiredColor = (mode: Mode, name: string): OklchColor => {
    const value = reference.resolved[mode][name];
    if (!value) throw new Error(`Missing essential KDS ${mode} token ${name}.`);
    const color = toOklch(value);
    if (!color || !Number.isFinite(color.l) || !Number.isFinite(color.c) || (color.alpha ?? 1) !== 1) {
      throw new Error(`Invalid essential KDS ${mode} token ${name}: expected an opaque color, received ${value}.`);
    }
    return { l: color.l, c: color.c, h: color.h ?? 0 };
  };

  return {
    version: 2,
    surfaces: {
      light: { l: requiredColor('light', '--kds-bg-surface-base').l },
      dark: { l: requiredColor('dark', '--kds-bg-surface-base').l },
      levels: 3,
      step: { light: 0.035, dark: 0.035 },
    },
    families: FAMILY_DEFINITIONS.map((family) => {
      const color = requiredColor('light', family.referenceToken);
      return { id: family.id, key: family.key, label: family.label, hue: color.h, chroma: color.c };
    }),
    muted: { distance: { light: 0.055, dark: 0.16 }, separation: 0.025 },
    emphasis: { separation: 0.045, selected: false, strategy: 'shared' },
    targets: { normalText: 4.5, largeText: 3, ui: 3 },
    anchors: [],
  };
}

/** Numeric steps from older version-1 configurations apply to both modes. */
export function surfaceStep(config: BuilderConfig, mode: Mode): number {
  return typeof config.surfaces.step === "number" ? config.surfaces.step : config.surfaces.step?.[mode];
}

/** Numeric distances from existing version-2 configurations apply to both modes. */
export function mutedDistance(config: BuilderConfig, mode: Mode): number {
  const distance = config.muted?.distance;
  return typeof distance === 'number' ? distance : (distance as Partial<Record<Mode, number>> | undefined)?.[mode] ?? NaN;
}
