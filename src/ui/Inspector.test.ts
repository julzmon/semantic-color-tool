import { readFileSync } from 'node:fs';
import { render } from 'svelte/server';
import { expect, it } from 'vitest';
import { generateSystem } from '../engine/generate';
import { configFromReference, parseKdsTokens } from '../engine/reference';
import Inspector from './Inspector.svelte';
const system = generateSystem(configFromReference(parseKdsTokens(readFileSync(new URL('../reference/kds-tokens.css', import.meta.url), 'utf8'))));
it.each(['--kds-bg-surface-base', '--kds-fg-muted', '--kds-fg-on-emphasis', '--kds-fg-link-hover'])('inspects global tokens and aliases: %s', token => {
  const markup = render(Inspector, { props: { system, selected: { mode: 'dark', token } } }).body;
  expect(markup).toContain(`<code>${token}</code>`);
});
it('identifies both sides of a contrast relationship without truncating the role', () => {
  const markup = render(Inspector, { props: { system, selected: { mode: 'dark', token: '--kds-bg-brand-emphasis-hover' } } }).body;
  expect(markup).toContain('fg on emphasis → bg brand emphasis hover');
});
