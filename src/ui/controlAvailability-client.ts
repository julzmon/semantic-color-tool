import type { BuilderConfig } from '../engine/types';
import type { ControlAvailability, ControlSample } from './controlAvailability';

type Job = { id: number; key: string; samples: ControlSample[]; progress?: (samples: ControlSample[]) => void; resolve: (result: ControlAvailability | null) => void; reject: (error: Error) => void };
/** Independent from balancing: cancel obsolete probes immediately and ignore late replies. */
export function createControlAvailabilityClient(worker: Worker) {
  let sequence = 0;
  let active: Job | undefined;
  let stopped = false;
  const cancel = () => {
    active?.resolve(null); active = undefined;
    if (!stopped) worker.postMessage({ id: ++sequence });
  };
  worker.onmessage = ({ data }: MessageEvent<{ id: number; sample?: ControlSample; complete?: boolean; error?: string }>) => {
    if (!active || active.id !== data.id) return;
    if (data.sample) { active.samples.push(data.sample); active.progress?.([...active.samples]); }
    if (data.error) { active.reject(new Error(data.error)); active = undefined; }
    else if (data.complete) { active.resolve({ key: active.key, samples: active.samples }); active = undefined; }
  };
  worker.onerror = () => {
    stopped = true;
    active?.reject(new Error('Safe-value checking is unavailable. Edits still use contrast protection.'));
    active = undefined;
    worker.terminate();
  };
  return {
    probe(config: BuilderConfig, key: string, progress?: Job['progress']): Promise<ControlAvailability | null> {
      if (stopped) return Promise.reject(new Error('Safe-value checking is unavailable. Edits still use contrast protection.'));
      active?.resolve(null);
      return new Promise((resolve, reject) => {
        active = { id: ++sequence, key, samples: [], progress, resolve, reject };
        worker.postMessage({ id: active.id, config, key });
      });
    },
    cancel,
    dispose() { cancel(); stopped = true; worker.terminate(); },
  };
}
