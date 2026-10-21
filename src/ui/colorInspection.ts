import type { ColorValue, ContrastCheck, GeneratedSystem, Mode } from '../engine/types';
import { resolvePreviewToken } from './previewTokens';

export type ColorInspectionSelection = { mode: Mode; token: string } | { mode?: Mode; primitive: string };
export interface ColorInspection {
  color: ColorValue;
  name: string;
  label: string;
  mode?: Mode;
  checks: ContrastCheck[];
  relationship?: ContrastCheck;
}
export function colorInspection(system: GeneratedSystem, selection: ColorInspectionSelection): ColorInspection | undefined {
  const token = 'token' in selection ? resolvePreviewToken(system, selection.mode, selection.token) : undefined;
  const primitive = 'primitive' in selection ? system.primitives.find(item => item.name === selection.primitive) : undefined;
  if (!token && !primitive) return;
  const names = new Set(token ? [`${selection.mode}:${token.role.semantic}`] : primitive!.usages);
  const checks = system.checks.filter(check => (!selection.mode || check.mode === selection.mode) &&
    (names.has(`${check.mode}:${check.foreground}`) || names.has(`${check.mode}:${check.background}`)));
  // Failed relationships first; otherwise the smallest margin above its own requirement.
  const sorted = [...checks].sort((a, b) => Number(a.pass) - Number(b.pass) ||
    (a.ratio - a.target) - (b.ratio - b.target) || a.id.localeCompare(b.id));
  return { color: token?.role.color ?? primitive!.color, name: token?.role.semantic ?? primitive!.name,
    label: token?.label ?? `Color ${primitive!.color.hex}`, mode: selection.mode, checks,
    relationship: sorted[0] };
}
export function contrastGrade(check: ContrastCheck): string {
  if (!check.pass) return 'Fail';
  if (check.kind === 'ui-boundary') return 'Pass';
  return check.ratio >= (check.kind === 'normal-text' ? 7 : 4.5) ? 'AAA' : 'AA';
}
