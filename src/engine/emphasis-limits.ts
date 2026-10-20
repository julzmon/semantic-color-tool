import { emphasisStates, emphasisTarget } from './emphasis';
import { mutedTarget } from './muted';
import type { BuilderConfig, GeneratedSystem } from './types';

/** Application design limits; contrast requirements are checked separately. */
export const MAX_EMPHASIS_LIGHTNESS_CHANGE = .12;
export const MAX_EMPHASIS_STRENGTH = .25;

/** One shared ceiling must respect every affected family and both theme directions. */
function groupStrengthLimit(system: GeneratedSystem, group: 'muted' | 'emphasis'): number {
  let limit = MAX_EMPHASIS_STRENGTH;
  for (const mode of ['light', 'dark'] as const) for (const family of system.config.families) {
    const base = system.modes[mode].families[family.id].roles[`${group}.base`]!.color;
    const target = group === 'muted' ? mutedTarget(mode) : emphasisTarget(system.config, mode);
    const distance = target === 'white' ? 1 - base.l : base.l;
    if (distance > 0) limit = Math.min(limit, MAX_EMPHASIS_LIGHTNESS_CHANGE / distance);
  }
  // Round down to 0.1 percentage points so displayed limits remain conservative.
  return Math.max(0, Math.floor((limit + 1e-12) * 1000) / 1000);
}

export const emphasisStrengthLimit = (system: GeneratedSystem) => groupStrengthLimit(system, 'emphasis');
export const mutedStrengthLimit = (system: GeneratedSystem) => groupStrengthLimit(system, 'muted');

/** Preserve exact anchors, the base recipe and weak-to-strong state ordering. */
function capGroupStrengths(system: GeneratedSystem, group: 'muted' | 'emphasis', ceiling: number): BuilderConfig {
  const weights = system.config[group].mixWeights;
  if (!weights || emphasisStates.every(state => 1 - weights[state] <= ceiling + 1e-12)) return system.config;
  const config = structuredClone(system.config);
  config[group].mixWeights = { ...weights };
  const strongest = Math.max(...emphasisStates.map(state => 1 - weights[state]));
  const scale = ceiling / strongest;
  for (const state of emphasisStates) {
    // Scale the complete recipe to preserve spacing instead of clipping several
    // states to the same color. Round strength down to keep the cap strict.
    const strength = Math.floor(((1 - weights[state]) * scale + 1e-12) * 1e6) / 1e6;
    config[group].mixWeights[state] = Number((1 - strength).toFixed(6));
  }
  return config;
}

export const capEmphasisStrengths = (system: GeneratedSystem, ceiling = emphasisStrengthLimit(system)) => capGroupStrengths(system, 'emphasis', ceiling);
export const capMutedStrengths = (system: GeneratedSystem, ceiling = mutedStrengthLimit(system)) => capGroupStrengths(system, 'muted', ceiling);
