import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { configFromReference, parseKdsTokens } from './reference';
import { generateSystem } from './generate';
import { balanceConfiguration } from './balance';
const defaults = () => configFromReference(parseKdsTokens(readFileSync(new URL('../reference/kds-tokens.css', import.meta.url), 'utf8')));
describe('contrast protection', () => {
  it('starts from a passing default and accepts brighter muted fills at a black base', () => {
    const previous = defaults();
    expect(generateSystem(previous).checks.every(c => c.pass)).toBe(true);
    const requested = structuredClone(previous);
    requested.surfaces.dark.l = 0;
    requested.muted.distance = { light: 0.055, dark: 0.5 };
    const result = balanceConfiguration(previous, requested);
    expect(result.system.checks.every(c => c.pass)).toBe(true);
    expect(result.config.surfaces.dark.l).toBe(0);
    expect(result.config.muted.distance).toEqual({ light: 0.055, dark: 0.5 });
    expect(result.config.targets).toEqual(previous.targets);
  });
  it('limits an impossible muted distance instead of accepting failed checks', () => {
    const previous = defaults();
    const requested = structuredClone(previous);
    requested.muted.distance = { light: 0.055, dark: 0.8 };
    expect(generateSystem(requested).checks.some(c => !c.pass)).toBe(true);
    const result = balanceConfiguration(previous, requested);
    expect(result.system.checks.every(c => c.pass)).toBe(true);
    expect((result.config.muted.distance as { dark: number }).dark).toBeLessThan(0.8);
    expect(result.message).toMatch(/limit|adjust/i);
    expect(previous).toEqual(defaults());
  });
  it('rejects impossible exact locks and weaker contrast targets', () => {
    const previous = defaults();
    const requested = structuredClone(previous);
    requested.anchors = [{ family: 'brand', mode: 'both', role: 'foreground.base', color: '#777', locked: true }];
    expect(() => balanceConfiguration(previous, requested)).toThrow(/passing|contrast/i);
    requested.anchors = [];
    requested.targets.normalText = 1;
    expect(() => balanceConfiguration(previous, requested)).toThrow(/4.5/);
  });
  it('adjusts unedited spacing while retaining the requested surface count and targets', () => {
    const previous = defaults();
    previous.surfaces.step = { light: 0.2, dark: 0.035 };
    previous.surfaces.levels = 2;
    const safe = balanceConfiguration(defaults(), previous).config;
    const requested = structuredClone(safe);
    requested.surfaces.levels = 6;
    expect(generateSystem(requested).checks.some(c => !c.pass)).toBe(true);
    const result = balanceConfiguration(safe, requested);
    expect(result.config.surfaces.levels).toBe(6);
    expect(result.system.checks.every(c => c.pass)).toBe(true);
    expect(result.config.targets).toEqual(safe.targets);
    expect(result.config.anchors).toEqual(safe.anchors);
    expect(result.message).toMatch(/tonal step/);
  });
});
