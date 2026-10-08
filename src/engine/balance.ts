import { generateSystem } from './generate';
import { mutedDistance, surfaceStep } from './config';
import type { BuilderConfig, GeneratedSystem, Mode } from './types';

export interface BalancedConfiguration {
  config: BuilderConfig;
  system: GeneratedSystem;
  message: string;
}
const modes: Mode[] = ['light', 'dark'];
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Try only verified results; the bounded search may stop short of the true feasible limit. */
export function balanceConfiguration(previous: BuilderConfig, requested: BuilderConfig): BalancedConfiguration {
  if (requested.targets.normalText < 4.5 || requested.targets.largeText < 3 || requested.targets.ui < 3)
    throw new Error('Contrast protection requires at least 4.5:1 normal text, 3:1 large text and 3:1 UI boundaries.');
  // Candidate rounding and unchanged settings can revisit the same request.
  // Keep this cache local: failures are cached too, and no result outlives the edit.
  const evaluated = new Map<string, GeneratedSystem>();
  const evaluate = (config: BuilderConfig) => {
    const key = JSON.stringify(config);
    const cached = evaluated.get(key);
    if (cached) return cached;
    const system = generateSystem(config);
    evaluated.set(key, system);
    return system;
  };
  const tryConfig = (config: BuilderConfig): GeneratedSystem | undefined => {
    const system = evaluate(config);
    return system.checks.length && system.checks.every(check => check.pass) ? system : undefined;
  };
  const finish = (system: GeneratedSystem, limited = false): BalancedConfiguration => {
    const changes: string[] = [];
    for (const mode of modes) {
      if (system.config.surfaces[mode].l !== requested.surfaces[mode].l) changes.push(`${mode} base lightness`);
      if (surfaceStep(system.config, mode) !== surfaceStep(requested, mode)) changes.push(`${mode} tonal step`);
      if (mutedDistance(system.config, mode) !== mutedDistance(requested, mode)) changes.push(`${mode} muted distance`);
    }
    if (system.config.muted.separation !== requested.muted.separation) changes.push('muted state separation');
    if (system.config.emphasis.separation !== requested.emphasis.separation) changes.push('emphasis state separation');
    if (!equal(system.config.families, requested.families)) changes.push('family color settings');
    if (!equal(system.config.muted.chromaScale, requested.muted.chromaScale) && requested.muted.chromaScale) changes.push('muted chroma');
    if (system.config.surfaces.levels !== requested.surfaces.levels) changes.push('surface levels');
    return { config: system.config, system, message: changes.length
      ? `${limited ? 'Limited the requested change and adjusted' : 'Adjusted'} ${changes.join(', ')} to keep all checked contrast relationships passing.` : '' };
  };
  const direct = evaluate(requested);
  if (direct.checks.length && direct.checks.every(check => check.pass)) return finish(direct);
  const failingModes = new Set(direct.checks.filter(check => !check.pass).map(check => check.mode));
  const candidate = structuredClone(requested);
  // Reduce only spacing the user did not edit, staying inside the controls' ranges.
  if (candidate.emphasis.separation === previous.emphasis.separation) candidate.emphasis.separation = 0.01;
  let result = tryConfig(candidate);
  if (result) return finish(result);
  if (candidate.muted.separation === previous.muted.separation) candidate.muted.separation = 0.005;
  result = tryConfig(candidate);
  if (result) return finish(result);
  candidate.surfaces.step = Object.fromEntries(modes.map(mode => [mode,
    failingModes.has(mode) && surfaceStep(requested, mode) === surfaceStep(previous, mode) ? 0.001 : surfaceStep(requested, mode)])) as Record<Mode, number>;
  result = tryConfig(candidate);
  if (result) return finish(result);
  // Retain the previous muted lightness when the user moves its surface base.
  candidate.muted.distance = Object.fromEntries(modes.map(mode => [mode,
    failingModes.has(mode) && mutedDistance(requested, mode) === mutedDistance(previous, mode)
      ? Math.max(-0.08, Math.min(mode === 'dark' ? 0.5 : 0.16,
        mutedDistance(previous, mode) + (mode === 'dark' ? 1 : -1) * (previous.surfaces[mode].l - requested.surfaces[mode].l)))
      : mutedDistance(requested, mode)])) as Record<Mode, number>;
  result = tryConfig(candidate);
  if (result) return finish(result);

  // Anchors/targets/strategy/state inclusion are hard requests, never interpolated away.
  const hard = (config: BuilderConfig) => ({ ...structuredClone(config), prefix: requested.prefix,
    targets: structuredClone(requested.targets), anchors: structuredClone(requested.anchors),
    emphasis: { ...config.emphasis, strategy: requested.emphasis.strategy, selected: requested.emphasis.selected } });
  const start = hard(previous);
  let best = tryConfig(start);
  if (!best) throw new Error('No passing contrast configuration was found with these targets and locked colors. The previous settings were kept.');
  const interpolate = (amount: number): BuilderConfig => {
    const mix = (a: number, b: number, increment = 0.001) => a === b ? a : Number((Math.round((a + (b - a) * amount) / increment) * increment).toFixed(6));
    const next = hard(previous);
    for (const mode of modes) next.surfaces[mode].l = mix(previous.surfaces[mode].l, candidate.surfaces[mode].l);
    next.surfaces.levels = Math.round(mix(previous.surfaces.levels, candidate.surfaces.levels));
    next.surfaces.step = Object.fromEntries(modes.map(mode => [mode, mix(surfaceStep(previous, mode), surfaceStep(candidate, mode))])) as Record<Mode, number>;
    next.muted.distance = Object.fromEntries(modes.map(mode => [mode, mix(mutedDistance(previous, mode), mutedDistance(candidate, mode), 0.005)])) as Record<Mode, number>;
    next.muted.separation = mix(previous.muted.separation, candidate.muted.separation, 0.005);
    next.emphasis.separation = mix(previous.emphasis.separation, candidate.emphasis.separation, 0.005);
    next.muted.chromaScale = Object.fromEntries(modes.map(mode => [mode, mix(previous.muted.chromaScale?.[mode] ?? 1, candidate.muted.chromaScale?.[mode] ?? 1)])) as Record<Mode, number>;
    next.families = candidate.families.map(family => {
      const before = previous.families.find(item => item.id === family.id)!;
      return { ...family, hue: mix(before.hue, family.hue), chroma: mix(before.chroma, family.chroma) };
    });
    return next;
  };
  let low = 0, high = 1;
  for (let iteration = 0; iteration < 8; iteration++) {
    const amount = (low + high) / 2;
    const system = tryConfig(interpolate(amount));
    if (system) { low = amount; best = system; } else high = amount;
  }
  return finish(best, true);
}
