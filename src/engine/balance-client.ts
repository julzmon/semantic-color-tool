import { adoptTokens, type PreparedTokens } from './tokens';
import type { BalancedConfiguration } from './balance';
import type { BuilderConfig } from './types';
type Request = { previous: BuilderConfig; requested: BuilderConfig; action?: 'reduce-lightness' };
type Job = Request & { resolve: (result: BalancedConfiguration | null) => void; reject: (error: Error) => void };

/** One active search and one pending edit: dragging cannot queue a backlog. */
export function createBalanceClient(worker: Worker) {
  let active: Job | undefined;
  let pending: Job | undefined;
  let stopped = false;
  const run = (job: Job) => {
    active = job;
    worker.postMessage({ previous: job.previous, requested: job.requested, ...(job.action ? { action: job.action } : {}) });
  };
  const dispose = () => {
    stopped = true;
    const error = new Error('Background contrast checking stopped. Previous settings retained.');
    active?.reject(error);
    pending?.reject(error);
    active = pending = undefined;
    worker.terminate();
  };
  worker.onmessage = (event: MessageEvent<{ result?: BalancedConfiguration; prepared?: PreparedTokens; error?: string }>) => {
    const job = active;
    active = undefined;
    if (!job) return;
    if (event.data.result) {
      try {
        if (event.data.prepared) adoptTokens(event.data.result.system, event.data.prepared);
        job.resolve(event.data.result);
      } catch {
        job.reject(new Error('Unable to adopt prepared tokens. Previous settings retained.'));
      }
    }
    else job.reject(new Error(event.data.error || 'Unable to verify contrast. Previous settings retained.'));
    if (pending) { const next = pending; pending = undefined; run(next); }
  };
  worker.onerror = dispose;
  const enqueue = (request: Request): Promise<BalancedConfiguration | null> => new Promise((resolve, reject) => {
    if (stopped) { reject(new Error('Background contrast checking stopped. Previous settings retained.')); return; }
    const job = { ...request, resolve, reject };
    if (active) { pending?.resolve(null); pending = job; } else run(job);
  });
  return {
    balance(previous: BuilderConfig, requested: BuilderConfig): Promise<BalancedConfiguration | null> {
      return enqueue({ previous, requested });
    },
    reduceLightness(config: BuilderConfig): Promise<BalancedConfiguration | null> {
      return enqueue({ previous: config, requested: config, action: 'reduce-lightness' });
    },
    dispose,
  };
}
