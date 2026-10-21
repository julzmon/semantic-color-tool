import reference from 'virtual:kds-reference';
import { expect, it } from 'vitest';
import { balanceConfiguration } from '../engine/balance';
import { parseLockedColor } from '../engine/color';
import { defaultConfiguration } from './defaultConfiguration';

it('starts and resets to an unlocked #cc0000 Brand with matching family controls', () => {
  const config = defaultConfiguration(reference);
  const source = parseLockedColor('#cc0000');
  expect(config.anchors).toEqual([{ family: 'brand', color: '#cc0000', role: 'emphasis.base', mode: 'light', locked: false }]);
  expect(config.families.find(family => family.id === 'brand')).toMatchObject({ hue: source.h, chroma: source.c });
  const accepted = balanceConfiguration(config, config);
  expect(accepted.system.checks.every(check => check.pass)).toBe(true);
  expect(accepted.config.anchors[0].color).toBe('#cc0000');
  config.anchors[0].color = '#000000';
  expect(defaultConfiguration(reference).anchors[0].color).toBe('#cc0000');
});
