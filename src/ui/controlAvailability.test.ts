import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { configFromReference, parseKdsTokens } from '../engine/reference';
import { balanceConfiguration } from '../engine/balance';
import { controlDescriptor, controlLimits, controlSamples, probeControlValue, setControlValue } from './controlAvailability';
const defaults = () => configFromReference(parseKdsTokens(readFileSync(new URL('../reference/kds-tokens.css', import.meta.url), 'utf8')));
it('maps displayed units and updates one control without mutating source settings', () => {
  const config = defaults(); const before = structuredClone(config);
  expect(controlDescriptor(config, 'muted.dark.chroma').value).toBe(100);
  expect(setControlValue(config, 'muted.dark.chroma', 150).muted.chromaScale!.dark).toBe(1.5);
  expect(setControlValue(config, 'emphasis.hover', 12).emphasis.mixWeights!.hover).toBe(.88);
  expect(setControlValue(config, 'muted.light.border', 50).muted.borderStrength!.light).toBe(.15);
  expect(config).toEqual(before);
});
it('probes endpoints and current values without a coarse sample grid', () => {
  const config = defaults(); config.surfaces.light.l = .973251;
  expect(controlSamples(controlDescriptor(config, 'surfaces.light.l'))).toEqual([.973251, 0, 1]);
  expect(controlSamples(controlDescriptor(config, 'surfaces.levels'))).toEqual([1, 2, 3, 4, 5, 6]);
});
it('uses only complete current reports to derive bounded limits', () => {
  const descriptor = controlDescriptor(defaults(), 'surfaces.light.l');
  const samples = [{ value: 0, acceptedValue: .8, safe: true, failedChecks: 0 }, { value: 1, acceptedValue: .95, safe: true, failedChecks: 0 }];
  expect(controlLimits({ descriptor, samples, status: 'checking' })).toBeUndefined();
  expect(controlLimits({ descriptor, samples, status: 'ready' })).toEqual({ min: .8, max: Math.min(descriptor.max, descriptor.value) });
  expect(controlLimits({ descriptor, samples: [{ value: 0, safe: false, failedChecks: 1 }], status: 'ready' })).toBeUndefined();
});
it('verifies full contrast for every reported safe value and honors lock changes', () => {
  const config = defaults(); const key = 'surfaces.light.l';
  for (const value of [.2, .9, 1]) {
    const result = probeControlValue(config, key, value);
    const balanced = balanceConfiguration(config, setControlValue(config, key, value));
    const generated = balanced.system;
    expect(result.acceptedValue).toBe(controlDescriptor(balanced.config, key).value);
    expect(result.safe).toBe(generated.checks.every(c => c.pass));
    expect(result.failedChecks).toBe(generated.checks.filter(c => !c.pass).length);
  }
  config.anchors = [{ family: 'brand', mode: 'light', role: 'foreground.base', color: '#ffffff', locked: true }];
  expect(probeControlValue(config, key, 1).safe).toBe(false);
});
it('keeps decorative border-strength values available without introducing boundary targets', () => {
  const config = defaults();
  expect([0, 50, 100].map(value => probeControlValue(config, 'muted.dark.border', value).safe)).toEqual([true,true,true]);
});
it('edits muted state strengths independently of emphasis and converts legacy spacing on first edit', () => {
  const config = defaults(); const before = structuredClone(config);
  const next = setControlValue(config, 'muted.active', 12);
  expect((next.muted as any).mixWeights.active).toBe(.88);
  expect(next.emphasis).toEqual(config.emphasis);
  expect(controlDescriptor(next, 'muted.active').value).toBe(12);
  expect(config).toEqual(before);
});
