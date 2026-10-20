import { balanceConfiguration } from '../engine/balance';
import { MAX_MUTED_BORDER_STRENGTH, mutedBorderStrength, mutedChromaScale, mutedDistance, surfaceStep } from '../engine/config';
import { legacyMutedWeights } from '../engine/muted';
import { legacyEmphasisWeights } from '../engine/emphasis';
import { setEmphasisWeight } from './controlValues';
import type { BuilderConfig, FamilyId, Mode } from '../engine/types';

export interface ControlDescriptor { key: string; label: string; value: number; min: number; max: number; step: number; unit: string }
export interface ControlSample { value: number; safe: boolean; failedChecks: number; acceptedValue?: number; reason?: string }
export interface ControlAvailability { key: string; samples: ControlSample[] }
export interface ControlAvailabilityView {
  descriptor: ControlDescriptor;
  status: 'checking' | 'ready' | 'error';
  samples: ControlSample[];
  retained?: boolean;
  error?: string;
}

/** Display units and supported domains match the existing controls. */
export function controlDescriptor(config: BuilderConfig, key: string): ControlDescriptor {
  const parts = key.split('.');
  const mode = parts[1] as Mode;
  const field = parts[2];
  const make = (label: string, value: number, min: number, max: number, step = .001, unit = '') => ({ key, label, value, min, max, step, unit });
  if (parts[0] === 'families') {
    const family = config.families.find(f => f.id === parts[1]);
    if (family && field === 'hue') return make(`${family.label} hue`, family.hue, 0, 360, 1, '°');
    if (family && field === 'chroma') return make(`${family.label} chroma`, family.chroma, 0, .3);
  }
  if (key === 'surfaces.levels') return make('Surface count', config.surfaces.levels, 1, 6, 1);
  if (parts[0] === 'surfaces' && ['light','dark'].includes(mode)) {
    if (field === 'l') return make(`${mode} base lightness`, config.surfaces[mode].l, 0, 1);
    if (field === 'step') return make(`${mode} level spacing`, surfaceStep(config, mode), .001, .2);
  }
  if (key === 'muted.separation') return make('Muted state spacing', config.muted.separation, .005, .07, .005);
  if (parts[0] === 'muted' && ['light','dark'].includes(mode)) {
    if (field === 'distance') return make(`${mode} muted distance`, mutedDistance(config, mode), -.08, mode === 'dark' ? .5 : .16, .005);
    if (field === 'chroma') return make(`${mode} muted chroma`, mutedChromaScale(config, mode) * 100, 0, 200, 1, '%');
    if (field === 'border') return make(`${mode} muted border strength`, mutedBorderStrength(config, mode) / MAX_MUTED_BORDER_STRENGTH * 100, 0, 100, 1, '%');
  }
  if (key === 'emphasis.includeSelected') return make('Selected state', Number(config.emphasis.selected), 0, 1, 1);
  if (['muted','emphasis'].includes(parts[0]) && ['hover','active','selected'].includes(parts[1])) {
    const state = parts[1] as 'hover' | 'active' | 'selected';
    const group = parts[0] as 'muted' | 'emphasis';
    const weights = config[group].mixWeights ?? (group === 'muted' ? legacyMutedWeights : legacyEmphasisWeights)(config[group].separation);
    return make(`${state} ${group} strength`, Number(((1 - weights[state]) * 100).toFixed(6)), 0, 100, .1, '%');
  }
  throw new Error(`Unknown control ${key}.`);
}

/** The same value setter is used by direct controls and by background probes. */
export function setControlValue(config: BuilderConfig, key: string, value: number): BuilderConfig {
  const next = structuredClone(config);
  const [group, part, field] = key.split('.');
  const mode = part as Mode;
  controlDescriptor(config, key); // Reject unknown paths rather than silently probing unchanged settings.
  if (!Number.isFinite(value)) throw new Error('Control value must be finite.');
  if (group === 'families') {
    const family = next.families.find(f => f.id === part as FamilyId)!;
    if (field === 'hue') family.hue = value; else family.chroma = value;
  } else if (key === 'surfaces.levels') next.surfaces.levels = value;
  else if (group === 'surfaces') {
    if (field === 'l') next.surfaces[mode].l = value;
    else next.surfaces.step = { light: surfaceStep(config, 'light'), dark: surfaceStep(config, 'dark'), [mode]: value };
  } else if (key === 'muted.separation') next.muted.separation = value;
  else if (group === 'muted' && ['hover','active','selected'].includes(part)) {
    const weights = next.muted.mixWeights ?? legacyMutedWeights(next.muted.separation);
    next.muted.mixWeights = setEmphasisWeight(weights, part as keyof typeof weights, Number((1 - value / 100).toFixed(6)));
  } else if (group === 'muted') {
    if (field === 'distance') next.muted.distance = { light: mutedDistance(config, 'light'), dark: mutedDistance(config, 'dark'), [mode]: value };
    else if (field === 'chroma') next.muted.chromaScale = { light: mutedChromaScale(config, 'light'), dark: mutedChromaScale(config, 'dark'), [mode]: value / 100 };
    else next.muted.borderStrength = { light: mutedBorderStrength(config, 'light'), dark: mutedBorderStrength(config, 'dark'), [mode]: Number((value / 100 * MAX_MUTED_BORDER_STRENGTH).toFixed(6)) };
  } else if (key === 'emphasis.includeSelected') next.emphasis.selected = value !== 0;
  else {
    const weights = next.emphasis.mixWeights ?? legacyEmphasisWeights(next.emphasis.separation);
    next.emphasis.mixWeights = setEmphasisWeight(weights, part as keyof typeof weights, Number((1 - value / 100).toFixed(6)));
  }
  return next;
}

/** Probe the current value and both ends through the same bounded balancer as edits. */
export function controlSamples(control: ControlDescriptor): number[] {
  if (control.key === 'surfaces.levels' || control.key === 'emphasis.includeSelected') {
    return Array.from({ length: Math.round((control.max - control.min) / control.step) + 1 }, (_, i) => control.min + i * control.step);
  }
  return [...new Set([control.value, control.min, control.max])];
}

export function probeControlValue(config: BuilderConfig, key: string, value: number): ControlSample {
  try {
    const result = balanceConfiguration(config, setControlValue(config, key, value));
    const failedChecks = result.system.checks.filter(check => !check.pass).length;
    return { value, acceptedValue: controlDescriptor(result.config, key).value,
      safe: result.system.checks.length > 0 && failedChecks === 0, failedChecks };
  } catch (error) {
    return { value, safe: false, failedChecks: 0, reason: error instanceof Error ? error.message : 'Unable to check this value.' };
  }
}

/** Current bounded-search envelope, not a proof that every interior value passes.
 * Every edit inside it still goes through the full balancer. Include the accepted
 * value so refreshed limits never displace the current setting. */
export function controlLimits(view: ControlAvailabilityView | undefined): { min: number; max: number } | undefined {
  if (!view || (view.status !== 'ready' && !view.retained)) return;
  const values = view.samples.filter(sample => sample.safe).map(sample => sample.acceptedValue ?? sample.value);
  if (!values.length) return;
  values.push(view.descriptor.value);
  return { min: Math.max(view.descriptor.min, Math.min(...values)), max: Math.min(view.descriptor.max, Math.max(...values)) };
}
