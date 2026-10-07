import { mutedChromaScale, mutedDistance, surfaceStep } from '../engine/config';
import type { BuilderConfig, Mode } from '../engine/types';
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
  }
  compare('surfaces.levels', requested.surfaces.levels, accepted.surfaces.levels);
  compare('muted.separation', requested.muted.separation, accepted.muted.separation);
  compare('emphasis.separation', requested.emphasis.separation, accepted.emphasis.separation);
  for (const family of requested.families) {
    const next = accepted.families.find(item => item.id === family.id);
    if (next) for (const component of ['hue', 'chroma'] as const) compare(`families.${family.id}.${component}`, family[component], next[component]);
  }
  return keys;
}
