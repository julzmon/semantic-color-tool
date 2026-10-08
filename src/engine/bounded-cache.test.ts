import { expect, it } from 'vitest';
import { BoundedCache } from './bounded-cache';
it('bounds retained entries and evicts the oldest insertion', () => {
  const cache = new BoundedCache<string, number>(2);
  cache.set('one', 1); cache.set('two', 2); cache.set('three', 3);
  expect(cache.get('one')).toBeUndefined();
  expect(cache.get('two')).toBe(2);
  expect(cache.get('three')).toBe(3);
  cache.set('two', 20); cache.set('four', 4);
  expect(cache.get('two')).toBeUndefined();
  expect(cache.get('three')).toBe(3);
  expect(cache.get('four')).toBe(4);
});
it('rejects invalid capacities', () => {
  for (const capacity of [0, -1, 1.5, Infinity]) expect(() => new BoundedCache(capacity)).toThrow();
});
