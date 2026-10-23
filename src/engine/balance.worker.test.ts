import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { configFromReference, parseKdsTokens } from './reference';
import { adoptTokens, cssTokenModel } from './tokens';

it('prepares cloneable verified tokens beside the unchanged balance result', async () => {
  const config = configFromReference(parseKdsTokens(readFileSync(new URL('../reference/kds-tokens.css', import.meta.url), 'utf8')));
  const postMessage = vi.fn();
  vi.stubGlobal('postMessage', postMessage);
  vi.stubGlobal('onmessage', undefined);
  try {
    await import('./balance.worker');
    const scope = globalThis as unknown as { onmessage: (event: MessageEvent) => void };
    scope.onmessage({ data: { previous: config, requested: config } } as MessageEvent);
    expect(postMessage).toHaveBeenCalledOnce();
    const data = structuredClone(postMessage.mock.calls[0][0]);
    expect(data.error).toBeUndefined();
    expect(data.prepared).toBeDefined();
    expect(Object.keys(data.result).sort()).toEqual(['config', 'message', 'system']);
    expect(adoptTokens(data.result.system, data.prepared)).toBe(true);
    expect(cssTokenModel(data.result.system)).toBe(data.prepared.model);
  } finally { vi.unstubAllGlobals(); }
});
