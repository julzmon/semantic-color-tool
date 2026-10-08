import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, it, vi } from 'vitest';
import { configFromReference, parseKdsTokens } from './reference';
import * as generator from './generate';
import { balanceConfiguration } from './balance';
import type { BuilderConfig } from './types';
const defaults = () => configFromReference(parseKdsTokens(readFileSync(new URL('../reference/kds-tokens.css', import.meta.url), 'utf8')));
const fingerprint = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
it('matches the complete published outputs across representative configurations', () => {
  const base = defaults();
  const cases: [BuilderConfig, string][] = [
    [base, '9ef3b1e4cae5754ebc18d54a96eb6adcc3e0d328bcf8f40e45fb6828d2469b71'],
    [{ ...base, families: base.families.map(f => f.id === 'neutral' ? { ...f, hue: 210 } : f) }, '8a0e0dfd08e013c914c20d93afad670096cda80892a8185085ed3139d8dd80b3'],
    [{ ...base, families: base.families.map(f => f.id === 'brand' ? { ...f, hue: 240 } : f) }, '739c7923d2ef44a9118e524c1b6af09508aa227c55191fa77226ca6daef88dc3'],
    [{ ...base, muted: { ...base.muted, distance: { light: 0.07, dark: 0.3 } } }, 'f18a428e217bd36ac32f8590eaa694c8c35b9010321d6cf6c79db9d468fbeedd'],
    [{ ...base, surfaces: { ...base.surfaces, levels: 6 } }, '68ea8a3f60949cb6e281f726f0679cf106ec9d8e7a4f2351253da9009b4c56b6'],
    [{ ...base, emphasis: { ...base.emphasis, selected: true } }, 'ca55eeeeed18819f0dc73b2577356c6cff759974db4fc48995972fa9313b7012'],
    [{ ...base, anchors: [{ family: 'brand', mode: 'light', role: 'emphasis.base', color: '#006b75', locked: true }] }, '6e491989b1d50e6953dda119eb77c7368e2ae1032725bc00166af1afe6e81420'],
    [{ ...base, anchors: [{ family: 'brand', mode: 'light', role: 'emphasis.base', color: 'oklch(0.6 0.4 29)', locked: true }] }, 'f3b65ce8ea261221fd71e864eea80d014c4f0b5e4761d47cfcf2d2b8c0595b5e'],
  ];
  for (const [config, expected] of cases) {
    const before = structuredClone(config);
    expect(fingerprint(generator.generateSystem(config))).toBe(expected);
    expect(fingerprint(generator.generateSystem(config))).toBe(expected);
    expect(config).toEqual(before);
  }
});
it('retains the published accepted settings, ratios and feedback when limiting a value', () => {
  const previous = defaults(), requested = structuredClone(previous);
  requested.muted.distance = { light: 0.055, dark: 0.8 };
  expect(fingerprint(balanceConfiguration(previous, requested))).toBe('0471e193d21bfeac5a63d583ba1ace1b02f548a29b5857e93fdbb9dfa9113d79');
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
