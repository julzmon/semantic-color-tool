import { readFileSync } from 'node:fs';
import { render } from 'svelte/server';
import { expect, it } from 'vitest';
import { configFromReference, parseKdsTokens } from '../engine/reference';
import { generateSystem } from '../engine/generate';
import ThemePreview from './ThemePreview.svelte';
import { previewTokens } from './previewTokens';

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

it('keeps semantic CSS variables available to nested mode boundaries', () => {
  const markup = render(ThemePreview, { props: { system: defaultSystem, mode: 'light' } }).body;
  for (const token of defaultSystem.semantics) {
    expect(markup).toContain(`${token.name}: `);
  }
  expect(markup).toContain('data-mode="dark"');
  expect(markup).toContain('light-dark(oklch(');
  expect(markup).not.toContain('--kds-key-');
});

it.each(['light', 'dark'] as const)('provides inspectable demonstrations of every semantic in %s mode', mode => {
  const markup = render(ThemePreview, { props: { system: defaultSystem, mode } }).body;
  for (const token of defaultSystem.semantics) expect(markup).toContain(`data-token="${token.name}"`);
  expect(markup).not.toContain('surface-strip');
});
it('shows all generated states for every family', () => {
  const markup = render(ThemePreview, { props: { system: defaultSystem, mode: 'dark' } }).body;
  expect(markup).toContain('data-token="--kds-bg-warning-muted-hover"');
  expect(markup).toContain('data-token="--kds-bg-warning-emphasis-hover"');
  for (const family of defaultSystem.config.families) expect(markup).toContain(`data-token="--kds-bg-${family.id}-emphasis-hover"`);
  expect(markup).toContain('data-token="--kds-bg-warning-muted-base"');
  expect(markup).not.toContain('data-token="--kds-bg-warning-muted-selected"');
});
it('demonstrates selected tokens when enabled', () => {
  const system = generateSystem({ ...defaultSystem.config, emphasis: { ...defaultSystem.config.emphasis, selected: true } });
  const markup = render(ThemePreview, { props: { system, mode: 'dark' } }).body;
  for (const token of previewTokens(system, 'dark').filter(token => token.state === 'selected')) expect(markup).toContain(`data-token="${token.role.semantic}"`);
});
it('shows each surface once as nested cards', () => {
  const markup = render(ThemePreview, { props: { system: defaultSystem, mode: 'light' } }).body;
  for (const surface of defaultSystem.modes.light.surfaces) expect(markup.split(`data-token="${surface.semantic}"`)).toHaveLength(2);
});
it('keeps the sample buttons and helper text removed', () => {
  const markup = render(ThemePreview, { props: { system: defaultSystem, mode: 'light' } }).body;
  for (const text of ['Interactive sample', 'Save changes', 'Reset project']) expect(markup).not.toContain(text);
});
it.each(['light', 'dark'] as const)('keeps contextual alerts and an editable input in %s mode', mode => {
  const markup = render(ThemePreview, { props: { system: defaultSystem, mode } }).body;
  expect(markup).toContain('Status updates');
  for (const title of ['You’re all up to date', 'Ready to share', 'Review before publishing', 'Needs attention']) expect(markup).toContain(title);
  expect(markup).toContain(`id="project-${mode}"`);
  expect(markup).toContain('Project name');
});
it.each(['light', 'dark'] as const)('uses matching family foreground states inside border examples in %s mode', mode => {
  const markup = render(ThemePreview, { props: { system: defaultSystem, mode } }).body;
  for (const family of defaultSystem.config.families) {
    for (const kind of ['muted', 'emphasis'] as const) {
      for (const state of ['base', 'hover'] as const) {
        const token = defaultSystem.modes[mode].families[family.id].roles[`border.${kind}.${state}`]!;
        const foreground = defaultSystem.modes[mode].families[family.id].roles[`foreground.${state}`]!;
        const button = markup.match(new RegExp(`<button[^>]*data-token="${token.semantic}"[^>]*>`))?.[0];
        expect(button).toContain(`; color: var(${foreground.semantic})`);
      }
    }
  }
});
