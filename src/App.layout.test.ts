import { render } from 'svelte/server';
import { expect, it, vi } from 'vitest';
import App from './App.svelte';

it('renders an accessible loading shell before client-side worker initialization', () => {
  const markup = render(App).body;
  expect(markup).toContain('id="workspace"');
  expect(markup).toContain('role="status"');
  expect(markup).toContain('Loading your color system');
  expect(markup).not.toContain('class="controls settings-sidebar"');
  expect(markup).not.toContain('class="preview-grid"');
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
