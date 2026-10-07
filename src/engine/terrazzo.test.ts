import { defineConfig, parse } from '@terrazzo/parser';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { generateSystem } from './generate';
import { configFromReference, parseKdsTokens } from './reference';
import { exportDtcg } from './export';

it('loads the portable resolver in Terrazzo and resolves both semantic modes', async () => {
  const input = configFromReference(parseKdsTokens(readFileSync(new URL('../reference/kds-tokens.css', import.meta.url), 'utf8')));
  const system = generateSystem(input);
  const config = defineConfig({}, { cwd: new URL('./', import.meta.url) });
  const { resolver } = await parse([{ filename: new URL('kds.bundle.resolver.json', import.meta.url), src: exportDtcg(system) }], { config });
  expect(resolver.listPermutations?.()).toHaveLength(2);
  for (const mode of ['light', 'dark'] as const) {
    const tokens = resolver.apply({ mode });
    const value = tokens['color.foreground.info.base'].$value;
    expect(value).toMatchObject({ colorSpace: 'oklch', alpha: 1 });
    expect((value as { components: number[] }).components[0]).toBeCloseTo(system.modes[mode].families.info.roles['foreground.base']!.color.l, 4);
  }
});
