import { describe, expect, it } from 'vitest';
import config from '../vite.config';

describe('production hosting configuration', () => {
  it('emits relative asset paths so the app works on a GitHub Pages project site', () => {
    expect(config.base).toBe('./');
  });
});
