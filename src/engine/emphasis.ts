import { formatHex } from 'culori';
import { BoundedCache } from './bounded-cache';
import type { BuilderConfig, ColorValue, EmphasisMixWeights, Mode, State } from './types';

export const DEFAULT_EMPHASIS_WEIGHTS: EmphasisMixWeights = { hover: 0.92, active: 0.85, selected: 0.8 };
export const emphasisStates = ['hover', 'active', 'selected'] as const;
const mixedColors = new BoundedCache<string, ColorValue>(16384);

/** Import old absolute spacing as a proportional rule around the former 0.5 reference tone. */
export function legacyEmphasisWeights(separation: number): EmphasisMixWeights {
  return Object.fromEntries(emphasisStates.map((state, index) => [state,
    Number(Math.max(0, Math.min(1, 1 - separation * (index + 1) / 0.5)).toFixed(8)),
  ])) as EmphasisMixWeights;
}

export function emphasisTarget(config: BuilderConfig, mode: Mode): 'black' | 'white' {
  return mode === 'dark' && (config.emphasis.reverseDarkStates || config.emphasis.strategy === 'adaptive') ? 'white' : 'black';
}

/** Match opaque CSS OKLCH interpolation. Never independently gamut-map the result. */
export function mixEmphasis(base: ColorValue, weight: number, target: 'black' | 'white'): ColorValue {
  const key = `${base.l}|${base.c}|${base.h}|${weight}|${target}`;
  const cached = mixedColors.get(key);
  if (cached) return { ...cached };
  const l = base.l * weight + (target === 'white' ? 1 - weight : 0);
  const c = base.c * weight;
  const h = base.h;
  const css = `oklch(${l} ${c} ${h})`;
  const color = { l, c, h, css, hex: formatHex(css)!, gamutMapped: false };
  mixedColors.set(key, color);
  return { ...color };
}

export function emphasisStateColors(config: BuilderConfig, base: ColorValue, mode: Mode): ColorValue[] {
  const weights = config.emphasis.mixWeights!;
  return [base, ...emphasisStates.slice(0, config.emphasis.selected ? 3 : 2)
    .map(state => mixEmphasis(base, weights[state], emphasisTarget(config, mode)))];
}

export function emphasisRecipe(system: { config: BuilderConfig }, name: string): { base: string; state: Exclude<State, 'base'> } | undefined {
  if (!system.config.emphasis?.mixWeights) return;
  const prefix = `--${system.config.prefix}-bg-`;
  if (!name.startsWith(prefix)) return;
  const match = name.slice(prefix.length).match(/^([a-z]+)-emphasis-(hover|active|selected)$/);
  if (!match || !system.config.families.some(family => family.id === match[1])) return;
  return { base: `${prefix}${match[1]}-emphasis-base`, state: match[2] as Exclude<State, 'base'> };
}
