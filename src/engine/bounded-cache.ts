/** FIFO eviction bounds persistent worker caches without per-hit bookkeeping. */
export class BoundedCache<Key, Value> {
  private readonly entries = new Map<Key, Value>();
  constructor(private readonly capacity: number) {
    if (!Number.isInteger(capacity) || capacity < 1) throw new Error('Cache capacity must be a positive integer.');
  }
  get(key: Key): Value | undefined { return this.entries.get(key); }
  set(key: Key, value: Value): void {
    if (!this.entries.has(key) && this.entries.size === this.capacity)
      this.entries.delete(this.entries.keys().next().value!);
    this.entries.set(key, value);
  }
}
