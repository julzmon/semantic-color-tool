import reference from 'virtual:kds-reference';
import { expect, it } from 'vitest';
import { configFromReference } from '../engine/config';
import { generateSystem } from '../engine/generate';
import { colorInspection, contrastGrade } from './colorInspection';
const system = generateSystem(configFromReference(reference));
it('uses actual paired colors and the most restrictive checked relationship in the selected theme', () => {
  const role = system.modes.light.families.brand.roles['muted.base']!;
  const info = colorInspection(system, { mode: 'light', token: role.semantic })!;
  expect(info.color).toEqual(role.color);
  expect(info.checks.every(check => check.mode === 'light')).toBe(true);
  expect(system.checks).toContain(info.relationship);
  expect(info.relationship!.backgroundColor).toEqual(role.color);
  expect(info.checks.every(check => check.ratio - check.target >= info.relationship!.ratio - info.relationship!.target)).toBe(true);
});
it('does not invent contrast targets for decorative borders', () => {
  const role = system.modes.light.families.brand.roles['border.muted.base']!;
  expect(colorInspection(system, { mode: 'light', token: role.semantic })!.relationship).toBeUndefined();
});
it('includes both themes for palette colors and supports theme-specific neutral selection', () => {
  const primitive = system.primitives.find(item => item.usages.length > 1)!;
  const all = colorInspection(system, { primitive: primitive.name })!;
  const dark = colorInspection(system, { mode: 'dark', primitive: primitive.name })!;
  expect(dark.checks.every(check => check.mode === 'dark')).toBe(true);
  expect(all.checks.length).toBeGreaterThan(0);
  expect(all.checks).toEqual(system.checks.filter(check => primitive.usages.includes(`${check.mode}:${check.foreground}`) || primitive.usages.includes(`${check.mode}:${check.background}`)));
});
it('does not apply text grades to UI boundaries or a failed certification', () => {
  const check = system.checks[0];
  expect(contrastGrade({ ...check, pass: true, kind: 'normal-text', ratio: 7 })).toBe('AAA');
  expect(contrastGrade({ ...check, pass: true, kind: 'normal-text', ratio: 6.9 })).toBe('AA');
  expect(contrastGrade({ ...check, pass: true, kind: 'large-text', ratio: 4.5 })).toBe('AAA');
  expect(contrastGrade({ ...check, pass: true, kind: 'ui-boundary', ratio: 10 })).toBe('Pass');
  expect(contrastGrade({ ...check, pass: false, ratio: 10 })).toBe('Fail');
});

it('includes the checked surface relationships for neutral palette stops', () => {
  const surface = system.modes.light.surfaces[1];
  const info = colorInspection(system, { mode: 'light', primitive: surface.primitive })!;
  expect(info.checks.some(check => check.background === surface.semantic)).toBe(true);
  expect(info.relationship).toBeDefined();
});
