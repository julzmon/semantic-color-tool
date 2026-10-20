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
const fingerprint = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
// Reviewed against the pre-sharing engine: modes, checks, primitives and semantics
// are unchanged. Hashes include the explicit standard strategy and bounded-search/hierarchy diagnostics.
it('matches the reviewed outputs across representative configurations', () => {
  const base = defaults();
  const cases: [BuilderConfig, string][] = [
    [base, '6f73460809d70118672c6f07877f2efd49edc052d0f3e8d9d2d532a246fae4be'],
    [{ ...base, families: base.families.map(f => f.id === 'neutral' ? { ...f, hue: 210 } : f) }, '2e1b0d8e9fe5cf76f6acb7f7bf7bb419f3b285e9c7d946116d2fa85c9e3b3a5a'],
    [{ ...base, families: base.families.map(f => f.id === 'brand' ? { ...f, hue: 240 } : f) }, '865d1ae7115355c691c4c5f4f873b27d54066e7c832cf3d7e49f0728d4f98d19'],
    [{ ...base, muted: { ...base.muted, distance: { light: 0.07, dark: 0.3 } } }, '9c5c123071c1bc11cf340ed1b6361a509a6009cb9723b985c5cbff2264f8df1b'],
    [{ ...base, surfaces: { ...base.surfaces, levels: 6 } }, 'f62d35402900ed6c6d749f27132163aa8bf2c8ac9457277e61c69cdae73153ad'],
    [{ ...base, emphasis: { ...base.emphasis, selected: true } }, '3b1277187e438b6f359c0b8f3645aa9ac3555e9cfb7cd19daedcfedfc55271b7'],
    [{ ...base, anchors: [{ family: 'brand', mode: 'light', role: 'emphasis.base', color: '#006b75', locked: true }] }, '74b0a09e2e11254a953abc591bdf1c86d8abdddceba5db45bf773a734f212f7a'],
    [{ ...base, anchors: [{ family: 'brand', mode: 'light', role: 'emphasis.base', color: 'oklch(0.6 0.4 29)', locked: true }] }, 'e6fe683a065be3e4e4b5785cc5ef00d9cc4d0440dba615305a71a776500f6bfc'],
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
  expect(fingerprint(balanceConfiguration(previous, requested))).toBe('06e0b866c2185f21323d85ce7835c265b1cc2653130e293d5100db4675487827');
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
