import { chromaCurveIssues } from './chroma-curves';
import { sharedLightnessIssues } from './shared-lightness';
import type { BalancedConfiguration } from './balance';
import { isSrgb } from './color';
import { mutedDistance, surfaceStep } from './config';
import { generateSystem } from './generate';
import { capEmphasisStrengths, capMutedStrengths } from './emphasis-limits';
import type { BuilderConfig, GeneratedRole, GeneratedSystem, Mode } from './types';

const modes: Mode[] = ['light', 'dark'];
const MAX_MOVEMENT = 0.02;
const CANDIDATES_PER_PASS = 32;
const PASSES = 2;

/** Shared L positions across every primitive, independent of hue and chroma. */
export function countLightnessStops(system: GeneratedSystem): number {
  return new Set(system.primitives.map(primitive => primitive.color.l.toFixed(10))).size;
}

function roleGroups(system: GeneratedSystem): GeneratedRole[][] {
  return modes.flatMap(mode => {
    const theme = system.modes[mode];
    return [theme.surfaces, [theme.foreground.base, theme.foreground.muted], [theme.foreground.onEmphasis],
      ...Object.values(theme.families).flatMap(family =>
        ['muted', 'emphasis', 'foreground', 'border.muted', 'border.emphasis'].map(group =>
          ['base', 'hover', 'active', 'selected'].flatMap(state => {
            const role = family.roles[`${group}.${state}` as keyof typeof family.roles];
            return role ? [role] : [];
          })))];
  });
}

function safeCandidate(original: GeneratedSystem, candidate: GeneratedSystem): boolean {
  if (sharedLightnessIssues(candidate).length || chromaCurveIssues(candidate).length) return false;
  if (!candidate.checks.length || !candidate.checks.every(check => check.pass) || !candidate.primitives.every(primitive => isSrgb(primitive.color))) return false;
  // Restore/import runs the balancer's shared strength caps. Reject any
  // alignment that would alter those recipes on the next regeneration.
  if (capEmphasisStrengths(candidate) !== candidate.config || capMutedStrengths(candidate) !== candidate.config) return false;
  const before = roleGroups(original);
  const after = roleGroups(candidate);
  for (let group = 0; group < before.length; group++) {
    for (let index = 0; index < before[group].length; index++) {
      const first = before[group][index].color;
      const next = after[group][index].color;
      if (Math.abs(next.l - first.l) > MAX_MOVEMENT + 1e-10 || (first.source && next.css !== first.css)) return false;
      // Preserve hierarchy within related state/surface/text groups. Unrelated
      // roles may share L: creating those alignments is the optimization goal.
      for (let other = index + 1; other < before[group].length; other++) {
        const delta = before[group][other].color.l - first.l;
        const nextDelta = after[group][other].color.l - next.l;
        if (Math.abs(delta) > 1e-10 && Math.sign(delta) * nextDelta <= 1e-10) return false;
      }
    }
  }
  return true;
}

type Option = { mode: Mode; kind: 'step' | 'distance'; value: number; movement: number };
function options(system: GeneratedSystem): Option[] {
  const config = system.config;
  const targets = [...new Set(system.primitives.map(primitive => primitive.color.l))];
  const result: Option[] = [];
  const seen = new Set<string>();
  const add = (mode: Mode, kind: Option['kind'], value: number) => {
    const current = kind === 'step' ? surfaceStep(config, mode) : mutedDistance(config, mode);
    const movement = Math.abs(value - current) * (kind === 'step' ? Math.max(1, config.surfaces.levels - 1) : 1);
    const key = `${mode}:${kind}:${value.toFixed(12)}`;
    if (!Number.isFinite(value) || movement < 1e-10 || movement > MAX_MOVEMENT + 1e-10 || seen.has(key)) return;
    if (kind === 'step' ? value < 0.001 || value > 0.2 : value < -0.08 || value > (mode === 'light' ? 0.16 : 0.5)) return;
    seen.add(key);
    result.push({ mode, kind, value, movement });
  };
  for (const mode of modes) {
    const dir = mode === 'light' ? -1 : 1;
    const base = config.surfaces[mode].l;
    for (const target of targets) {
      for (let level = 1; level < config.surfaces.levels; level++) add(mode, 'step', (target - base) / (dir * level));
      const weights = config.muted.mixWeights ? [1, ...(['hover', 'active', 'selected'] as const).slice(0, config.emphasis.selected ? 3 : 2).map(state => config.muted.mixWeights![state])] : [1];
      for (const weight of weights) {
        if (weight === 0) continue;
        const mutedBase = (target - (mode === 'dark' ? 1 - weight : 0)) / weight;
        add(mode, 'distance', (mutedBase - base) / dir);
      }
    }
  }
  return result.sort((a, b) => a.movement - b.movement || a.mode.localeCompare(b.mode) || a.kind.localeCompare(b.kind) || a.value - b.value);
}

/** Bounded local search, never a claim of the globally smallest possible palette.
 * Only existing spacing controls change, so saves/imports and CSS mix recipes
 * regenerate the exact accepted result. Contrast targets and locks stay fixed.
 */
export function reduceLightnessStops(input: BuilderConfig): BalancedConfiguration {
  const original = generateSystem(input);
  if (input.targets.normalText < 4.5 || input.targets.largeText < 3 || input.targets.ui < 3 || sharedLightnessIssues(original).length || chromaCurveIssues(original).length || !original.checks.length || !original.checks.every(check => check.pass)) {
    throw new Error('Lightness reduction requires a palette with shared lightness and all protected contrast checks passing.');
  }
  let best = original;
  let bestCount = countLightnessStops(best);
  const initialCount = bestCount;
  const seen = new Set([JSON.stringify(original.config)]);
  for (let pass = 0; pass < PASSES; pass++) {
    const starting = best;
    for (const option of options(starting).slice(0, CANDIDATES_PER_PASS)) {
      const config = structuredClone(starting.config);
      if (option.kind === 'step') config.surfaces.step = { light: surfaceStep(config, 'light'), dark: surfaceStep(config, 'dark'), [option.mode]: option.value };
      else config.muted.distance = { light: mutedDistance(config, 'light'), dark: mutedDistance(config, 'dark'), [option.mode]: option.value };
      const key = JSON.stringify(config);
      if (seen.has(key)) continue;
      seen.add(key);
      const candidate = generateSystem(config);
      const count = countLightnessStops(candidate);
      if (count < bestCount && safeCandidate(original, candidate)) { best = candidate; bestCount = count; }
    }
    if (best === starting) break;
  }
  return {
    config: best.config,
    system: best,
    message: bestCount < initialCount
      ? `Reduced shared lightness stops from ${initialCount} to ${bestCount}. Both themes pass all checked contrast relationships; shared lightness by role, locked colors and state order are preserved.`
      : `Kept ${initialCount} shared lightness stops. No safe reduction was found within the bounded search.`,
  };
}
