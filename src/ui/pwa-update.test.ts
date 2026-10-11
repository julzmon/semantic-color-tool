import { expect, it } from 'vitest';
import { applyPwaUpdate } from './pwa-update';

it('saves settings before activating an update', async () => {
  const events: string[] = [];
  expect(await applyPwaUpdate(false, () => { events.push('save'); return true; }, async () => { events.push('update'); })).toBe('updated');
  expect(events).toEqual(['save', 'update']);
});

it('keeps the current app when calculations or saving are incomplete', async () => {
  let updates = 0;
  const update = async () => { updates++; };
  expect(await applyPwaUpdate(true, () => true, update)).toBe('busy');
  expect(await applyPwaUpdate(false, () => false, update)).toBe('storage-failed');
  expect(updates).toBe(0);
});

it('checks the latest calculation and storage state again at actual reload', async () => {
  let checking = false;
  let storageAvailable = true;
  let reloads = 0;
  const save = () => storageAvailable;
  const reload = async () => { reloads++; };
  await applyPwaUpdate(checking, save, async () => { checking = true; });
  expect(await applyPwaUpdate(checking, save, reload)).toBe('busy');
  checking = false;
  storageAvailable = false;
  expect(await applyPwaUpdate(checking, save, reload)).toBe('storage-failed');
  expect(reloads).toBe(0);
});
