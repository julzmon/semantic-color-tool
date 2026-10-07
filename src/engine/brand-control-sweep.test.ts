import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { configFromReference } from './config';
import { generateSystem } from './generate';
import { parseKdsTokens } from './reference';

const reference = parseKdsTokens(readFileSync(new URL('../reference/kds-tokens.css', import.meta.url), 'utf8'));

describe('Brand controls', () => {
  it('generates across every reachable Brand hue and chroma control endpoint', () => {
    const hues = [0, 1, 29, 120, 240, 359, 360];
    const chromas = [0, 0.001, 0.05, 0.15, 0.3];

    for (const hue of hues) for (const chroma of chromas) {
      const config = configFromReference(reference);
      const brand = config.families.find((family) => family.id === 'brand')!;
      brand.hue = hue;
      brand.chroma = chroma;

      expect(() => generateSystem(config), `h=${hue}, c=${chroma}`).not.toThrow();
    }
  });
});
