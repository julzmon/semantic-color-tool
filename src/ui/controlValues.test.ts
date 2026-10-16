import { describe, expect, it } from 'vitest';
import { normalizeNumericControl, adjustedControlKeys, setEmphasisWeight } from './controlValues';
import type { BuilderConfig } from '../engine/types';
describe('precise controls', () => {
  it('keeps the edited emphasis strength and orders its neighbors', () => {
    const weights = { hover: 0.92, active: 0.85, selected: 0.8 };
    expect(setEmphasisWeight(weights, 'hover', 0.7)).toEqual({ hover: 0.7, active: 0.7, selected: 0.7 });
    expect(setEmphasisWeight(weights, 'active', 0.95)).toEqual({ hover: 0.95, active: 0.95, selected: 0.8 });
    expect(setEmphasisWeight(weights, 'selected', 0.99)).toEqual({ hover: 0.99, active: 0.99, selected: 0.99 });
    expect(weights).toEqual({ hover: 0.92, active: 0.85, selected: 0.8 });
  });
  it('clamps and snaps decimal entries without floating point drift', () => {
    expect(normalizeNumericControl(0.0046, 0.001, 0.2, 0.001)).toBe(0.005);
    expect(normalizeNumericControl(-2, 0, 1, 0.001)).toBe(0);
    expect(normalizeNumericControl(9, -0.08, 0.5, 0.005)).toBe(0.5);
    expect(normalizeNumericControl(NaN, 0, 1, 0.001)).toBeUndefined();
  });
  it('compares legacy per-mode settings and identifies only adjusted fields', () => {
    const requested = { surfaces: { light: { l: 1 }, dark: { l: 0 }, levels: 2, step: 0.035 }, muted: { distance: 0.055, separation: 0.025 }, emphasis: { separation: 0.045 }, families: [{ id: 'neutral', hue: 200, chroma: 0.01 }] } as BuilderConfig;
    const accepted = structuredClone(requested);
    accepted.surfaces.step = { light: 0.035, dark: 0.001 };
    accepted.muted.chromaScale = { light: 1, dark: 1 };
    accepted.emphasis.separation = 0.01;
    expect(adjustedControlKeys(requested, accepted)).toEqual(['surfaces.dark.step', 'emphasis.separation']);
  });
});
