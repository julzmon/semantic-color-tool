import { render } from 'svelte/server';
import { expect, it, vi } from 'vitest';
import App from './App.svelte';

it('keeps workspace navigation inside the preview content and shows both themes without a mode selector', () => {
  const markup = render(App).body;
  expect(markup).not.toContain('Quick color controls');
  expect(markup).toContain('class="controls settings-sidebar"');
  expect(markup).toContain('Settings');
  expect(markup).toContain('aria-label="Workspace sections"');
  const workspace = markup.match(/<main id="workspace"[\s\S]*?<\/main>/)?.[0];
  expect(workspace).toContain('aria-label="Workspace sections"');
  expect(markup).not.toContain('aria-label="Preview mode"');
  expect(markup).not.toContain('class="mode-switch');
  expect(workspace).toContain('Light theme');
  expect(workspace).toContain('Dark theme');
  expect(workspace).not.toContain('Color roles');
  expect(workspace).toContain('Color palette');
  expect(markup).not.toContain('brand-mark');
});

it('sticks preview tabs and lets the sidebar use the available viewport height', async () => {
  const { readFileSync } = await import('node:fs');
  const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
  expect(styles).toMatch(/\.workspace-tabs\s*\{[^}]*position:\s*sticky/s);
  expect(styles).toMatch(/\.app-header\s*\{[^}]*position:\s*static/s);
  expect(styles).toMatch(/\.settings-sidebar\s*\{[^}]*inset-block-start:\s*12px/s);
});

it('does not render the redundant workspace intro above the previews', () => {
  const markup = render(App).body;
  expect(markup).not.toContain('Build your color system');
  expect(markup).not.toContain('Adjust your colors and preview them in light and dark themes.');
  expect(markup).not.toContain('Surface layout');
  expect(markup).not.toContain('>Flat<');
  expect(markup).not.toContain('Colors in use');
  expect(markup).not.toContain('semantic tokens covered');
  expect(markup).not.toContain('aria-label="Preview section"');
  expect(markup).not.toContain('aria-label="Preview controls"');
  expect(markup).not.toContain('>Family<select');
  expect(markup).not.toContain('Select a sample to inspect its token and contrast checks.');
});


it('renders when browser policy denies the localStorage getter', () => {
  const blocked = Object.defineProperty({}, 'localStorage', { get() { throw new Error('Storage access denied'); } });
  vi.stubGlobal('window', blocked);
  try {
    expect(render(App).body).toContain('Semantic Color System Generator');
  } finally {
    vi.unstubAllGlobals();
  }
});
