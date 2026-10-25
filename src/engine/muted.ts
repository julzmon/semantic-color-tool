import { curveColor } from './chroma-curves';
import { emphasisStates, legacyEmphasisWeights, mixEmphasis } from './emphasis';
import type { BuilderConfig, ColorValue, Mode, FamilyConfig } from './types';

/** Convert legacy spacing using the same 0.5 reference tone as emphasis migration. */
export const legacyMutedWeights = legacyEmphasisWeights;
export const mutedTarget = (mode: Mode): 'black' | 'white' => mode === 'light' ? 'black' : 'white';
export function withMutedStateControls(input: BuilderConfig): BuilderConfig {
  if (input.muted.mixWeights) return input;
  const config = structuredClone(input);
  config.muted.mixWeights = legacyMutedWeights(config.muted.separation);
  return config;
}
export function mutedStateColors(config: BuilderConfig, base: ColorValue, mode: Mode, family?: FamilyConfig): ColorValue[] {
  return [base, ...emphasisStates.slice(0, config.emphasis.selected ? 3 : 2)
    .map(state => { const color = mixEmphasis(base, config.muted.mixWeights![state], mutedTarget(mode));
      return config.chromaCurves && family && family.id !== 'neutral' ? curveColor(config, family, color.l, base.h) : color; })];
}
