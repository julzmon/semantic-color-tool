import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { configFromReference, parseKdsTokens } from '../engine/reference';
import { generateSystem } from '../engine/generate';
import { ThemePreview } from './ThemePreview';

const defaultSystem = generateSystem(configFromReference(parseKdsTokens(
  readFileSync(new URL('../reference/kds-tokens.css', import.meta.url), 'utf8'),
)));

it('renders family hooks for the primary action and status cards', () => {
  const markup = renderToStaticMarkup(<ThemePreview system={defaultSystem} mode="light" />);

  expect(markup).toContain('data-family="brand"');
  for (const family of ['info', 'positive', 'warning', 'negative']) {
    expect(markup).toContain(`data-family="${family}"`);
  }
});

it('renders generated surface levels as individual and nested card backgrounds', () => {
  const markup = renderToStaticMarkup(<ThemePreview system={defaultSystem} mode="light" />);

  expect(markup).toContain('aria-label="Light surface-level cards"');
  expect(markup).toContain('aria-label="Light nested surface cards"');
  for (const surface of defaultSystem.modes.light.surfaces) {
    expect(markup).toContain(`data-surface="${surface.semantic}"`);
  }
});
