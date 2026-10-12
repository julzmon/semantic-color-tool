import { render } from 'svelte/server';
import { expect, it } from 'vitest';
import App from './App.svelte';

it('keeps workspace navigation in the shared shell and removes top-level color controls', () => {
  const markup = render(App).body;
  expect(markup).not.toContain('Quick color controls');
  expect(markup).toContain('class="controls settings-sidebar"');
  expect(markup).toContain('Settings');
  expect(markup).toContain('aria-label="Workspace sections"');
  expect(markup).not.toContain('brand-mark');
});

it('sticks workspace tabs below the non-sticky brand header', async () => {
  const { readFileSync } = await import('node:fs');
  const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
  expect(styles).toMatch(/\.workspace-tabs\s*\{[^}]*position:\s*sticky/s);
  expect(styles).toMatch(/\.app-header\s*\{[^}]*position:\s*static/s);
  expect(styles).toMatch(/\.settings-sidebar\s*\{[^}]*inset-block-start:\s*70px/s);
});

it('does not render the redundant workspace intro above the previews', () => {
  const markup = render(App).body;
  expect(markup).not.toContain('Build your color system');
  expect(markup).not.toContain('Adjust your colors and preview them in light and dark themes.');
});
