import reference from 'virtual:kds-reference';
import { render } from 'svelte/server';
import { expect, it } from 'vitest';
import { configFromReference } from '../engine/config';
import { generateSystem } from '../engine/generate';
import ColorInfo from './ColorInfo.svelte';
import ThemePreview from './ThemePreview.svelte';
import Primitives from './Primitives.svelte';
import { colorInspection } from './colorInspection';
const system = generateSystem(configFromReference(reference));
it('shows actual comparison tokens, compact values, target and margin', () => {
  const token = system.modes.light.families.positive.roles['muted.base']!.semantic;
  const inspection = colorInspection(system, { mode: 'light', token })!;
  const markup = render(ColorInfo, { props: { inspection } }).body;
  expect(markup).toContain(inspection.relationship!.foreground);
  expect(markup).toContain(inspection.relationship!.background);
  expect(markup).toContain('Tightest contrast check');
  expect(markup).toContain('headroom');
  expect(markup).toContain('Target');
  expect(markup).toContain('Light theme');
});
it('does not show passing text grades or a contrast ratio for decorative roles', () => {
  const inspection = colorInspection(system, { mode: 'light', token: system.modes.light.families.brand.roles['border.muted.base']!.semantic })!;
  const markup = render(ColorInfo, { props: { inspection } }).body;
  expect(markup).toContain('No contrast requirement applies');
  expect(markup).not.toContain('AAA');
  expect(markup).not.toContain('headroom');
});
it('uses native popover invokers on all preview tokens and palette swatches', () => {
  const role = system.modes.light.families.brand.roles['muted.base']!.semantic;
  const preview = render(ThemePreview, { props: { system, mode: 'light', selectedToken: role } }).body;
  const selected = preview.match(new RegExp(`<button[^>]*data-token="${role}"[^>]*>`))![0];
  expect(selected).toContain('popovertarget="preview-color-info"');
  expect(selected).toContain('color-inspection-anchor');
  const palette = render(Primitives, { props: { system } }).body;
  expect(palette).toContain('popover="auto"');
  expect(palette.match(/popovertarget="palette-color-details" popovertargetaction="show"/g)).toHaveLength(system.primitives.length);
});

it('keeps small positive contrast margins visible instead of rounding them to zero', () => {
  const inspection = colorInspection(system, { mode: 'light', token: system.modes.light.families.positive.roles['muted.base']!.semantic })!;
  const check = inspection.relationship!;
  const markup = render(ColorInfo, { props: { inspection: { ...inspection, relationship: { ...check, ratio: check.target + .003 } } } }).body;
  expect(markup).toContain('+0.003:1 headroom');
});
