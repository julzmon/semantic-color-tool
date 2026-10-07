import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { generateSystem } from './generate';
import { configFromReference, parseKdsTokens } from './reference';
import { exportCss } from './export';
import { tokenFoundation } from './tokens';
import { contrast, toColor } from './color';
import type { GeneratedSystem } from './types';

it('emits shorter coordinates with passing contrast and one shared family hue', () => {
  const config = configFromReference(parseKdsTokens(readFileSync(new URL('../reference/kds-tokens.css', import.meta.url), 'utf8')));
  const system = generateSystem(config);
  expect(system.checks.every((check) => check.pass)).toBe(true);
  expect(exportCss(system)).toContain('--kds-hue-gray: 208.77;');
  expect(exportCss(system)).not.toMatch(/--kds-hue-gray-\d+:/);
  const foundation = tokenFoundation(system);
  expect(Object.values(foundation.chroma).filter((value) => value.toString().length <= 7).length).toBeGreaterThan(system.primitives.length / 2);
});

it('retains the extra digit that keeps a borderline foreground passing', () => {
  const foreground = toColor({ l: 0.56808, c: 0, h: 0 });
  const background = toColor('#fff');
  expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(toColor({ l: 0.5681, c: 0, h: 0 }), background)).toBeLessThan(4.5);
  const system = {
    config: { families: [{ key: 'gray', hue: 0 }] },
    primitives: [
      { name: '--kds-key-gray-100', family: 'gray', color: background },
      { name: '--kds-key-gray-200', family: 'gray', color: foreground },
    ],
    semantics: [],
    checks: [{ mode: 'light', foreground: '--kds-key-gray-200', background: '--kds-key-gray-100', target: 4.5, pass: true }],
  } as unknown as GeneratedSystem;
  expect(tokenFoundation(system).lightness['200']).toBe(0.56808);
});

it('retains exact anchor components and CSS source', () => {
  const config = configFromReference(parseKdsTokens(readFileSync(new URL('../reference/kds-tokens.css', import.meta.url), 'utf8')));
  config.anchors = [{ family: 'info', mode: 'light', role: 'emphasis.base', color: 'oklch(0.543219 0.1034567 228.12345)', locked: true }];
  const system = generateSystem(config);
  const foundation = tokenFoundation(system);
  const item = foundation.palette.find((item) => item.primitive.color.source)!;
  expect(foundation.lightness[item.lightness]).toBe(item.primitive.color.l);
  expect(foundation.chroma[item.chroma]).toBe(item.primitive.color.c);
  expect(foundation.hue[item.hue]).toBe(item.primitive.color.h);
  expect(exportCss(system)).toContain(config.anchors[0].color);
});
