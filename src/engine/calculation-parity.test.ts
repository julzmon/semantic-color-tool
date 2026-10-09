import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, it, vi } from 'vitest';
import { configFromReference, parseKdsTokens } from './reference';
import * as generator from './generate';
import { balanceConfiguration } from './balance';
import type { BuilderConfig } from './types';
const defaults = () => configFromReference(parseKdsTokens(readFileSync(new URL('../reference/kds-tokens.css', import.meta.url), 'utf8')));
const fingerprint = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
// Reviewed after Text Base cross-theme reuse; other role colors and check results
// retain their published values. Primitive aliases and Text Base ratios may change.
it('matches the reviewed outputs across representative configurations', () => {
  const base = defaults();
  const cases: [BuilderConfig, string][] = [
    [base, '363d462f13665e20e09e42f858a4f7a54169b24d858b4c4a146a42c951738dde'],
    [{ ...base, families: base.families.map(f => f.id === 'neutral' ? { ...f, hue: 210 } : f) }, '63423e1c7a1494fc50a01b4a67e6a72bdefe30de8a506a599a14213d5347bc9f'],
    [{ ...base, families: base.families.map(f => f.id === 'brand' ? { ...f, hue: 240 } : f) }, 'a4295d11b7c51de7335b679b92574de927218ed4378ced3966d1b4f225d79b08'],
    [{ ...base, muted: { ...base.muted, distance: { light: 0.07, dark: 0.3 } } }, '4e5e27ea5a4c36861d6fe1c0b97ec36b0022ed46ba41b5bd8267c552773f6b0d'],
    [{ ...base, surfaces: { ...base.surfaces, levels: 6 } }, 'bfac5aeedded216c2e08a6a539863f338a8c72dcbf8184a11bf7d52e9fb2b5cf'],
    [{ ...base, emphasis: { ...base.emphasis, selected: true } }, '47090b7cb98c6441d8fa7a9bc2eeb421c8f9a0efd0a679937b2cb7347c51bbf0'],
    [{ ...base, anchors: [{ family: 'brand', mode: 'light', role: 'emphasis.base', color: '#006b75', locked: true }] }, '3f29d5cc4937f3e1fb8b16489068092f6065e78a79e1aa40acf2a549a0840cd4'],
    [{ ...base, anchors: [{ family: 'brand', mode: 'light', role: 'emphasis.base', color: 'oklch(0.6 0.4 29)', locked: true }] }, '9eccb0b3aca1eeff83a1654a161b1a1250dfd3ca2f9c8af4b6419984b6aab076'],
  ];
  for (const [config, expected] of cases) {
    const before = structuredClone(config);
    expect(fingerprint(generator.generateSystem(config))).toBe(expected);
    expect(fingerprint(generator.generateSystem(config))).toBe(expected);
    expect(config).toEqual(before);
  }
});
it('retains the reviewed accepted settings, ratios and feedback when limiting a value', () => {
  const previous = defaults(), requested = structuredClone(previous);
  requested.muted.distance = { light: 0.055, dark: 0.8 };
  expect(fingerprint(balanceConfiguration(previous, requested))).toBe('0ea2c41ef273553cea14e8804d59589cfdccb6030f76013b49c695d8c75ab530');
});
it('does not generate an identical candidate twice within one balance request', () => {
  const previous = defaults(), requested = structuredClone(previous);
  requested.muted.distance = { light: 0.055, dark: 0.8 };
  const seen: string[] = [];
  const generate = generator.generateSystem;
  const spy = vi.spyOn(generator, 'generateSystem').mockImplementation(config => {
    seen.push(JSON.stringify(config));
    return generate(config);
  });
  try {
    balanceConfiguration(previous, requested);
    expect(seen.length).toBeGreaterThan(1);
    expect(new Set(seen).size).toBe(seen.length);
  } finally { spy.mockRestore(); }
});
