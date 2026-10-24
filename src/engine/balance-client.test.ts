import { readFileSync } from 'node:fs';
import { generateSystem } from './generate';
import { configFromReference, parseKdsTokens } from './reference';
import { prepareTokens, cssTokenModel } from './tokens';
import { describe, expect, it } from 'vitest';
import { createBalanceClient } from './balance-client';
import type { BuilderConfig } from './types';
it('queues lightness reduction in the same bounded queue as edits', async () => {
  const sent: unknown[] = [];
  const worker = { postMessage: (value: unknown) => sent.push(value), onmessage: null as any, onerror: null as any, terminate: () => {} };
  const client = createBalanceClient(worker as unknown as Worker);
  const config = {} as BuilderConfig;
  const first = client.balance(config, config);
  const reduction = client.reduceLightness(config);
  expect(sent).toHaveLength(1);
  worker.onmessage({ data: { result: { message: 'balanced' } } });
  await first;
  expect(sent[1]).toEqual({ previous: config, requested: config, action: 'reduce-lightness' });
  worker.onmessage({ data: { error: 'Reduction failed' } });
  await expect(reduction).rejects.toThrow('Reduction failed');
  client.dispose();
});
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

it('adopts prepared token data from the worker before resolving the public result', async () => {
  const config = configFromReference(parseKdsTokens(readFileSync(new URL('../reference/kds-tokens.css', import.meta.url), 'utf8')));
  const system = generateSystem(config);
  const result = { config: system.config, system, message: '' };
  const data = structuredClone({ result, prepared: prepareTokens(system) });
  const fingerprint = JSON.stringify(data.result);
  const worker = { postMessage: () => {}, onmessage: null as any, onerror: null as any, terminate: () => {} };
  const client = createBalanceClient(worker as unknown as Worker);
  const promise = client.balance(config, config);
  worker.onmessage({ data });
  const received = await promise;
  expect(JSON.stringify(received)).toBe(fingerprint);
  expect(cssTokenModel(received!.system)).toBe(data.prepared.model);
  client.dispose();
});

it('rejects an invalid prepared response and continues the pending edit', async () => {
  const config = configFromReference(parseKdsTokens(readFileSync(new URL('../reference/kds-tokens.css', import.meta.url), 'utf8')));
  const system = generateSystem(config);
  const prepared = { ...prepareTokens(system), model: undefined };
  const sent: unknown[] = [];
  const worker = { postMessage: (value: unknown) => sent.push(value), onmessage: null as any, onerror: null as any, terminate: () => {} };
  const client = createBalanceClient(worker as unknown as Worker);
  const first = client.balance(config, config);
  const rejected = expect(first).rejects.toThrow(/prepared tokens/);
  const second = client.balance(config, config);
  expect(() => worker.onmessage({ data: { result: { config, system, message: '' }, prepared } })).not.toThrow();
  await rejected;
  expect(sent).toHaveLength(2);
  worker.onmessage({ data: { result: { config, system, message: 'next result' } } });
  await expect(second).resolves.toMatchObject({ message: 'next result' });
  client.dispose();
});
