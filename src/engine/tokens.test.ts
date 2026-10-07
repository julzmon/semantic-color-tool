import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { generateSystem } from './generate';
import { configFromReference, parseKdsTokens } from './reference';
import { exportDtcgFiles, exportDtcg } from './export';

const config = configFromReference(parseKdsTokens(readFileSync(new URL('../reference/kds-tokens.css', import.meta.url), 'utf8')));

const at = (root: any, path: string[]) => path.reduce((value, key) => value[key], root);
function resolve(root: any, value: any): any {
  if (typeof value === 'string' && value.startsWith('{')) return resolve(root, at(root, value.slice(1, -1).split('.')).$value);
  if (value && typeof value === 'object' && '$ref' in value) return resolve(root, at(root, value.$ref.slice(2).split('/')));
  if (Array.isArray(value)) return value.map((entry) => resolve(root, entry));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, resolve(root, entry)]));
  return value;
}

describe('DTCG 2025.10 exports', () => {
  it('exports foundation components and mode aliases that resolve to the generated colors', () => {
    const system = generateSystem(config);
    const files = exportDtcgFiles(system);
    const foundation = JSON.parse(files['foundation/colors.tokens.json']);
    for (const primitive of system.primitives) {
      const suffix = primitive.name.replace(`--kds-key-${primitive.family}-`, '');
      const token = foundation.color.palette[primitive.family][suffix];
      expect(token.$type).toBe('color');
      expect(token.$value.components.every((component: any) => '$ref' in component)).toBe(true);
      const color = resolve(foundation, token.$value);
      expect(color.colorSpace).toBe('oklch');
      expect(color.alpha).toBe(1);
      [primitive.color.l, primitive.color.c, primitive.color.h].forEach((value, i) => expect(Math.abs(color.components[i] - value)).toBeLessThanOrEqual([0.00005, 0.000011, 0.0051][i]));
    }
    for (const mode of ['light', 'dark'] as const) {
      const semantic = JSON.parse(files[`semantic/${mode}.tokens.json`]);
      const root = { color: { ...foundation.color, ...semantic.color } };
      for (const group of Object.values(system.modes[mode].families)) {
        const token = root.color.foreground[group.id].base;
        const color = resolve(root, token.$value);
        expect(color.components[0]).toBeCloseTo(group.roles['foreground.base']!.color.l, 4);
      }
      expect(resolve(root, root.color.foreground.link.base.$value)).toEqual(resolve(root, root.color.foreground.info.base.$value));
    }
  });

  it('provides external file and self-contained resolver forms with both contexts', () => {
    const system = generateSystem(config);
    const files = exportDtcgFiles(system);
    const resolver = JSON.parse(files['kds.resolver.json']);
    expect(resolver.version).toBe('2025.10');
    expect(resolver.modifiers.mode.default).toBe('light');
    for (const mode of ['light', 'dark']) expect(files[resolver.modifiers.mode.contexts[mode][0].$ref]).toBeDefined();
    expect(files[resolver.sets.foundation.sources[0].$ref]).toBeDefined();
    const bundle = JSON.parse(exportDtcg(system));
    expect(bundle.sets.foundation.sources[0].color.palette).toBeDefined();
    expect(bundle.modifiers.mode.contexts.dark[0].color.foreground).toBeDefined();
    expect(exportDtcg(system)).not.toContain('light-dark(');
    expect(exportDtcg(system)).not.toContain('"config"');
  });
});
