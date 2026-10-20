import { readFileSync } from 'node:fs';
import { render } from 'svelte/server';
import { expect, it } from 'vitest';
import { generateSystem } from '../engine/generate';
import { configFromReference, parseKdsTokens } from '../engine/reference';
import FeasibilityDetails from './FeasibilityDetails.svelte';
const system = generateSystem(configFromReference(parseKdsTokens(readFileSync(new URL('../reference/kds-tokens.css', import.meta.url), 'utf8'))));
it('explains discrete samples, restrictions, hierarchy, and both kinds of sharing', () => {
  const markup = render(FeasibilityDetails, { props: { system, mode: 'light', token: '--kds-fg-brand-base', expanded: true } }).body;
  for (const text of ['0.001', 'between samples', 'Restricting relationships', 'Shared complete color', 'Shared lightness only', 'Joint foreground/emphasis', 'hierarchy']) expect(markup).toContain(text);
});
