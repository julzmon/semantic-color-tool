export async function applyPwaUpdate(
  checking: boolean,
  save: () => boolean,
  update: () => Promise<void>,
): Promise<'busy' | 'storage-failed' | 'updated'> {
  if (checking) return 'busy';
  if (!save()) return 'storage-failed';
  await update();
  return 'updated';
}
