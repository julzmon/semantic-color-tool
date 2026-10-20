import { expect, it } from 'vitest';
import { createControlAvailabilityClient } from './controlAvailability-client';
import type { BuilderConfig } from '../engine/types';
it('supersedes stale reports and cancels pending work without a backlog', async () => {
  const sent: any[] = [];
  const worker = { postMessage: (data: unknown) => sent.push(data), onmessage: null as any, onerror: null as any, terminate: () => {} };
  const client = createControlAvailabilityClient(worker as unknown as Worker);
  const updates: unknown[] = [];
  const first = client.probe({} as BuilderConfig, 'old', samples => updates.push(samples));
  const second = client.probe({} as BuilderConfig, 'new', samples => updates.push(samples));
  await expect(first).resolves.toBeNull();
  worker.onmessage({ data: { id: sent[0].id, sample: { value: 1, safe: true, failedChecks: 0 } } });
  expect(updates).toEqual([]);
  worker.onmessage({ data: { id: sent[1].id, sample: { value: .5, safe: true, failedChecks: 0 } } });
  worker.onmessage({ data: { id: sent[1].id, complete: true } });
  await expect(second).resolves.toMatchObject({ key: 'new', samples: [{value:.5,safe:true,failedChecks:0}] });
  const third = client.probe({} as BuilderConfig, 'third');
  client.cancel(); await expect(third).resolves.toBeNull();
  const fourth = client.probe({} as BuilderConfig, 'fourth');
  client.dispose(); await expect(fourth).resolves.toBeNull();
});
it('surfaces worker errors and does not leave future requests pending', async () => {
  const worker = { postMessage: () => {}, onmessage: null as any, onerror: null as any, terminate: () => {} };
  const client = createControlAvailabilityClient(worker as unknown as Worker);
  const result = client.probe({} as BuilderConfig, 'key');
  worker.onerror();
  await expect(result).rejects.toThrow(/unavailable/);
  await expect(client.probe({} as BuilderConfig, 'key')).rejects.toThrow(/unavailable/);
});
