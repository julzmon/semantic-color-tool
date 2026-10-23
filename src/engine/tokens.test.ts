import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import * as tokens from './tokens';
import * as color from './color';
import { generateSystem } from './generate';
import { configFromReference, parseKdsTokens } from './reference';
import { exportCss, exportDtcgFiles, exportDtcg } from './export';

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

describe('verified token preparation', () => {
  it('shares verification across CSS and DTCG and invalidates mutable inputs', () => {
    const system = generateSystem(config);
    const foundation = tokens.tokenFoundation(system);
    const model = tokens.cssTokenModel(system);
    const docs = tokens.dtcgDocuments(system);
    expect(tokens.tokenFoundation(system)).toBe(foundation);
    expect(tokens.dtcgDocuments(system)).toBe(docs);
    expect(tokens.cssTokenModel(system)).toBe(model);
    system.config.targets.normalText += 0.01;
    expect(tokens.tokenFoundation(system)).not.toBe(foundation);
    expect(tokens.dtcgDocuments(system)).not.toBe(docs);
    expect(tokens.cssTokenModel(system)).not.toBe(model);
  });

  it('adopts structured-cloned prepared data without repeating contrast verification', () => {
    const system = generateSystem(config);
    const prepared = tokens.prepareTokens(system);
    const expectedCss = exportCss(system);
    const expectedFiles = exportDtcgFiles(system);
    const clone = structuredClone({ system, prepared });
    const contrast = vi.spyOn(color, 'contrast');
    try {
      expect(tokens.adoptTokens(clone.system, clone.prepared)).toBe(true);
      expect(exportCss(clone.system)).toBe(expectedCss);
      expect(exportDtcgFiles(clone.system)).toEqual(expectedFiles);
      expect(contrast).not.toHaveBeenCalled();
      expect(Object.isFrozen(tokens.cssTokenModel(clone.system).semantics[0])).toBe(true);
      clone.system.config.targets.normalText += 0.01;
      expect(tokens.adoptTokens(clone.system, clone.prepared)).toBe(false);
      tokens.cssTokenModel(clone.system);
      expect(contrast).toHaveBeenCalled();
    } finally { contrast.mockRestore(); }
  });

  it('preserves variant suffixes and hyphenated custom palette family keys', () => {
    expect(tokens.tokenPath('--custom-key-gray-2000-2', 'custom')).toEqual(['color', 'palette', 'gray', '2000-2']);
    expect(tokens.tokenPath('--custom-key-brand-blue-2000-2', 'custom')).toEqual(['color', 'palette', 'brand-blue', '2000-2']);
    const locked = structuredClone(config);
    locked.anchors = [
      { family: 'neutral', mode: 'light', role: 'foreground.base', color: 'oklch(0.2 0.01 200)', locked: true },
      { family: 'neutral', mode: 'dark', role: 'foreground.base', color: 'oklch(0.2 0.02 200)', locked: true },
    ];
    const system = generateSystem(locked);
    const foundation = tokens.dtcgDocuments(system).colors as any;
    const variant = system.primitives.find(p => /\d+-\d+$/.test(p.name))!;
    expect(variant).toBeDefined();
    const suffix = variant.name.replace(`--kds-key-${variant.family}-`, '');
    expect(foundation.color.palette[variant.family][suffix].$type).toBe('color');
  });
});

it('protects cached verification from mutations without freezing the mutable input system', () => {
  const system = generateSystem(config);
  const foundation = tokens.tokenFoundation(system);
  const documents = tokens.dtcgDocuments(system);
  const originalCss = exportCss(system);
  const originalFiles = exportDtcgFiles(system);
  expect(() => { foundation.palette[0].primitive.color.l = 0; }).toThrow(TypeError);
  expect(() => { foundation.lightness[foundation.palette[0].lightness] = 0; }).toThrow(TypeError);
  expect(() => { (documents.colors as any).color.palette.gray = {}; }).toThrow(TypeError);
  expect(exportCss(system)).toBe(originalCss);
  expect(exportDtcgFiles(system)).toEqual(originalFiles);
  expect(Object.isFrozen(system.primitives[0].color)).toBe(false);
  system.primitives[0].usages.push('external API mutation');
  expect(tokens.tokenFoundation(system)).not.toBe(foundation);
  expect(tokens.dtcgDocuments(system)).not.toBe(documents);
});

it('owns the adopted foundation without freezing structured-cloned public system references', () => {
  const system = generateSystem(config);
  const clone = structuredClone({ system, prepared: tokens.prepareTokens(system) });
  expect(tokens.adoptTokens(clone.system, clone.prepared)).toBe(true);
  const foundation = tokens.tokenFoundation(clone.system);
  expect(() => { foundation.palette[0].primitive.color.l = 0; }).toThrow(TypeError);
  expect(Object.isFrozen(clone.system.primitives[0].color)).toBe(false);
  clone.system.primitives[0].usages.push('still mutable');
  expect(tokens.tokenFoundation(clone.system)).not.toBe(foundation);
});
