import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { generateSystem } from '../engine/generate';
import { configFromReference, parseKdsTokens } from '../engine/reference';
import { previewTokens, resolvePreviewToken } from './previewTokens';

const config = configFromReference(parseKdsTokens(readFileSync(new URL('../reference/kds-tokens.css', import.meta.url), 'utf8')));

it.each([1, 6])('covers exactly the generated semantics with %s surfaces and custom prefixes', (levels) => {
  const system = generateSystem({ ...config, prefix: 'custom', surfaces: { ...config.surfaces, levels } });
  for (const mode of ['light', 'dark'] as const) {
    const tokens = previewTokens(system, mode);
    expect(tokens.map(token => token.role.semantic).sort()).toEqual(system.semantics.map(token => token.name).sort());
    expect(new Set(tokens.map(token => token.role.semantic)).size).toBe(tokens.length);
    for (const token of tokens) expect(resolvePreviewToken(system, mode, token.role.semantic)?.role).toEqual(token.role);
  }
});

it.each([false, true])('only demonstrates generated selected states: %s', (selected) => {
  const system = generateSystem({ ...config, emphasis: { ...config.emphasis, selected } });
  const tokens = previewTokens(system, 'dark');
  expect(tokens.filter(token => token.state === 'selected')).toHaveLength(selected ? 12 : 0);
});

it('resolves link aliases to their primitive while retaining their own semantic name', () => {
  const system = generateSystem(config);
  const link = resolvePreviewToken(system, 'dark', '--kds-fg-link-hover')!;
  expect(link.role.semantic).toBe('--kds-fg-link-hover');
  expect(link.role.primitive).toBe(system.modes.dark.families.info.roles['foreground.hover']!.primitive);
  expect(link.section).toBe('relationships');
  expect(resolvePreviewToken(system, 'light', '--missing')).toBeUndefined();
});
it.each([false, true])('identifies preferred and locked anchors independently from derived states: %s', locked => {
  const baseline = generateSystem(config);
  const system = generateSystem({ ...config, anchors: [{ family: 'brand', mode: 'both', role: 'emphasis.base', locked, color: baseline.modes.light.families.brand.roles['emphasis.base']!.color.css }] });
  expect(resolvePreviewToken(system, 'dark', '--kds-bg-brand-emphasis-base')?.anchor).toBe(locked ? 'locked' : 'preferred');
  expect(resolvePreviewToken(system, 'dark', '--kds-bg-brand-emphasis-hover')?.anchor).toBeUndefined();
});
