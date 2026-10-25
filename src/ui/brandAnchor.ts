import { isSrgb, parseLockedColor } from '../engine/color';
import type { BuilderConfig, ColorAnchor, FamilyConfig, OklchColor } from '../engine/types';

const precision = (value: number, digits: number) => Number(value.toFixed(digits)).toString();

function rounded(value: OklchColor, digits: number): OklchColor {
  return {
    l: Number(value.l.toFixed(digits)),
    c: Number(value.c.toFixed(digits)),
    h: Number(value.h.toFixed(digits)),
  };
}

function format(value: OklchColor, digits: number): string {
  return `oklch(${precision(value.l, digits)} ${precision(value.c, digits)} ${precision(value.h, digits)})`;
}

function normalizeCoordinates(value: OklchColor): OklchColor {
  if (!Number.isFinite(value.l) || value.l < 0 || value.l > 1) throw new Error('Lightness must be a number from 0 to 1.');
  if (!Number.isFinite(value.c) || value.c < 0) throw new Error('Chroma must be a nonnegative number.');
  if (!Number.isFinite(value.h)) throw new Error('Hue must be a finite number.');
  return { ...value, h: ((value.h % 360) + 360) % 360 };
}

/** Apply only edited coordinates; untouched exact sources retain their precision. */
export function editAnchorColor(source: string, edits: Partial<Record<keyof OklchColor, string>>): string | undefined {
  const original = parseLockedColor(source);
  const values = Object.fromEntries(Object.entries(edits).map(([key, value]) => {
    if (!value.trim()) throw new Error('Enter valid OKLCH coordinates.');
    return [key, Number(value)];
  }));
  const next = normalizeCoordinates({ l: original.l, c: original.c, h: original.h, ...values });
  if (next.l === original.l && next.c === original.c && next.h === original.h) return;
  return `oklch(${next.l} ${next.c} ${next.h})`;
}

/** Serializes a generated initial Brand input compactly without losing gamut membership. */
export function serializeOklch(value: OklchColor): string {
  const normalized = normalizeCoordinates(value);
  // Six decimals keep ordinary inputs compact. At the sRGB edge, retain only
  // the extra digits needed to keep an already-renderable lock renderable.
  for (let digits = 6; digits <= 10; digits++) {
    const candidate = rounded(normalized, digits);
    if (!isSrgb(normalized) || isSrgb(candidate)) return format(candidate, digits);
  }
  return format(normalized, 10);
}

/** KDS red-800 lightness seeds the user-facing Brand emphasis-base anchor. */
export function createBrandAnchor(brand: Pick<FamilyConfig, 'hue' | 'chroma'>): ColorAnchor {
  return {
    family: 'brand',
    mode: 'light',
    role: 'emphasis.base',
    color: serializeOklch({ l: 0.530761849, c: brand.chroma, h: brand.hue }),
    locked: false,
  };
}

/** The primary preferred Brand input also seeds the family's adjustable hue/chroma. */
export function applyBrandAnchors(config: BuilderConfig, anchors: ColorAnchor[]): BuilderConfig {
  const primary = anchors.find(anchor => anchor.family === 'brand');
  if (!primary || primary.locked) return { ...config, anchors };
  const color = parseLockedColor(primary.color);
  return { ...config, anchors, ...(config.chromaCurves ? { chromaCurves: { ...config.chromaCurves, brand: { ...config.chromaCurves.brand, peakLightness: Math.max(.01,Math.min(.99,color.l)), peakChroma: color.c } } } : {}), families: config.families.map(family => family.id === 'brand'
    ? { ...family, hue: color.h, chroma: color.c } : family) };
}

/** Readable display only; persistence and calculations keep the original source. */
export function displayBrandColor(source: string, target: 'hex' | 'oklch', fullPrecision = false): string {
  const original = source.trim();
  const parsed = parseLockedColor(original);
  if (target === 'hex') return original.startsWith('#') ? original : parsed.hex;
  if (fullPrecision) return original.toLowerCase().startsWith('oklch(') ? original
    : `oklch(${parsed.l} ${parsed.c} ${parsed.h})`;
  return `oklch(${precision(parsed.l, 3)} ${precision(parsed.c, 3)} ${precision(parsed.h, 1)})`;
}
