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

it('preserves FIFO order through repeated wraparound and updates', () => {
  const cache = new BoundedCache<number, number>(3);
  for (let i=0;i<100;i++) {
    cache.set(i,i); cache.set(i,i+1000);
    expect(cache.get(i)).toBe(i+1000);
    if(i>=3)expect(cache.get(i-3)).toBeUndefined();
    if(i>=2)expect(cache.get(i-2)).toBe(i-2+1000);
  }
});
it('evicts without constructing a Map iterator for every insertion', () => {
  const cache = new BoundedCache<number, number>(2);
  const original=Map.prototype.keys;
  Map.prototype.keys=function(){throw new Error('iterator eviction');};
  try { for(let i=0;i<10;i++)cache.set(i,i); }
  finally { Map.prototype.keys=original; }
  expect(cache.get(9)).toBe(9);
});
