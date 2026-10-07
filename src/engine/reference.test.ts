import { readFileSync } from 'node:fs';
import { converter } from 'culori';
import { describe, expect, it } from 'vitest';
import { configFromReference, parseKdsTokens } from './reference';

const source = readFileSync(new URL('../reference/kds-tokens.css', import.meta.url), 'utf8');

describe('KDS reference import', () => {
  it('imports the original numeric palette without treating logo aliases as primitives', () => {
    const reference = parseKdsTokens(source);
    expect(Object.keys(reference.primitives)).toHaveLength(60);
    expect(reference.primitives['--kds-key-blue-700']).toBe('#0080a7');
    expect(reference.primitives).not.toHaveProperty('--kds-key-logo-red');
    expect(reference.resolved.light['--kds-key-logo-red']).toBe('#ff5353');
    expect(reference.warnings).toEqual([]);
  });

  it('preserves semantic names and aliases while resolving their actual colors', () => {
    const reference = parseKdsTokens(source);
    expect(Object.keys(reference.semantics.light)).toHaveLength(96);
    expect(reference.semantics.light['--kds-fg-info-base']).toBe('var(--kds-key-blue-800)');
    expect(reference.resolved.light['--kds-fg-info-base']).toBe('#006d8f');
    expect(reference.semantics.light).toHaveProperty('--kds-border-info-muted-hover');
    expect(reference.semantics.light).not.toHaveProperty('--kds-border-width-xs');
    expect(reference.resolved.light).not.toHaveProperty('--kds-font-size-xs');
  });

  it('inherits emphasis states and on-emphasis foreground into the partial dark theme', () => {
    const reference = parseKdsTokens(source);
    expect(reference.semantics.dark['--kds-bg-info-emphasis-base']).toBe('var(--kds-key-blue-700)');
    expect(reference.resolved.dark['--kds-bg-info-emphasis-base']).toBe('#0080a7');
    expect(reference.resolved.dark['--kds-bg-info-emphasis-active']).toBe('#00455d');
    expect(reference.resolved.dark['--kds-fg-on-emphasis']).toBe('rgba(255, 255, 255)');
    expect(reference.resolved.dark['--kds-bg-info-emphasis-selected']).toBe('#006d8f');
    expect(reference.resolved.dark['--kds-fg-info-base']).toBe('#14aadd');
  });

  it('resolves alias chains and preserves the source backdrop alpha regardless of the token name', () => {
    const reference = parseKdsTokens(source);
    expect(reference.resolved.dark['--kds-bg-surface-backdrop']).toBe('rgba(255, 255, 255, 0.2)');
    const chain = parseKdsTokens(':root { --kds-color-white: #fff; --alias: var(--kds-color-white); --kds-fg-base: var(--alias); }');
    expect(chain.resolved.light['--kds-fg-base']).toBe('#fff');
  });

  it('reports unresolved variables and cycles without inventing color values', () => {
    const reference = parseKdsTokens(`:root {
      --kds-fg-base: var(--missing);
      --kds-bg-info-muted-base: var(--cycle-a);
      --cycle-a: var(--cycle-b); --cycle-b: var(--cycle-a);
    }`);
    expect(reference.resolved.light).not.toHaveProperty('--kds-fg-base');
    expect(reference.resolved.dark).not.toHaveProperty('--kds-bg-info-muted-base');
    expect(reference.warnings.some((warning) => /missing/.test(warning))).toBe(true);
    expect(reference.warnings.some((warning) => /cycle/i.test(warning))).toBe(true);
  });

  it('reports and skips unsupported selectors and conditional theme structures', () => {
    const reference = parseKdsTokens(`
      :root { --kds-key-blue-700: #0080a7; }
      .widget { --kds-key-blue-700: #ffffff; }
      @media (prefers-color-scheme: dark) { :root { --kds-key-blue-700: #000000; } }
    `);
    expect(reference.primitives['--kds-key-blue-700']).toBe('#0080a7');
    expect(reference.warnings.some((warning) => warning.includes('.widget'))).toBe(true);
    expect(reference.warnings.some((warning) => warning.includes('@media'))).toBe(true);
  });

  it('rejects malformed CSS with an actionable import error', () => {
    expect(() => parseKdsTokens(':root { --kds-fg-base: #fff;')).toThrow(/KDS token CSS.*line|KDS token CSS.*Unclosed/i);
  });
});

describe('configuration from KDS reference', () => {
  it('uses source surface lightness and six semantic-family defaults', () => {
    const config = configFromReference(parseKdsTokens(source));
    expect(config.version).toBe(2);
    expect(config.surfaces.light.l).toBeCloseTo(1, 7);
    expect(config.surfaces.dark.l).toBeCloseTo(converter('oklch')('#151617')!.l, 7);
    expect(Object.keys(config.surfaces.dark)).toEqual(['l']);
    expect(config.surfaces).toMatchObject({ levels: 3, step: { light: 0.035, dark: 0.1 } });
    expect(config.families.map(({ id, key }) => ({ id, key }))).toEqual([
      { id: 'neutral', key: 'gray' },
      { id: 'brand', key: 'brand' },
      { id: 'info', key: 'blue' },
      { id: 'positive', key: 'green' },
      { id: 'negative', key: 'red' },
      { id: 'warning', key: 'yellow' },
    ]);
    const expectedSeeds = {
      neutral: '#717778',
      brand: '#cc0000',
      info: '#0080a7',
      positive: '#41852f',
      negative: '#e52626',
      warning: '#807800',
    } as const;
    for (const [id, css] of Object.entries(expectedSeeds)) {
      const expected = converter('oklch')(css)!;
      const family = config.families.find((item) => item.id === id)!;
      expect(family.hue).toBeCloseTo(expected.h ?? 0, 8);
      expect(family.chroma).toBeCloseTo(expected.c, 8);
    }
    expect(config.muted).toEqual({ distance: { light: 0.055, dark: 0.16 }, separation: 0.025 });
    expect(config.emphasis).toEqual({ separation: 0.045, selected: false, strategy: 'shared' });
    expect(config.targets).toEqual({ normalText: 4.5, largeText: 3, ui: 3 });
    expect(config.anchors).toEqual([]);
  });

  it.each([
    ['light', '--kds-bg-surface-base'],
    ['dark', '--kds-bg-surface-base'],
    ['light', '--kds-key-gray-700'],
    ['light', '--kds-key-red-800'],
    ['light', '--kds-key-blue-700'],
    ['light', '--kds-key-green-700'],
    ['light', '--kds-key-red-700'],
    ['light', '--kds-key-yellow-700'],
  ] as const)('rejects a missing essential %s value %s', (mode, name) => {
    const reference = parseKdsTokens(source);
    delete reference.resolved[mode][name];
    expect(() => configFromReference(reference)).toThrow(new RegExp(`${mode}.*${name}`));
  });

  it.each(['not-a-color', 'rgba(255, 255, 255, 0.2)'])('rejects unusable source surface color %s', (value) => {
    const reference = parseKdsTokens(source);
    reference.resolved.light['--kds-bg-surface-base'] = value;
    expect(() => configFromReference(reference)).toThrow(/light.*--kds-bg-surface-base/);
  });
});
