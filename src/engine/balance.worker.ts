import { balanceConfiguration } from './balance';
import { reduceLightnessStops } from './reduceLightness';
import { prepareTokens } from './tokens';
import type { BuilderConfig } from './types';
const scope = globalThis as unknown as {
  onmessage: (event: MessageEvent<{ previous: BuilderConfig; requested: BuilderConfig; action?: 'reduce-lightness' }>) => void;
  postMessage: (value: unknown) => void;
};
scope.onmessage = (event) => {
  try {
    const result = event.data.action === 'reduce-lightness'
      ? reduceLightnessStops(event.data.requested)
      : balanceConfiguration(event.data.previous, event.data.requested);
    scope.postMessage({ result, prepared: prepareTokens(result.system) });
  } catch (error) {
    scope.postMessage({ error: error instanceof Error ? error.message : 'Unable to verify contrast. Previous settings retained.' });
  }
};
