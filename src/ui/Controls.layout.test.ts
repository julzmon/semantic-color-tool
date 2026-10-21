import { readFileSync } from 'node:fs';
import { render } from 'svelte/server';
import { parse } from 'postcss';
import { expect, it } from 'vitest';
import { configFromReference, parseKdsTokens } from '../engine/reference';
import Controls from './Controls.svelte';
import { generateSystem } from '../engine/generate';

const config = configFromReference(parseKdsTokens(readFileSync(new URL('../reference/kds-tokens.css', import.meta.url), 'utf8')));
const props = { config, system: generateSystem(config), onKeydown: () => {}, onClose: () => {}, onChange: async () => true, onReset: () => {}, onUndo: () => {} };

it('keeps every color family visible without a collapse control', () => {
  const markup = render(Controls, { props }).body;
  for (const family of ['Neutral', 'Brand', 'Info', 'Positive', 'Negative', 'Warning']) {
    if (family !== 'Brand') expect(markup).toContain(`</span>${family}</h4>`);
    expect(markup).toContain(`${family} hue`);
    expect(markup).toContain(`${family} chroma`);
  }
  expect(markup.match(/class="family-color-swatch"/g)).toHaveLength(5);
  expect(markup).not.toMatch(/<details[^>]*family-group/);
  expect(markup).toContain('<section class="control-section sidebar-section" aria-labelledby="families-heading">');
  expect(markup).toContain('--swatch-color: oklch(0.62');
  const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  const stylesheet = parse(styles);
  const sidebar = stylesheet.nodes.find(node => node.type === 'rule' && node.selector === '.settings-sidebar');
  expect(sidebar?.type).toBe('rule');
  const swatch = sidebar?.type === 'rule'
    ? sidebar.nodes.find(node => node.type === 'rule' && node.selector === '& .family-color-swatch')
    : undefined;
  expect(swatch?.type).toBe('rule');
  expect(swatch?.type === 'rule' && swatch.nodes.some(node => node.type === 'decl' && node.prop === 'inline-size' && node.value === '14px')).toBe(true);
  expect(markup).not.toContain('Edit semantic color family');
});

it('keeps all control groups permanently visible', () => {
  const markup = render(Controls, { props }).body;
  for (const [id, title] of [['structure-heading', 'Setup'], ['families-heading', 'Color adjustments'], ['surface-heading', 'Surface appearance'], ['muted-heading', 'Muted fills'], ['states-heading', 'Interaction states']] as const) {
    expect(markup).toContain(`<header class="section-heading"><h3 id="${id}">${title}</h3></header>`);
  }
  expect(markup).toContain('<header class="section-heading"><h3>Contrast protection</h3></header>');
  expect(markup).not.toMatch(/<(details|summary)\b/);
  expect(markup).toContain('<legend>Emphasis states in dark mode</legend>');
  expect(markup).toContain('aria-pressed="true">Match light mode</button>');
  expect(markup).toContain('aria-pressed="false">Reverse direction</button>');
  expect(markup).not.toContain('Emphasis across themes');
  for (const redundant of ['Surface count and states', 'Light and dark surfaces', 'Muted fill controls', 'State spacing and emphasis']) expect(markup).not.toContain(`<summary>${redundant}</summary>`);
});

it('places section descriptions before the controls they explain', () => {
  const markup = render(Controls, { props }).body;
  const comesBefore = (description: string, control: string) => {
    const descriptionIndex = markup.indexOf(description);
    const controlIndex = markup.indexOf(control);
    expect(descriptionIndex, `missing description: ${description}`).toBeGreaterThanOrEqual(0);
    expect(controlIndex, `missing control: ${control}`).toBeGreaterThanOrEqual(0);
    expect(descriptionIndex).toBeLessThan(controlIndex);
  };

  comesBefore('Choose how many surface levels to generate.', 'Include selected state');
  comesBefore('Chroma controls intensity; lightness adjusts to meet contrast requirements.', 'Brand hue');
  comesBefore('Chroma controls intensity. Lightness adjusts to meet contrast requirements.', 'Neutral hue');
  comesBefore('Each added level is darker than the previous one.', 'Base lightness');
  comesBefore('Higher values make muted fills darker.', 'Muted distance');
  comesBefore('Muted chroma controls color intensity for colored families. Neutral colors use Neutral chroma.', 'Muted distance');
  comesBefore('Controls how much colors change on hover, press, and selection in both themes.', 'Hover muted strength');
});

