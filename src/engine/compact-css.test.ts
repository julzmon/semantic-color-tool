import { readFileSync } from 'node:fs';
import { parse as parseCss } from 'postcss';
import { converter, formatCss, interpolate } from 'culori';
import { describe, expect, it } from 'vitest';
import { generateSystem } from './generate';
import { configFromReference, parseKdsTokens } from './reference';
import { exportCss, exportDtcg } from './export';
import { contrast, isSrgb, parseLockedColor } from './color';
import { cssTokenModel, tokenPath } from './tokens';
import { previewStyle } from '../ui/presentation';
import type { BuilderConfig, Mode } from './types';

const defaults = configFromReference(parseKdsTokens(readFileSync(new URL('../reference/kds-tokens.css', import.meta.url), 'utf8')));
const oklch = converter('oklch');

function declarations(css: string): Map<string, string> {
  const values = new Map<string, string>();
  parseCss(css).walkRules(rule => {
    if (!rule.selector.includes(':root')) return;
    rule.walkDecls(/^--/, declaration => { values.set(declaration.prop, declaration.value); });
  });
  return values;
}

function argumentsOf(value: string): string[] {
  const result: string[] = [];
  let depth = 0, start = value.indexOf('(') + 1;
  for (let index = start; index < value.length - 1; index++) {
    const char = value[index];
    if (char === '(') depth++;
    if (char === ')') depth--;
    if (char === ',' && depth === 0) { result.push(value.slice(start, index).trim()); start = index + 1; }
  }
  return [...result, value.slice(start, -1).trim()];
}

// Resolve CSS independently with Culori interpolation, rather than the engine mix helper.
function resolve(values: Map<string, string>, name: string, mode: Mode, seen = new Set<string>()): string {
  if (seen.has(name)) throw new Error(`Circular CSS alias: ${name}`);
  seen.add(name);
  let value = values.get(name)?.trim();
  if (!value) throw new Error(`Missing CSS token: ${name}`);
  value = value.replace(/var\((--[a-z0-9-]+)\)/g, (_, dependency: string) => resolve(values, dependency, mode, new Set(seen)));
  if (value.startsWith('light-dark(')) value = argumentsOf(value)[mode === 'light' ? 0 : 1];
  if (value.startsWith('color-mix(')) {
    const [space, first, second] = argumentsOf(value);
    expect(space).toBe('in oklch');
    const input = first.match(/^(.*) ([\deE.+-]+)%$/)!;
    value = formatCss(interpolate([input[1], second], 'oklch')(1 - Number(input[2]) / 100));
  }
  return value;
}

const cases: [string, (config: BuilderConfig) => void][] = [
  ['defaults', () => {}],
  ['selected and reversed dark states', config => { config.emphasis.selected = true; config.emphasis.reverseDarkStates = true; }],
  ['independent muted controls', config => {
    config.muted.distance = { light: 0.07, dark: 0.3 };
    config.muted.borderStrength = { light: 0.05, dark: 0.15 };
    config.muted.chromaScale = { light: 0, dark: 2 };
  }],
  ['custom prefix and six surfaces', config => { config.prefix = 'my-design'; config.surfaces.levels = 6; }],
  ['exact anchor', config => {
    config.anchors = [{ family: 'info', mode: 'light', role: 'emphasis.base', color: 'oklch(0.543219 0.1034567 228.12345)', locked: true }];
  }],
  ['uncertified out-of-gamut anchor', config => {
    config.anchors = [{ family: 'brand', mode: 'light', role: 'emphasis.base', color: 'oklch(0.6 0.4 29)', locked: true }];
  }],
];

