import reference from 'virtual:kds-reference';
import { configFromReference } from '../engine/config';
import { setControlValue } from './controlAvailability';
import { describe, expect, it } from 'vitest';
import { isSrgb, parseLockedColor } from '../engine/color';
import { displayBrandColor, applyBrandAnchors, createBrandAnchor, editAnchorColor, serializeOklch } from './brandAnchor';

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

it('keeps family slider edits and the preferred source synchronized without mutating the input', () => {
  const config = configFromReference(reference);
  const input = '#c02030';
  const initial = structuredClone(config);
  const next = applyBrandAnchors(config, [{ family: 'brand', color: input, locked: false, role: 'emphasis.base', mode: 'light' }]);
  const color = parseLockedColor(input);
  expect(next.families.find(family => family.id === 'brand')).toMatchObject({ hue: color.h, chroma: color.c });
  expect(next.anchors[0].color).toBe(input);
  expect(config).toEqual(initial);
  const shifted = setControlValue(next, 'families.brand.hue', 210);
  expect(parseLockedColor(shifted.anchors[0].color)).toMatchObject({ h: 210, c: color.c, l: color.l });
  expect(next.anchors[0].color).toBe(input);
  shifted.anchors[0].locked = true;
  const locked = setControlValue(shifted, 'families.brand.hue', 50);
  expect(locked.anchors).toEqual(shifted.anchors);
});

it('formats compact OKLCH for display without changing the exact source', () => {
  const source = 'oklch(0.5432191 0.1034567 228.12345)';
  expect(displayBrandColor(source, 'oklch')).toBe('oklch(0.543 0.103 228.1)');
  expect(displayBrandColor(source, 'oklch', true)).toBe(source);
  expect(displayBrandColor('#12aBcD', 'hex')).toBe('#12aBcD');
});
