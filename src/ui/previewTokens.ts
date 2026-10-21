import type { FamilyId, FamilyRole, GeneratedRole, GeneratedSystem, Mode, State } from '../engine/types';

export type PreviewSection = 'surfaces' | 'fills' | 'relationships';
export type PreviewToken = {
  role: GeneratedRole;
  label: string;
  section: PreviewSection;
  kind: 'surface' | 'text' | 'muted' | 'emphasis' | 'foreground' | 'border-muted' | 'border-emphasis' | 'link';
  family?: FamilyId;
  state?: State;
  anchor?: 'locked' | 'preferred';
};
export const previewSections = [
  { id: 'surfaces', label: 'Surfaces & text' },
  { id: 'fills', label: 'Families & states' },
  { id: 'relationships', label: 'Foregrounds & borders' },
] as const;
export const previewStates = [
  { id: 'base', label: 'Base' }, { id: 'hover', label: 'Hover' },
  { id: 'active', label: 'Pressed' }, { id: 'selected', label: 'Selected' },
] as const;

/** Each demonstration uses an actual generated role; aliases retain their public name. */
export function previewTokens(system: GeneratedSystem, mode: Mode): PreviewToken[] {
  const theme = system.modes[mode];
  const tokens: PreviewToken[] = theme.surfaces.map((role, index) => ({
    role, label: index ? `Level ${index}` : 'Base surface', section: 'surfaces', kind: 'surface',
  }));
  for (const [key, label] of [['base', 'Primary text'], ['muted', 'Secondary text'], ['onEmphasis', 'Text on emphasis']] as const) {
    tokens.push({ role: theme.foreground[key], label, section: 'surfaces', kind: 'text' });
  }
  for (const family of system.config.families) {
    for (const [path, role] of Object.entries(theme.families[family.id].roles) as [FamilyRole, GeneratedRole][]) {
      const state = path.split('.').at(-1) as State;
      const group = path.startsWith('border.') ? path.split('.').slice(0, 2).join('-') : path.split('.')[0];
      const anchor = system.config.anchors.find(item => item.family === family.id && item.role === path && (item.mode === 'both' || item.mode === mode));
      tokens.push({ role, family: family.id, state,
        label: `${family.label} ${group.replace('-', ' ')} ${previewStates.find(item => item.id === state)?.label ?? state}`,
        section: group === 'muted' || group === 'emphasis' ? 'fills' : 'relationships',
        kind: group as PreviewToken['kind'], ...(anchor ? { anchor: anchor.locked ? 'locked' : 'preferred' } : {}),
      });
    }
  }
  for (const state of ['base', 'hover'] as const) {
    const semantic = `--${system.config.prefix}-fg-link-${state}`;
    if (system.semantics.some(token => token.name === semantic)) {
      const source = theme.families.info.roles[`foreground.${state}`]!;
      tokens.push({ role: { ...source, semantic, sharedWith: [source.semantic, ...source.sharedWith.filter(name => name !== semantic)] },
        label: `Link ${state === 'base' ? 'Base' : 'Hover'}`, state, kind: 'link', section: 'relationships' });
    }
  }
  return tokens;
}

export function resolvePreviewToken(system: GeneratedSystem, mode: Mode, semantic: string): PreviewToken | undefined {
  return previewTokens(system, mode).find(token => token.role.semantic === semantic);
}
