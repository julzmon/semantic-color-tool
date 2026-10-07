import type { CSSProperties } from 'react';
import { contrast } from '../engine/color';
import type { ColorValue, FamilyRole, GeneratedSystem } from '../engine/types';

export const roleRows: { role: FamilyRole; label: string; group: string }[] = [
  { role: 'muted.base', label: 'Base', group: 'Muted background' },
  { role: 'muted.hover', label: 'Hover', group: 'Muted background' },
  { role: 'muted.active', label: 'Active', group: 'Muted background' },
  { role: 'muted.selected', label: 'Selected', group: 'Muted background' },
  { role: 'emphasis.base', label: 'Base', group: 'Emphasis background' },
  { role: 'emphasis.hover', label: 'Hover', group: 'Emphasis background' },
  { role: 'emphasis.active', label: 'Active', group: 'Emphasis background' },
  { role: 'emphasis.selected', label: 'Selected', group: 'Emphasis background' },
  { role: 'foreground.base', label: 'Base', group: 'Foreground' },
  { role: 'foreground.hover', label: 'Hover', group: 'Foreground' },
  { role: 'border.muted.base', label: 'Base', group: 'Muted border' },
  { role: 'border.muted.hover', label: 'Hover', group: 'Muted border' },
  { role: 'border.emphasis.base', label: 'Base', group: 'Emphasis border' },
  { role: 'border.emphasis.hover', label: 'Hover', group: 'Emphasis border' },
];
export const shortToken = (name: string) => name.replace(/^--[a-z][a-z0-9-]*-/, '');
export const tokenLabel = (name: string) => shortToken(name).replaceAll('-', ' ');
export const inkFor = (color: ColorValue | string) => contrast(color, '#ffffff') >= contrast(color, '#000000') ? '#ffffff' : '#000000';

/** Keep light-dark expressions unregistered so nested schemes can resolve them. */
export function previewStyle(system: GeneratedSystem): CSSProperties {
  const entries = [
    ...system.primitives.map((item) => [item.name, item.color.css]),
    ...system.semantics.map((item) => [item.name, `light-dark(var(${item.light}), var(${item.dark}))`]),
  ];
  // Preview CSS intentionally uses a stable internal namespace; exports retain the configured one.
  if (system.config.prefix !== 'kds') entries.push(...entries.map(([name, value]) => [String(name).replace(`--${system.config.prefix}-`, '--kds-'), value]));
  return Object.fromEntries(entries) as CSSProperties;
}
