import { colorIdentity, parseLockedColor } from './color';
import type { BuilderConfig, FamilyRole, GeneratedSystem, Mode } from './types';

type System = Pick<GeneratedSystem, 'config' | 'modes'>;
const modes: Mode[] = ['light', 'dark'];
const tolerance = 1e-9;
const sharedEmphasis = (config: BuilderConfig) => config.emphasis.reverseDarkStates || config.emphasis.strategy !== 'adaptive';

/** Inspect final semantic roles, after every reuse and border-adjustment pass. */
export function sharedLightnessIssues({ config, modes: themes }: System): string[] {
  const issues = conflictingLightnessLocks(config).map(conflict => `Conflicting exact locks: ${conflict}.`);
  const paths: FamilyRole[] = ['muted.base', 'muted.hover', 'muted.active', 'emphasis.base', 'emphasis.hover', 'emphasis.active',
    'foreground.base', 'foreground.hover', 'border.muted.base', 'border.muted.hover', 'border.emphasis.base', 'border.emphasis.hover'];
  if (config.emphasis.selected) paths.push('muted.selected', 'emphasis.selected');
  for (const mode of modes) for (const path of paths) {
    const values = config.families.map(f => themes[mode].families[f.id]?.roles[path]?.color.l);
    if (values.some(l => l === undefined || !Number.isFinite(l))) issues.push(`${mode} ${path}: missing or non-finite family lightness.`);
    else if (Math.max(...values as number[]) - Math.min(...values as number[]) > tolerance)
      issues.push(`${mode} ${path}: corresponding family roles require shared lightness.`);
  }
  if (sharedEmphasis(config)) for (const family of config.families) {
    const light = themes.light.families[family.id]?.roles['emphasis.base']?.color.l;
    const dark = themes.dark.families[family.id]?.roles['emphasis.base']?.color.l;
    if (light === undefined || dark === undefined || Math.abs(light - dark) > tolerance)
      issues.push(`${family.id} emphasis.base: light and dark require shared lightness.`);
  }
  return issues;
}

export function assertSharedLightness(system: System): void {
  const issues = sharedLightnessIssues(system);
  if (issues.length) throw new Error(`Shared lightness requirements failed: ${issues.join(' ')}`);
}

/** Hard locks cannot be reconciled by limiting numeric controls. */
export function conflictingLightnessLocks(config: BuilderConfig): string[] {
  const locks = config.anchors.filter(a => a.locked).map(anchor => ({ ...anchor, parsed: parseLockedColor(anchor.color) }));
  const issues: string[] = [];
  for (const mode of modes) for (const role of ['emphasis.base', 'foreground.base'] as const) {
    const group = locks.filter(a => a.role === role && (a.mode === mode || a.mode === 'both' || role === 'emphasis.base' && sharedEmphasis(config)));
    if (group.some(a => Math.abs(a.parsed.l - group[0].parsed.l) > tolerance))
      issues.push(`${mode} ${role} (${group.map(a => a.family).join(', ')})`);
  }
  if (sharedEmphasis(config)) for (const family of config.families) {
    const group = locks.filter(a => a.family === family.id && a.role === 'emphasis.base');
    if (group.some(a => colorIdentity(a.parsed) !== colorIdentity(group[0].parsed))) issues.push(`${family.id} shared emphasis base`);
  }
  return [...new Set(issues)];
}
