import { beforeEach, expect, it, vi } from 'vitest';
const counts = vi.hoisted(() => ({ hex: 0, rgb: 0 }));
vi.mock('culori', async importOriginal => {
  const actual = await importOriginal<typeof import('culori')>();
  return { ...actual,
    formatHex: (...args: Parameters<typeof actual.formatHex>) => { counts.hex++; return actual.formatHex(...args); },
    converter: (target: Parameters<typeof actual.converter>[0]) => {
      const convert = actual.converter(target);
      return (...args: Parameters<typeof convert>) => { if (target === 'rgb') counts.rgb++; return convert(...args); };
    },
  };
});
beforeEach(() => { vi.resetModules(); counts.hex = counts.rgb = 0; });
it('reuses a generated conversion without returning shared mutable colors', async () => {
  const { toColor } = await import('./color');
  const input = { l: 0.53, c: 0.22, h: 29 };
  const first = toColor(input), expected = { ...first };
  const formatted = counts.hex;
  first.l = 0; first.css = '#000'; first.hex = '#000000';
  const second = toColor(input);
  expect(second).toEqual(expected);
  expect(second).not.toBe(first);
  expect(counts.hex).toBe(formatted);
});
it('reuses RGB facts across independent objects with the same CSS', async () => {
  const { toColor, isSrgb, contrast, colorIdentity } = await import('./color');
  const color = toColor('#126774'), white = toColor('#fff');
  isSrgb(color); contrast(color, white); colorIdentity(color);
  const converted = counts.rgb;
  isSrgb({ ...color }); contrast({ ...color }, { ...white }); colorIdentity({ ...color });
  expect(counts.rgb).toBe(converted);
});
it('retains exact wide-gamut sources and rejects invalid input after cache hits', async () => {
  const { parseLockedColor, toColor, isSrgb, colorIdentity } = await import('./color');
  const source = 'oklch(0.6 0.4 29)';
  const lock = parseLockedColor(source);
  expect(isSrgb(lock)).toBe(false);
  expect(colorIdentity(lock)).toBe(`source:${source}`);
  expect(toColor(source).gamutMapped).toBe(true);
  expect(parseLockedColor(source).css).toBe(source);
  expect(() => toColor({ l: NaN, c: 0, h: 0 })).toThrow();
});
it('uses current CSS when a previously measured mutable color changes', async () => {
  const { toColor, contrast, colorIdentity, isSrgb } = await import('./color');
  const color = toColor('#fff'), black = toColor('#000');
  expect(contrast(color, black)).toBeCloseTo(21, 10);
  color.css = '#000';
  expect(contrast(color, black)).toBe(1);
  expect(colorIdentity(color)).toBe(colorIdentity(black));
  color.css = 'oklch(0.6 0.4 29)';
  expect(isSrgb(color)).toBe(false);
});
it('does not merge neighboring high-precision input coordinates', async () => {
  const { toColor } = await import('./color');
  const first = { l: 0.5, c: 0.02, h: 29 };
  const second = { ...first, l: 0.500000001 };
  expect(toColor(first).l).toBe(first.l);
  expect(toColor(second).l).toBe(second.l);
  expect(toColor(first).css).not.toBe(toColor(second).css);
});
