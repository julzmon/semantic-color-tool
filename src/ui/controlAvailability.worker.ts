import { controlDescriptor, controlSamples, probeControlValue } from './controlAvailability';
import type { BuilderConfig } from '../engine/types';
const scope = globalThis as unknown as {
  onmessage: (event: MessageEvent<{ id: number; config?: BuilderConfig; key?: string }>) => void;
  postMessage: (value: unknown) => void;
};
let latest = 0;
scope.onmessage = async ({ data }) => {
  latest = data.id;
  if (!data.config || !data.key) return;
  const { id, config, key } = data;
  try {
    for (const value of controlSamples(controlDescriptor(config, key))) {
      // Yield before each expensive generation so a new configuration can cancel old probes.
      await new Promise(resolve => setTimeout(resolve, 0));
      if (id !== latest) return;
      const sample = probeControlValue(config, key, value);
      scope.postMessage({ id, sample });
    }
    if (id === latest) scope.postMessage({ id, complete: true });
  } catch (error) {
    if (id === latest) scope.postMessage({ id, error: error instanceof Error ? error.message : 'Unable to check safe values.' });
  }
};
