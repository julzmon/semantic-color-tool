import { expect, it } from 'vitest';
import { toColor } from '../engine/color';
import type { ContrastCheck } from '../engine/types';
import { describeNeutralRole, groupContrastChecks } from './neutralColorDetails';

it('preserves role context with a custom hyphenated token prefix', () => {
  expect(describeNeutralRole('--my-system-bg-neutral-muted-base', 'my-system')).toBe('Neutral muted fill · Base');
  expect(describeNeutralRole('--my-system-fg-base', 'my-system')).toBe('Text · Base');
  expect(describeNeutralRole('--my-system-fg-neutral-base', 'my-system')).toBe('Neutral text · Base');
  expect(describeNeutralRole('--my-system-border-info-emphasis-hover', 'my-system')).toBe('Info emphasis border · Hover');
  expect(describeNeutralRole('--my-system-bg-surface-level-2', 'my-system')).toBe('Surface · Level 2');
  expect(describeNeutralRole('--my-system-fg-on-emphasis', 'my-system')).toBe('Text on emphasis fills');
});

it('groups text checks without losing thresholds, failures, modes or relationships', () => {
  const color = toColor({ l: 0.5, c: 0, h: 0 });
  const check: ContrastCheck = { id: 'normal', mode: 'light', foreground: '--kds-fg-base', background: '--kds-bg-neutral-muted-base', foregroundColor: color, backgroundColor: color, ratio: 4, target: 4.5, pass: false, kind: 'normal-text' };
  const checks: ContrastCheck[] = [check, { ...check, id: 'large', kind: 'large-text', target: 3, pass: true }, { ...check, id: 'dark', mode: 'dark' }, { ...check, id: 'other', foreground: '--kds-fg-muted' }];
  const groups = groupContrastChecks(checks);
  expect(groups).toHaveLength(3);
  expect(groups[0].checks.map(({ kind, target, pass }) => ({ kind, target, pass }))).toEqual([
    { kind: 'normal-text', target: 4.5, pass: false },
    { kind: 'large-text', target: 3, pass: true },
  ]);
  expect(groups[1].mode).toBe('dark');
  expect(groups[2].foreground).toBe('--kds-fg-muted');
});

it('organizes tables around the selected role and keeps text and boundary checks separate', async () => {
  const { groupContrastTables } = await import('./neutralColorDetails');
  const color = toColor({ l: 0.5, c: 0, h: 0 });
  const check: ContrastCheck = { id: 'normal', mode: 'light', foreground: '--kds-fg-base', background: '--kds-bg-surface-base', foregroundColor: color, backgroundColor: color, ratio: 4, target: 4.5, pass: false, kind: 'normal-text' };
  const relationships = groupContrastChecks([check, { ...check, id: 'large', kind: 'large-text', target: 3, pass: true }, { ...check, id: 'border', foreground: '--kds-border-neutral-emphasis-base', kind: 'ui-boundary', target: 3, pass: true }]);
  const tables = groupContrastTables(relationships, { light: ['--kds-bg-surface-base'], dark: [] });
  expect(tables).toHaveLength(2);
  expect(tables[0]).toMatchObject({ mode: 'light', fixedRole: '--kds-bg-surface-base', fixedSide: 'background', category: 'text' });
  expect(tables[0].relationships[0].checks).toHaveLength(2);
  expect(tables[1].category).toBe('boundary');
  const foregroundTables = groupContrastTables(relationships.slice(0, 1), { light: ['--kds-fg-base'], dark: [] });
  expect(foregroundTables[0]).toMatchObject({ fixedRole: '--kds-fg-base', fixedSide: 'foreground' });
});
