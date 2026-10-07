import { isSrgb } from '../engine/color';
import type { ColorAnchor, FamilyConfig, OklchColor } from '../engine/types';

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

/** Serializes the only editable Brand input format. */
export function serializeOklch(value: OklchColor): string {
  if (!Number.isFinite(value.l) || value.l < 0 || value.l > 1) throw new Error('Lightness must be a number from 0 to 1.');
  if (!Number.isFinite(value.c) || value.c < 0) throw new Error('Chroma must be a nonnegative number.');
  if (!Number.isFinite(value.h)) throw new Error('Hue must be a finite number.');
  const normalized = { ...value, h: ((value.h % 360) + 360) % 360 };
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
