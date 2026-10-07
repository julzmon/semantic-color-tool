import { describe, expect, it } from 'vitest';
import { createBalanceClient } from './balance-client';
import type { BuilderConfig } from './types';
describe('background balance scheduling', () => {
  it('coalesces pending edits and resolves failures without getting stuck', async () => {
    const sent: unknown[] = [];
    const worker = { postMessage: (value: unknown) => sent.push(value), onmessage: null as any, onerror: null as any, terminate: () => {} };
    const client = createBalanceClient(worker as unknown as Worker);
    const config = {} as BuilderConfig;
    const first = client.balance(config, config);
    const second = client.balance(config, config);
    const third = client.balance(config, config);
    expect(sent).toHaveLength(1);
    await expect(second).resolves.toBeNull();
    worker.onmessage({ data: { error: 'Impossible contrast' } });
    await expect(first).rejects.toThrow('Impossible contrast');
    expect(sent).toHaveLength(2);
    worker.onmessage({ data: { result: { message: 'verified' } } });
    await expect(third).resolves.toEqual({ message: 'verified' });
    const fourth = client.balance(config, config);
    client.dispose();
    await expect(fourth).rejects.toThrow(/stopped/);
  });
});
