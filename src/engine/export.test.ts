import { describe, expect, it } from 'vitest';
import { exportCss, exportDtcg, exportJson } from './export';
import type { GeneratedSystem } from './types';

const sample = {
  config: {
    version: 1,
    anchors: [],
    families: [{ id: 'info', key: 'blue', label: 'Info', hue: 220, chroma: 0.1 }],
    targets: { normalText: 4.5, largeText: 3, ui: 3 },
  },
  primitives: [
    { name: '--kds-key-blue-100', family: 'blue', color: { l: 0.8, c: 0.1, h: 220, css: 'oklch(0.8 0.1 220)' } },
    { name: '--kds-key-blue-200', family: 'blue', color: { l: 0.4, c: 0.1, h: 220, css: 'oklch(0.4 0.1 220)' } },
  ],
  semantics: [{ name: '--kds-bg-info-emphasis-base', light: '--kds-key-blue-200', dark: '--kds-key-blue-100' }],
  checks: [{ pass: false }],
  diagnostics: ['An intentionally infeasible constraint.'],
} as unknown as GeneratedSystem;

const configurablePaletteSample = {
  config: {
    version: 1,
    anchors: [],
    families: [
      { id: 'brand', key: 'brand', label: 'Brand', hue: 29.23, chroma: 0.2178 },
      { id: 'negative', key: 'red', label: 'Negative', hue: 27.47, chroma: 0.2231 },
    ],
    targets: { normalText: 4.5, largeText: 3, ui: 3 },
  },
  primitives: [
    { name: '--kds-key-brand-100', family: 'brand', color: { l: 0.8, c: 0.12, h: 29.23, css: 'oklch(0.8 0.12 29.23)' } },
    { name: '--kds-key-red-100', family: 'red', color: { l: 0.8, c: 0.12, h: 27.47, css: 'oklch(0.8 0.12 27.47)' } },
  ],
  semantics: [
    { name: '--kds-bg-brand-emphasis-base', light: '--kds-key-brand-100', dark: '--kds-key-brand-100' },
    { name: '--kds-bg-negative-emphasis-base', light: '--kds-key-red-100', dark: '--kds-key-red-100' },
  ],
  checks: [],
  diagnostics: [],
} as unknown as GeneratedSystem;

describe('exports', () => {
  it('exports one primitive set and preserves semantic names with light-dark references', () => {
    const css = exportCss(sample);
    expect(css).toContain('--kds-lightness-100: 0.8;');
    expect(css).toContain('--kds-key-blue-100: oklch(var(--kds-lightness-100) var(--kds-chroma-blue-100) var(--kds-hue-blue));');
    expect(css).toContain('--kds-bg-info-emphasis-base: light-dark(var(--kds-key-blue-200), var(--kds-key-blue-100));');
    expect(css).toContain('color-scheme: light dark;');
    expect(css).toContain('[data-mode="light"]');
    expect(css).toContain('[data-mode="dark"]');
    expect(css.match(/--kds-key-blue-100:/g)).toHaveLength(1);
  });

  it('labels the configured scope and keeps validation failures visible in the export', () => {
    expect(exportCss(sample)).toContain('KDS Color System Builder · Info tokens.');
    expect(exportCss(sample)).toContain('1 failed contrast relationship');
    const parsed = JSON.parse(exportJson(sample));
    expect(parsed.config).toEqual(sample.config);
    expect(parsed.validation.checks).toEqual(sample.checks);
    expect(parsed.validation.diagnostics).toEqual(sample.diagnostics);
    expect(parsed.formatVersion).toBe(1);
    expect(parsed.scope).toEqual(['info']);
  });

  it('uses native light-dark without duplicate fallback mappings', () => {
    const css = exportCss(sample);
    expect(css).not.toContain('@supports');
    expect(css).not.toContain('@media');
    expect(css).not.toContain('fallback');
    expect(css.match(/--kds-bg-info-emphasis-base:/g)).toHaveLength(1);
    expect(css).toContain('[data-mode="light"] { color-scheme: light; }');
    expect(css).toContain('[data-mode="dark"] { color-scheme: dark; }');
    expect(css).toContain('[data-mode="auto"] { color-scheme: light dark; }');
    expect(css).toContain('background-color: var(--kds-bg-surface-base);');
    expect(css).toContain('color: var(--kds-fg-base);');
  });

  it('serializes every configured family and palette key', () => {
    const css = exportCss(configurablePaletteSample);
    expect(css).toContain('Brand + Negative');
    expect(css).toContain('--kds-key-brand-100: oklch(var(--kds-lightness-100) var(--kds-chroma-brand-100) var(--kds-hue-brand));');
    expect(css).toContain('--kds-key-red-100: oklch(var(--kds-lightness-100) var(--kds-chroma-red-100) var(--kds-hue-red));');

    const bundle = JSON.parse(exportDtcg(configurablePaletteSample));
    expect(bundle.sets.foundation.sources[0].color.palette.brand['100']).toMatchObject({ $type: 'color' });
    expect(bundle.sets.foundation.sources[0].color.palette.red['100']).toMatchObject({ $type: 'color' });
    expect(bundle.modifiers.mode.contexts.light[0].color.background.brand.emphasis.base.$value).toBe('{color.palette.brand.100}');
    expect(bundle.modifiers.mode.contexts.light[0].color.background.negative.emphasis.base.$value).toBe('{color.palette.red.100}');

    expect(JSON.parse(exportJson(configurablePaletteSample)).scope).toEqual(['brand', 'negative']);
  });
});
