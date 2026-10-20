import { mutedBorderStrength, mutedChromaScale, mutedDistance, surfaceStep } from '../engine/config';
import type { BuilderConfig, EmphasisMixWeights, Mode } from '../engine/types';
import { emphasisStates } from '../engine/emphasis';

/** Keep the edited weight and move neighbors only when needed to retain state ordering. */
export function setEmphasisWeight(weights: EmphasisMixWeights, state: keyof EmphasisMixWeights, weight: number): EmphasisMixWeights {
  const next = { ...weights, [state]: weight };
  const position = emphasisStates.indexOf(state);
  emphasisStates.forEach((key, index) => {
    if (index < position) next[key] = Math.max(next[key], weight);
    if (index > position) next[key] = Math.min(next[key], weight);
  });
  return next;
}
export function normalizeNumericControl(value: number, min: number, max: number, step: number): number | undefined {
  if (!Number.isFinite(value)) return undefined;
  const bounded = Math.max(min, Math.min(max, value));
  return Math.max(min, Math.min(max, Number((min + Math.round((bounded - min) / step) * step).toFixed(10))));
}
export function adjustedControlKeys(requested: BuilderConfig, accepted: BuilderConfig): string[] {
  const keys: string[] = [];
  const compare = (key: string, before: number, after: number) => { if (Math.abs(before - after) > 1e-9) keys.push(key); };
  for (const mode of ['light', 'dark'] as Mode[]) {
    compare(`surfaces.${mode}.l`, requested.surfaces[mode].l, accepted.surfaces[mode].l);
    compare(`surfaces.${mode}.step`, surfaceStep(requested, mode), surfaceStep(accepted, mode));
    compare(`muted.${mode}.distance`, mutedDistance(requested, mode), mutedDistance(accepted, mode));
    compare(`muted.${mode}.chroma`, mutedChromaScale(requested, mode), mutedChromaScale(accepted, mode));
    compare(`muted.${mode}.border`, mutedBorderStrength(requested, mode), mutedBorderStrength(accepted, mode));
  }
  compare('surfaces.levels', requested.surfaces.levels, accepted.surfaces.levels);
  compare('muted.separation', requested.muted.separation, accepted.muted.separation);
  compare('emphasis.separation', requested.emphasis.separation, accepted.emphasis.separation);
  if (requested.muted.mixWeights && accepted.muted.mixWeights) for (const state of emphasisStates)
    compare(`muted.${state}`, requested.muted.mixWeights[state], accepted.muted.mixWeights[state]);
  if (requested.emphasis.mixWeights && accepted.emphasis.mixWeights) for (const state of emphasisStates)
    compare(`emphasis.${state}`, requested.emphasis.mixWeights[state], accepted.emphasis.mixWeights[state]);
  for (const family of requested.families) {
    const next = accepted.families.find(item => item.id === family.id);
    if (next) for (const component of ['hue', 'chroma'] as const) compare(`families.${family.id}.${component}`, family[component], next[component]);
  }
  return keys;
}
