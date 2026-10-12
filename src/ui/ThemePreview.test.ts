import { readFileSync } from 'node:fs';
import { render } from 'svelte/server';
import { expect, it } from 'vitest';
import { configFromReference, parseKdsTokens } from '../engine/reference';
import { generateSystem } from '../engine/generate';
import ThemePreview from './ThemePreview.svelte';

const defaultSystem = generateSystem(configFromReference(parseKdsTokens(
  readFileSync(new URL('../reference/kds-tokens.css', import.meta.url), 'utf8'),
)));

it.each(['light', 'dark'] as const)('renders family hooks in %s mode', (mode) => {
  const markup = render(ThemePreview, { props: { system: defaultSystem, mode } }).body;

  expect(markup).toContain('data-family="brand"');
  for (const family of ['info', 'positive', 'warning', 'negative']) {
    expect(markup).toContain(`data-family="${family}"`);
  }
});

it.each(['light', 'dark'] as const)('renders generated surface cards in %s mode', (mode) => {
  const markup = render(ThemePreview, { props: { system: defaultSystem, mode } }).body;

  expect(markup).toContain(`aria-label="${mode === 'light' ? 'Light' : 'Dark'} surface-level cards"`);
  expect(markup).toContain(`aria-label="${mode === 'light' ? 'Light' : 'Dark'} nested surface cards"`);
  for (const surface of defaultSystem.modes[mode].surfaces) {
    expect(markup).toContain(`data-surface="${surface.semantic}"`);
  }
});

it('keeps semantic CSS variables available to nested mode boundaries', () => {
  const markup = render(ThemePreview, { props: { system: defaultSystem, mode: 'light' } }).body;
  for (const token of defaultSystem.semantics) {
    expect(markup).toContain(`${token.name}: light-dark(var(${token.light}), var(${token.dark}))`);
  }
  expect(markup).toContain('data-mode="dark"');
});

it.each(['light', 'dark'] as const)('shows Brand interaction samples next to the buttons in %s mode', (mode) => {
  const markup = render(ThemePreview, { props: { system: defaultSystem, mode } }).body;
  expect(markup).toContain(`aria-label="${mode === 'light' ? 'Light' : 'Dark'} interaction states"`);
  for (const fill of ['muted', 'emphasis']) {
    for (const state of ['base', 'hover', 'active']) {
      expect(markup).toContain(`background: var(--kds-bg-brand-${fill}-${state})`);
    }
    expect(markup).not.toContain(`background: var(--kds-bg-brand-${fill}-selected)`);
  }
});

it('shows selected samples when the selected state is enabled', () => {
  const config = { ...defaultSystem.config, emphasis: { ...defaultSystem.config.emphasis, selected: true } };
  const system = generateSystem(config);
  const markup = render(ThemePreview, { props: { system, mode: 'light' } }).body;
  for (const fill of ['muted', 'emphasis']) {
    expect(markup).toContain(`background: var(--kds-bg-brand-${fill}-selected)`);
  }
});
