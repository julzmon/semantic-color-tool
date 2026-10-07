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
