import type { ContrastCheck, Mode } from '../engine/types';

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/** Strip only the configured prefix; retain the family, role and state. */
export function describeNeutralRole(semantic: string, prefix: string): string {
  const tokenPrefix = `--${prefix}-`;
  if (!semantic.startsWith(tokenPrefix)) return semantic;
  const name = semantic.slice(tokenPrefix.length);
  if (name === 'fg-on-emphasis') return 'Text on emphasis fills';
  if (name.startsWith('bg-surface-')) return `Surface · ${capitalize(name.slice('bg-surface-'.length).replaceAll('-', ' '))}`;
  const [type, ...parts] = name.split('-');
  const role = type === 'fg' ? 'text' : type === 'bg' ? 'fill' : type === 'border' ? 'border' : '';
  if (!role || !parts.length) return semantic;
  const state = capitalize(parts.pop()!);
  const context = parts.join(' ');
  return `${capitalize(context ? `${context} ${role}` : role)} · ${state}`;
}

type ContrastRelationship = Pick<ContrastCheck, 'mode' | 'foreground' | 'background' | 'ratio'> & {
  id: string;
  checks: ContrastCheck[];
};

/** A ratio belongs to a color pair; each check retains its own requirement. */
export function groupContrastChecks(checks: ContrastCheck[]): ContrastRelationship[] {
  const groups = new Map<string, ContrastRelationship>();
  for (const check of checks) {
    const id = JSON.stringify([check.mode, check.foreground, check.background]);
    const group = groups.get(id);
    if (group) group.checks.push(check);
    else groups.set(id, { id, mode: check.mode, foreground: check.foreground, background: check.background, ratio: check.ratio, checks: [check] });
  }
  return [...groups.values()];
}

export type ContrastTable = {
  id: string;
  mode: Mode;
  fixedRole: string;
  fixedSide: 'foreground' | 'background';
  category: 'text' | 'boundary';
  relationships: ContrastRelationship[];
};

/** Name the selected role once, then compare the other roles in rows. */
export function groupContrastTables(relationships: ContrastRelationship[], selectedRoles: Record<Mode, string[]>): ContrastTable[] {
  const tables = new Map<string, ContrastTable>();
  for (const relationship of relationships) {
    const fixedSide = selectedRoles[relationship.mode].includes(relationship.background) ? 'background' : 'foreground';
    const fixedRole = relationship[fixedSide];
    const category = relationship.checks.some(check => check.kind === 'ui-boundary') ? 'boundary' : 'text';
    const id = JSON.stringify([relationship.mode, fixedSide, fixedRole, category]);
    const table = tables.get(id);
    if (table) table.relationships.push(relationship);
    else tables.set(id, { id, mode: relationship.mode, fixedRole, fixedSide, category, relationships: [relationship] });
  }
  return [...tables.values()];
}
