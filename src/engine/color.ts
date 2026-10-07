import { clampChroma, converter, formatHex, parse, wcagLuminance } from 'culori';
import type { ColorValue, OklchColor } from './types';

const oklch = converter('oklch');
const rgb = converter('rgb');
const luminances = new WeakMap<ColorValue, number>();
const gamutMembership = new WeakMap<object, boolean>();
const round = (value: number) => Number(value.toFixed(10));
const normalizedHue = (hue: number) => ((hue % 360) + 360) % 360;

function coordinates(input: string | OklchColor): OklchColor {
  if (typeof input !== 'string') {
    if (!input || ![input.l, input.c, input.h].every(Number.isFinite) || input.l < -1e-8 || input.l > 1 + 1e-8 || input.c < 0) {
      throw new Error('Expected finite OKLCH coordinates with lightness 0–1 and nonnegative chroma.');
    }
    return { l: Math.max(0, Math.min(1, input.l)), c: input.c, h: normalizedHue(input.h) };
  }
  const parsed = parse(input);
  if (!parsed || (parsed.alpha !== undefined && parsed.alpha !== 1)) throw new Error('Expected a valid opaque color.');
  const value = oklch(parsed);
  if (!value || ![value.l, value.c, value.h ?? 0].every(Number.isFinite) || value.l < -1e-8 || value.l > 1 + 1e-8 || value.c < 0) {
    throw new Error('Expected a finite opaque color with OKLCH lightness 0–1.');
  }
  return { l: Math.max(0, Math.min(1, value.l)), c: value.c, h: normalizedHue(value.h ?? 0) };
}

/** Allows conversion round-off at the exact black/white and gamut boundaries. */
export function isSrgb(color: ColorValue | string | OklchColor): boolean {
  if (typeof color !== 'string') {
    const cached = gamutMembership.get(color);
    if (cached !== undefined) return cached;
  }
  const value = rgb(typeof color === 'string' ? color : 'css' in color ? color.css : { mode: 'oklch', ...color });
  const result = !!value && [value.r, value.g, value.b].every((channel) => Number.isFinite(channel) && channel >= -1e-7 && channel <= 1 + 1e-7);
  if (typeof color !== 'string') gamutMembership.set(color, result);
  return result;
}

/** Generated colors reduce OKLCH chroma to fit sRGB, preserving lightness/hue. */
export function toColor(input: string | OklchColor): ColorValue {
  const original = coordinates(input);
  const inGamut = isSrgb(original);
  const mapped = inGamut ? original : oklch(clampChroma({ mode: 'oklch', ...original }, 'oklch'))!;
  const l = round(mapped.l);
  const c = round(mapped.c);
  const h = round(original.h);
  const css = `oklch(${l} ${c} ${h})`;
  return { l, c, h, css, hex: formatHex(css)!, gamutMapped: !inGamut };
}

/** Locks preserve their original CSS instead of silently changing the brand. */
export function parseLockedColor(input: string): ColorValue {
  if (typeof input !== 'string' || !/^(#[\da-f]{3,8}|oklch\([^;{}]+\))$/i.test(input.trim())) {
    throw new Error('Brand anchors must be opaque HEX or OKLCH colors.');
  }
  const value = coordinates(input);
  return { ...value, css: input, source: input, hex: formatHex(input)!, gamutMapped: false };
}

function luminance(input: ColorValue | string): number {
  if (typeof input !== 'string') {
    const cached = luminances.get(input);
    if (cached !== undefined) return cached;
  }
  // For unrenderable locks this is a clipped-sRGB estimate only. The engine
  // explicitly marks every such check as uncertified, regardless of this ratio.
  const css = typeof input === 'string' ? toColor(input).css : input.css;
  const value = rgb(css)!;
  const result = wcagLuminance({ mode: 'rgb', r: Math.max(0, Math.min(1, value.r)), g: Math.max(0, Math.min(1, value.g)), b: Math.max(0, Math.min(1, value.b)) });
  if (typeof input !== 'string') luminances.set(input, result);
  return result;
}

/** WCAG contrast uses unrounded linear-sRGB luminance, never display labels. */
export function contrast(a: ColorValue | string, b: ColorValue | string): number {
  const first = luminance(a);
  const second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

export function colorIdentity(color: ColorValue): string {
  // Wide-gamut locks must not merge with their clipped HEX display fallback.
  if (!isSrgb(color)) return `source:${color.css}`;
  const value = rgb(color.css)!;
  return [value.r, value.g, value.b].map((channel) => Math.max(0, Math.min(1, channel)).toFixed(8)).join(',');
}
