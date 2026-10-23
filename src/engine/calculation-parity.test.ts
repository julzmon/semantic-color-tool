import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, it, vi } from 'vitest';
import { configFromReference, parseKdsTokens } from './reference';
import * as generator from './generate';
import { balanceConfiguration } from './balance';
import type { BuilderConfig } from './types';
// These fingerprints preserve the legacy engine contract; mixing has independent invariant tests.
const defaults = () => {
  const config = configFromReference(parseKdsTokens(readFileSync(new URL('../reference/kds-tokens.css', import.meta.url), 'utf8')));
  delete config.emphasis.mixWeights;
  return config;
};
// libm/V8 can differ in the last numeric bits across ARM and x64. Keep CSS,
// exact sources, ordering and pass/fail decisions byte-exact; normalize numbers only.
const fingerprint = (value: unknown) => createHash('sha256').update(JSON.stringify(value,
  (_key, item) => typeof item === 'number' ? Number(item.toPrecision(12)) : item)).digest('hex');
it('ignores machine-level numeric roundoff while retaining meaningful values and exact sources', () => {
  expect(fingerprint({ ratio: 4.500000000000001 })).toBe(fingerprint({ ratio: 4.5 }));
  expect(fingerprint({ ratio: 4.500000001 })).not.toBe(fingerprint({ ratio: 4.5 }));
  expect(fingerprint({ source: 'oklch(0.500000000000001 0 0)' })).not.toBe(fingerprint({ source: 'oklch(0.5 0 0)' }));
  expect(fingerprint({ pass: true })).not.toBe(fingerprint({ pass: false }));
});
// Reviewed against the pre-sharing engine: modes, checks, primitives and semantics
// are unchanged. Hashes include the explicit standard strategy and bounded-search/hierarchy diagnostics.
it('matches the reviewed outputs across representative configurations', () => {
  const base = defaults();
  const cases: [BuilderConfig, string][] = [
    [base, '6f8bc6eee8c322f109c6857989ec841a38adf239ee11c9eb2f43dcd2b7201550'],
    [{ ...base, families: base.families.map(f => f.id === 'neutral' ? { ...f, hue: 210 } : f) }, 'a59ae40713f27708ad1f569c8055db0bda227d559b37d6d0ce925079216086c8'],
    [{ ...base, families: base.families.map(f => f.id === 'brand' ? { ...f, hue: 240 } : f) }, '7914258d4a6d41b660cdfb1acbf62e9da9eaa116cb7147844e0b4d274cc4d002'],
    [{ ...base, muted: { ...base.muted, distance: { light: 0.07, dark: 0.3 } } }, '849a82bf5bc26d862093bb5294e02848eb5c4420c8c9d00da5da59b87150d7b1'],
    [{ ...base, surfaces: { ...base.surfaces, levels: 6 } }, '9d1ccadd2a833dc6f83ae4258405f89abe48bff0d90acdf21432d90e5d3aa21a'],
    [{ ...base, emphasis: { ...base.emphasis, selected: true } }, '79e9ad429d93483ba4cb71fea205fccbfd480d848388cc530e56fa5a5970a67e'],
    [{ ...base, anchors: [{ family: 'brand', mode: 'light', role: 'emphasis.base', color: '#006b75', locked: true }] }, '503ea6bdf91d55e8cfb24478224401311d523a4df47fbdd49cbc527f53500a31'],
    [{ ...base, anchors: [{ family: 'brand', mode: 'light', role: 'emphasis.base', color: 'oklch(0.6 0.4 29)', locked: true }] }, '4ded6b545658faa9281bccbfae49b8a2338724e1322e65f0633cd8da6ac00483'],
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
  expect(fingerprint(balanceConfiguration(previous, requested))).toBe('d2380478c0ec3d44a01c26f597f8312dc42681a5512580381c7c76fec6c8d201');
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
