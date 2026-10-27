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
  expect(markup).toContain('aria-label="Inspect Warning muted Base in dark theme"');
  expect(markup).toContain('aria-label="Inspect Link Base in dark theme"');
  expect(markup).not.toContain('Default');
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
  expect(markup).not.toContain('Workspace card');
  expect(markup).not.toContain('Nested card');
});
it('keeps the sample buttons and helper text removed', () => {
  const markup = render(ThemePreview, { props: { system: defaultSystem, mode: 'light' } }).body;
  for (const text of ['Interactive sample', 'Save changes', 'Reset project']) expect(markup).not.toContain(text);
});
it.each(['light', 'dark'] as const)('keeps contextual alerts and an editable input per surface level in %s mode', mode => {
  const markup = render(ThemePreview, { props: { system: defaultSystem, mode } }).body;
  expect(markup).toContain('Status updates');
  for (const title of ['You’re all up to date', 'Ready to share', 'Review before publishing', 'Needs attention']) expect(markup).toContain(title);
  const context = markup.slice(markup.indexOf('class="preview-context"'), markup.indexOf('class="token-demo"'));
  expect(context).not.toContain('Project name');
  const surfaces = defaultSystem.modes[mode].surfaces;
  surfaces.forEach((_, index) => {
    const id = index === 0 ? `project-${mode}` : `project-${mode}-${index}`;
    expect(markup).toMatch(new RegExp(`for="${id}"[^>]*>Project name</label>`));
    expect(markup).toContain(`id="${id}"`);
  });
  expect(markup.match(/>Project name<\/label>/g)).toHaveLength(surfaces.length);
  expect(markup.match(/data-example="same-surface-card"/g)).toHaveLength(surfaces.length);
  expect(markup.match(/data-example="next-surface-card"/g)).toHaveLength(surfaces.length-1);
  expect(markup).toContain('Show states');
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

it('supports six levels and custom prefixes without duplicate input IDs or a fake deepest surface',()=>{
  const config=structuredClone(defaultSystem.config);config.surfaces.levels=6;config.prefix='acme';config.emphasis.selected=true;
  const system=generateSystem(config);
  for(const mode of ['light','dark'] as const){
    const markup=render(ThemePreview,{props:{system,mode}}).body;
    expect(markup.match(/data-example="same-surface-card"/g)).toHaveLength(6);
    expect(markup.match(/data-example="next-surface-card"/g)).toHaveLength(5);
    expect(markup).toContain('--kds-bg-surface-base:');
    for(const surface of system.modes[mode].surfaces)expect(markup).toContain(`var(${surface.semantic})`);
    const ids=[...markup.matchAll(/<input[^>]*\bid="(project-[^"]+)"/g)].map(m=>m[1]);
    expect(ids).toHaveLength(6);expect(new Set(ids).size).toBe(6);
    expect(markup).not.toContain('var(undefined)');
  }
});
