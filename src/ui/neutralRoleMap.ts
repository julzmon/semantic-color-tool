import type { ContrastCheck, GeneratedRole, GeneratedSystem, Mode } from '../engine/types';

export type RoleGroup = 'text' | 'border' | 'surface' | 'fill';
export type RoleMapLabel = { semantic: string; label: string; group: RoleGroup; order: number };
export type RoleMapStop = {
  primitive: string;
  color: GeneratedRole['color'];
  labels: Record<Mode, Record<RoleGroup, RoleMapLabel[]>>;
  checks: Record<Mode, ContrastCheck[]>;
};
export type NeutralRoleMapModel = {
  stops: RoleMapStop[];
  rowSlots: Record<RoleGroup, number>;
};

const groups: RoleGroup[] = ['text', 'border', 'surface', 'fill'];
const stateOrder = ['base', 'hover', 'active', 'selected'];
const stateLabel = (value: string) => value[0].toUpperCase() + value.slice(1);

function labelFor(semantic: string, group: RoleGroup, order: number): RoleMapLabel {
  const suffix = semantic.split('-').at(-1) ?? semantic;
  const label = group === 'surface' ? (suffix === 'base' ? 'Surface base' : `Surface ${suffix.replace('level-', 'level ')}`) : group === 'text' ? `Text ${stateLabel(suffix)}` : group === 'border' ? `Border ${stateLabel(suffix)}` : `Fill ${stateLabel(suffix)}`;
  return { semantic, label, group, order };
}

function emptyLabels(): Record<Mode, Record<RoleGroup, RoleMapLabel[]>> {
  return { light: { text: [], border: [], surface: [], fill: [] }, dark: { text: [], border: [], surface: [], fill: [] } };
}

function emptyChecks(): Record<Mode, ContrastCheck[]> { return { light: [], dark: [] }; }

export function buildNeutralRoleMap(system: GeneratedSystem): NeutralRoleMapModel {
  const neutral = system.config.families.find((family) => family.id === 'neutral');
  const byPrimitive = new Map<string, RoleMapStop>();
  const add = (mode: Mode, role: GeneratedRole, group: RoleGroup, order: number) => {
    if (!role || !neutral || !system.primitives.some((item) => item.name === role.primitive && item.family === neutral.key)) return;
    const stop = byPrimitive.get(role.primitive) ?? { primitive: role.primitive, color: role.color, labels: emptyLabels(), checks: emptyChecks() };
    const labels = stop.labels[mode][group];
    if (!labels.some((item) => item.semantic === role.semantic)) labels.push(labelFor(role.semantic, group, order));
    byPrimitive.set(role.primitive, stop);
  };
  for (const mode of ['light', 'dark'] as Mode[]) {
    const theme = system.modes[mode];
    theme.surfaces.forEach((role, index) => add(mode, role, 'surface', index));
    add(mode, theme.foreground.base, 'text', 0);
    add(mode, theme.foreground.muted, 'text', 1);
    add(mode, theme.foreground.onEmphasis, 'text', 2);
    for (const family of Object.values(theme.families)) {
      for (const [path, role] of Object.entries(family.roles)) {
        if (!role) continue;
        const group: RoleGroup = path.startsWith('foreground') ? 'text' : path.startsWith('border') ? 'border' : path.startsWith('muted') || path.startsWith('emphasis') ? 'fill' : 'fill';
        const state = stateOrder.indexOf(path.split('.')[1] ?? 'base');
        add(mode, role, group, state < 0 ? 99 : state);
      }
    }
  }
  for (const check of system.checks) {
    for (const stop of byPrimitive.values()) {
      if (Object.values(stop.labels[check.mode]).flat().some((label) => label.semantic === check.foreground || label.semantic === check.background)) {
        if (!stop.checks[check.mode].some((item) => item.id === check.id)) stop.checks[check.mode].push(check);
      }
    }
  }
  const stops = [...byPrimitive.values()].sort((a, b) => b.color.l - a.color.l || a.primitive.localeCompare(b.primitive));
  const rowSlots = Object.fromEntries(groups.map((group) => [group, Math.max(1, ...stops.flatMap((stop) => (['light', 'dark'] as Mode[]).map((mode) => stop.labels[mode][group].length)))])) as Record<RoleGroup, number>;
  return { stops, rowSlots };
}
