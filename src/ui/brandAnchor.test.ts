import { describe, expect, it } from 'vitest';
import { isSrgb, parseLockedColor } from '../engine/color';
import { createBrandAnchor, editAnchorColor, serializeOklch } from './brandAnchor';

describe('Brand anchor helpers', () => {
  it('creates an unlocked Brand emphasis-base anchor by default', () => {
    const anchor = createBrandAnchor({ hue: 29.23388028, chroma: 0.217799663 });
    expect(anchor).toEqual({
      family: 'brand', mode: 'light', role: 'emphasis.base', color: 'oklch(0.53076185 0.21779966 29.23388028)', locked: false,
    });
    expect(isSrgb(parseLockedColor(anchor.color))).toBe(true);
  });

  it('serializes finite OKLCH coordinates and rejects invalid input', () => {
    expect(serializeOklch({ l: 0.5, c: 0.12, h: 390 })).toBe('oklch(0.5 0.12 30)');
    expect(() => serializeOklch({ l: 1.01, c: 0.12, h: 30 })).toThrow(/lightness/i);
    expect(() => serializeOklch({ l: 0.5, c: -0.01, h: 30 })).toThrow(/chroma/i);
  });
});

it('does not rewrite an unchanged exact anchor', () => {
  const source = 'oklch(0.5432191 0.1034567 228.12345)';
  expect(editAnchorColor(source, {})).toBeUndefined();
  expect(editAnchorColor(source, { h: '228.12345' })).toBeUndefined();
});

it('preserves untouched coordinate precision when editing an anchor', () => {
  const source = 'oklch(0.5432191 0.1034567 228.12345)';
  const edited = parseLockedColor(editAnchorColor(source, { h: '220' })!);
  expect(edited.l).toBe(0.5432191);
  expect(edited.c).toBe(0.1034567);
  expect(edited.h).toBe(220);
  expect(() => editAnchorColor(source, { l: '' })).toThrow();
  expect(() => editAnchorColor(source, { l: '2' })).toThrow(/lightness/i);
});
