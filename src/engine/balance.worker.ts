import { balanceConfiguration } from './balance';
import type { BuilderConfig } from './types';
const scope = globalThis as unknown as {
  onmessage: (event: MessageEvent<{ previous: BuilderConfig; requested: BuilderConfig }>) => void;
  postMessage: (value: unknown) => void;
};
scope.onmessage = (event) => {
  try {
    scope.postMessage({ result: balanceConfiguration(event.data.previous, event.data.requested) });
  } catch (error) {
    scope.postMessage({ error: error instanceof Error ? error.message : 'Unable to verify contrast. Previous settings retained.' });
  }
};
