import { clampChroma, converter, formatHex, parse, wcagLuminance } from 'culori';
import type { ColorValue, OklchColor } from './types';
import { BoundedCache } from './bounded-cache';

const oklch = converter('oklch');
const rgb = converter('rgb');
const gamutMembership = new WeakMap<object, boolean>();
const generatedColors = new BoundedCache<string, ColorValue>(16384);
interface ColorFacts { inGamut: boolean; luminance: number; r: number; g: number; b: number; identity?: string }
const renderedColors = new BoundedCache<string, ColorFacts>(16384);
const round = (value: number) => Number(value.toFixed(10));
const normalizedHue = (hue: number) => ((hue % 360) + 360) % 360;

/** CSS keys survive cloning and preserve exact locked sources and precision. */
function colorFacts(css: string): ColorFacts | undefined {
  const cached = renderedColors.get(css);
  if (cached) return cached;
  const value = rgb(css);
  if (!value) return undefined;
  const channels = [value.r, value.g, value.b];
  const clipped = channels.map(channel => Math.max(0, Math.min(1, channel)));
  const facts: ColorFacts = {
    inGamut: channels.every(channel => Number.isFinite(channel) && channel >= -1e-7 && channel <= 1 + 1e-7),
    luminance: wcagLuminance({ mode: 'rgb', r: clipped[0], g: clipped[1], b: clipped[2] }),
    r: clipped[0], g: clipped[1], b: clipped[2],
  };
  renderedColors.set(css, facts);
  return facts;
}

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
  if (typeof color === 'string' || 'css' in color)
    return colorFacts(typeof color === 'string' ? color : color.css)?.inGamut ?? false;
  const cached = gamutMembership.get(color);
  if (cached !== undefined) return cached;
  const value = rgb({ mode: 'oklch', ...color });
  const result = !!value && [value.r, value.g, value.b].every((channel) => Number.isFinite(channel) && channel >= -1e-7 && channel <= 1 + 1e-7);
  gamutMembership.set(color, result);
  return result;
}

/** Generated colors reduce OKLCH chroma to fit sRGB, preserving lightness/hue. */
export function toColor(input: string | OklchColor): ColorValue {
  const original = coordinates(input);
  const key = `${original.l}|${original.c}|${original.h}`;
  const cached = generatedColors.get(key);
  if (cached) return { ...cached };
  const inGamut = isSrgb(original);
  const mapped = inGamut ? original : oklch(clampChroma({ mode: 'oklch', ...original }, 'oklch'))!;
  const l = round(mapped.l);
  const c = round(mapped.c);
  const h = round(original.h);
  const css = `oklch(${l} ${c} ${h})`;
  const color = { l, c, h, css, hex: formatHex(css)!, gamutMapped: !inGamut };
  generatedColors.set(key, color);
  return { ...color };
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
  // For unrenderable locks this is a clipped-sRGB estimate only. The engine
  // explicitly marks every such check as uncertified, regardless of this ratio.
  const css = typeof input === 'string' ? toColor(input).css : input.css;
  return colorFacts(css)!.luminance;
}

/** WCAG contrast uses unrounded linear-sRGB luminance, never display labels. */
export function contrast(a: ColorValue | string, b: ColorValue | string): number {
  const first = luminance(a);
  const second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

export function colorIdentity(color: ColorValue): string {
  // Wide-gamut locks must not merge with their clipped HEX display fallback.
  const facts = colorFacts(color.css);
  if (!facts?.inGamut) return `source:${color.css}`;
  return facts.identity ??= [facts.r, facts.g, facts.b].map(channel => channel.toFixed(8)).join(',');
}