it('gives every color-adjusting slider an explanatory track and square black-bordered handle', async () => {
  const { readFileSync } = await import('node:fs');
  const markup = render(Controls, { props }).body;
  const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  for (const track of ['hue-range', 'chroma-range', 'lightness-range', 'surface-step-range', 'muted-distance-range', 'muted-chroma-range', 'state-spacing-range']) {
    expect(markup).toContain(track);
  }
  expect(styles).toMatch(/::-webkit-slider-thumb\s*\{[^}]*border-radius:\s*0/s);
  expect(styles).toMatch(/::-webkit-slider-thumb\s*\{[^}]*border:\s*2px solid #111/s);
  expect(styles).toMatch(/::-webkit-slider-thumb\s*\{[^}]*background:\s*transparent/s);
  expect(styles).toMatch(/::-moz-range-thumb\s*\{[^}]*border-radius:\s*0/s);
  expect(styles).toMatch(/::-moz-range-thumb\s*\{[^}]*border:\s*2px solid #111/s);
  expect(styles).toMatch(/::-moz-range-thumb\s*\{[^}]*background:\s*transparent/s);
});

it('keeps generated CSS implementation details out of the controls sidebar', () => {
  const markup = render(Controls, { props }).body;
  expect(markup).not.toContain('--kds-opacity-');
  expect(markup).not.toContain('--kds-state-');
  expect(markup).not.toContain('Universal state layer tokens');
  expect(markup).toContain('Muted color limits');
  expect(markup).toContain('Muted chroma');
  expect(markup).toContain('Hover emphasis strength');
  expect(markup).toContain('Pressed emphasis strength');
});


it('makes the shared-color strategy explicit while keeping the standard default', () => {
  const markup = render(Controls, { props }).body;
  expect(markup).toContain('for="solving-strategy">Color solving strategy</label>');
  expect(markup).toContain('value="prefer-shared">Prefer shared colors when feasible</option>');
  expect(markup).toContain('Text inside emphasis fills stays separate.');
});
it('replaces muted spacing with independent muted state strengths', () => {
  const markup = render(Controls, { props }).body;
  expect(markup).not.toContain('Muted state spacing');
  expect(markup).toContain('Hover muted strength');
  expect(markup).toContain('Pressed muted strength');
  expect(markup).toContain('Pressed emphasis strength');
  expect(markup).toContain('Muted distance');
});


it('puts brand setup first and remaining color adjustments second to last', () => {
  const markup = render(Controls, { props }).body;
  const headings = [...markup.matchAll(/<header class="section-heading"><h3[^>]*>([^<]+)<\/h3>/g)].map(match => match[1]);
  expect(headings).toEqual(['Setup', 'Surface appearance', 'Muted fills', 'Interaction states', 'Color adjustments', 'Contrast protection']);
  const setup = markup.slice(markup.indexOf('aria-labelledby="structure-heading"'), markup.indexOf('aria-labelledby="surface-heading"'));
  const adjustments = markup.slice(markup.indexOf('aria-labelledby="families-heading"'));
  expect(setup).toContain('Brand hue');
  expect(setup).toContain('Lock exact color');
  expect(setup).toContain('Surface count');
  expect(adjustments).not.toContain('Brand hue');
  expect(adjustments).not.toContain('Lock exact color');
  expect(markup.match(/>Brand hue<\/label>/g)).toHaveLength(1);
});