describe.each(cases)('compact CSS: %s', (_label, configure) => {
  const config = structuredClone(defaults);
  configure(config);
  const system = generateSystem(config);
  const css = exportCss(system);
  const values = declarations(css);

  it('retains all public roles with referenced component tokens', () => {
    expect([...values.keys()].filter(name => !name.match(new RegExp(`^--${config.prefix}-(emphasis|lightness|chroma|hue)-`))).sort()).toEqual(system.semantics.map(token => token.name).sort());
    expect([...values.keys()].filter(name => name.startsWith(`--${config.prefix}-emphasis-`))).toHaveLength(config.emphasis.selected ? 4 : 3);
    expect(css).not.toContain('transparent');
    expect(css).not.toContain('@property');
    expect(css).not.toContain('oklch(from');
    for (const anchor of config.anchors) expect(css).toContain(anchor.color);
  });

  it('resolves every mode to the same opaque colors as DTCG', () => {
    const bundle = JSON.parse(exportDtcg(system));
    const foundation = bundle.sets.foundation.sources[0];
    for (const mode of ['light', 'dark'] as const) {
      const root = { color: { ...foundation.color, ...bundle.modifiers.mode.contexts[mode][0].color } };
      const dtcgColor = (path: string[]): { components: number[] } => {
        const value = path.reduce((node, key) => node[key], root as any).$value;
        return typeof value === 'string' ? dtcgColor(value.slice(1, -1).split('.')) : value;
      };
      for (const token of system.semantics) {
        const source = dtcgColor(tokenPath(token.name, config.prefix));
        const actual = oklch(resolve(values, token.name, mode));
        expect(actual, `${token.name} (${mode})`).toBeDefined();
        expect(actual!.alpha ?? 1).toBe(1);
        [actual!.l, actual!.c, actual!.h ?? 0].forEach((value, index) => expect(value).toBeCloseTo(source.components[index], 8));
      }
    }
    for (const check of system.checks) {
      const foreground = parseLockedColor(resolve(values, check.foreground, check.mode));
      const background = parseLockedColor(resolve(values, check.background, check.mode));
      const pass = isSrgb(foreground) && isSrgb(background) && contrast(foreground, background) >= check.target;
      expect(pass, check.id).toBe(check.pass);
    }
  });

  it('uses the same semantic declarations in the preview, including custom-prefix aliases', () => {
    const preview = declarations(`:root { ${previewStyle(system)} }`);
    for (const mode of ['light', 'dark'] as const) {
      for (const token of system.semantics) {
        const internalName = token.name.replace(`--${config.prefix}-`, '--kds-');
        expect(resolve(preview, internalName, mode)).toBe(resolve(values, token.name, mode));
      }
    }
  });
});

it('declares every custom property once at the root, with shared components and global settings', () => {
  const system = generateSystem(defaults);
  const css = exportCss(system);
  const model = cssTokenModel(system);
  expect(model.components.length).toBeGreaterThan(0);
  expect(declarations(css).size).toBe(83 + model.components.length);
  const counts = new Map<string, number>();
  parseCss(css).walkRules(rule => {
    rule.walkDecls(/^--/, declaration => {
      expect(rule.selector).toBe(':root');
      counts.set(declaration.prop, (counts.get(declaration.prop) ?? 0) + 1);
    });
  });
  expect([...counts.values()].every(count => count === 1)).toBe(true);
  for (const component of model.components) {
    expect(model.semantics.some(role => role.value.includes(`var(${component.name})`))).toBe(true);
  }
  expect(system.semantics).toHaveLength(80);
});


it('recomputes semantic colors and emphasis recipes from global L/C/H and weight settings', () => {
  const system = generateSystem(defaults);
  const values = declarations(exportCss(system));
  const baseName = '--kds-bg-negative-emphasis-base';
  const dependencies = [...values.get(baseName)!.matchAll(/var\(([^)]+)\)/g)].map(match => match[1]);
  values.set(dependencies[0], '0.6');
  values.set(dependencies[1], '0.05');
  values.set(dependencies[2], '40');
  values.set('--kds-emphasis-active-weight', '100%');
  for (const mode of ['light', 'dark'] as const) {
    for (const name of [baseName, '--kds-bg-negative-emphasis-active']) {
      const actual = oklch(resolve(values, name, mode))!;
      expect(actual.l).toBeCloseTo(0.6, 8);
      expect(actual.c).toBeCloseTo(0.05, 8);
      expect(actual.h).toBeCloseTo(40, 8);
    }
    // The shared lightness position also drives other families' emphasis bases.
    expect(oklch(resolve(values, '--kds-bg-brand-emphasis-base', mode))!.l).toBeCloseTo(0.6, 8);
  }
});

it.each(['both', 'dark'] as const)('keeps an exact %s-mode lock independent of an equal editable color', lockMode => {
  const config = structuredClone(defaults);
  const brand = config.families.find(family => family.id === 'brand')!;
  const info = config.families.find(family => family.id === 'info')!;
  info.hue = brand.hue;
  info.chroma = brand.chroma;
  const source = 'oklch(0.555 0.21779 29.23)';
  config.anchors = [{ family: 'info', mode: lockMode, role: 'emphasis.base', color: source, locked: true }];
  const system = generateSystem(config);
  const values = declarations(exportCss(system));
  expect(values.get('--kds-bg-info-emphasis-base')).toContain(source);
  // A later global hue edit changes Brand, while the locked Info branch stays literal.
  values.set('--kds-hue-brand', '40');
  expect(oklch(resolve(values, '--kds-bg-brand-emphasis-base', 'dark'))!.h).toBeCloseTo(40, 8);
  const modes = lockMode === 'both' ? ['light', 'dark'] as const : ['dark'] as const;
  for (const mode of modes) {
    expect(resolve(values, '--kds-bg-info-emphasis-base', mode)).toBe(source);
  }
});
