import { contrast } from '../engine/color';
import { cssTokenModel } from '../engine/tokens';
import type { ColorValue, GeneratedSystem } from '../engine/types';

export const shortToken = (name: string) => name.replace(/^--[a-z][a-z0-9-]*-/, '');
export const inkFor = (color: ColorValue | string) => contrast(color, '#ffffff') >= contrast(color, '#000000') ? '#ffffff' : '#000000';

/** Keep light-dark expressions unregistered so nested schemes can resolve them. */
export function previewStyle(system: GeneratedSystem): string {
  const model = cssTokenModel(system);
  const entries = [...model.components, ...model.settings, ...model.semantics].map(item => [item.name, item.value]);
  // Preview CSS intentionally uses a stable internal namespace; exports retain the configured one.
  if (system.config.prefix !== 'kds') entries.push(...entries.map(([name, value]) => [
    name.replace(`--${system.config.prefix}-`, '--kds-'),
    value.replaceAll(`--${system.config.prefix}-`, '--kds-'),
  ]));
  return Object.entries(Object.fromEntries(entries)).map(([name, value]) => `${name}: ${value}`).join('; ');
}
