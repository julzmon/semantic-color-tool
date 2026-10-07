import type { BalancedConfiguration } from './balance';
import type { BuilderConfig } from './types';
type Job = { previous: BuilderConfig; requested: BuilderConfig; resolve: (result: BalancedConfiguration | null) => void; reject: (error: Error) => void };

/** One active search and one pending edit: dragging cannot queue a backlog. */
export function createBalanceClient(worker: Worker) {
  let active: Job | undefined;
  let pending: Job | undefined;
  let stopped = false;
  const run = (job: Job) => {
    active = job;
    worker.postMessage({ previous: job.previous, requested: job.requested });
  };
  const dispose = () => {
    stopped = true;
    const error = new Error('Background contrast checking stopped. Previous settings retained.');
    active?.reject(error);
    pending?.reject(error);
    active = pending = undefined;
    worker.terminate();
  };
  worker.onmessage = (event: MessageEvent<{ result?: BalancedConfiguration; error?: string }>) => {
    const job = active;
    active = undefined;
    if (!job) return;
    if (event.data.result) job.resolve(event.data.result);
    else job.reject(new Error(event.data.error || 'Unable to verify contrast. Previous settings retained.'));
    if (pending) { const next = pending; pending = undefined; run(next); }
  };
  worker.onerror = dispose;
  return {
    balance(previous: BuilderConfig, requested: BuilderConfig): Promise<BalancedConfiguration | null> {
      return new Promise((resolve, reject) => {
        if (stopped) { reject(new Error('Background contrast checking stopped. Previous settings retained.')); return; }
        const job = { previous, requested, resolve, reject };
        if (active) { pending?.resolve(null); pending = job; } else run(job);
      });
    },
    dispose,
  };
}
